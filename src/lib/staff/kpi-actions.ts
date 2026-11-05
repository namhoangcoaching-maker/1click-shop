"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";
import { checkTemplate, needsTarget, type KpiKind } from "./kpi";

export interface KpiState {
  ok?: boolean;
  message?: string;
}

const str = (form: FormData, k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");

async function ctx() {
  const org = await getCurrentOrg();
  if (!org || org.role === "staff") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub as string | undefined;
  return me ? { org, me, supabase } : null;
}

/** Chủ shop tạo / sửa mẫu KPI (database cũng chỉ cho Chủ – RLS 0016). */
export async function saveTemplate(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c || c.org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop tạo, sửa mẫu KPI." };
  const input = checkTemplate(form);
  if (!input.ok) return { ok: false, message: input.message };
  const v = input.value;
  const row = { name: v.name, kind: v.kind, source: v.source, channels: v.channels, unit_label: v.unitLabel, rate: v.rate, tiers: v.tiers, cap: v.cap };
  const id = str(form, "id");
  const { error } = id
    ? await c.supabase.from("kpi_templates").update(row).eq("id", id).eq("org_id", c.org.id)
    : await c.supabase.from("kpi_templates").insert({ org_id: c.org.id, ...row });
  if (error) return { ok: false, message: "Không lưu được mẫu KPI, thử lại." };
  refresh();
  return { ok: true, message: id ? "Đã sửa mẫu KPI." : `Đã tạo mẫu “${v.name}”.` };
}

/** Chủ shop ngừng dùng / dùng lại một mẫu (ngừng dùng thì không tính vào lương nữa, giữ lịch sử). */
export async function toggleTemplate(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c || c.org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop." };
  const archive = str(form, "archive") === "1";
  const { error } = await c.supabase
    .from("kpi_templates")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", str(form, "id"))
    .eq("org_id", c.org.id);
  if (error) return { ok: false, message: "Không lưu được." };
  refresh();
  return { ok: true };
}

/** Gắn KPI cho một người (Chủ: mọi người; Quản lý: Nhân viên) hoặc một bộ phận (chỉ Chủ). */
export async function saveAssignment(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý gắn KPI." };
  const templateId = str(form, "templateId");
  const who = str(form, "who"); // "user:<id>" | "dept:<tên>"
  const { data: t } = await c.supabase.from("kpi_templates").select("kind, source").eq("id", templateId).eq("org_id", c.org.id).maybeSingle();
  if (!t) return { ok: false, message: "Chọn mẫu KPI." };
  const targetText = str(form, "target").replace(/[.\s₫đ]/g, "").replace(",", ".");
  const target = targetText === "" ? null : Number(targetText);
  if (target !== null && !(target > 0 && target <= 100_000_000_000)) return { ok: false, message: "Chỉ tiêu là số dương." };
  if (needsTarget(t.kind as KpiKind) && target === null) return { ok: false, message: "KPI kiểu này cần chỉ tiêu tháng." };

  let row: { user_id: string | null; department: string | null };
  if (who.startsWith("user:")) row = { user_id: who.slice(5), department: null };
  else if (who.startsWith("dept:") && who.length > 5) {
    if (c.org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop gắn KPI cho cả bộ phận." };
    row = { user_id: null, department: who.slice(5) };
  } else return { ok: false, message: "Chọn người hoặc bộ phận." };

  const id = str(form, "id");
  const { error } = id
    ? await c.supabase.from("kpi_assignments").update({ target }).eq("id", id).eq("org_id", c.org.id)
    : await c.supabase.from("kpi_assignments").insert({ org_id: c.org.id, template_id: templateId, ...row, target, created_by: c.me });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "KPI này đã gắn cho người / bộ phận này rồi (sửa chỉ tiêu ở danh sách)." : "Không lưu được (có thể bạn không được gắn KPI cho người này).",
    };
  }
  refresh();
  return { ok: true, message: id ? "Đã sửa chỉ tiêu." : "Đã gắn KPI." };
}

export async function removeAssignment(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý." };
  const { error, count } = await c.supabase
    .from("kpi_assignments")
    .delete({ count: "exact" })
    .eq("id", str(form, "id"))
    .eq("org_id", c.org.id);
  if (error || !count) return { ok: false, message: "Không bỏ được (bạn không có quyền với KPI này)." };
  refresh();
  return { ok: true };
}

/** Nhập kết quả KPI nhập tay của một người trong tháng (khóa sổ như chấm công). */
export async function saveResult(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý nhập kết quả." };
  const month = str(form, "month");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, message: "Tháng không hợp lệ." };
  const actualText = str(form, "actual").replace(/[.\s]/g, "").replace(",", ".");
  const key = { org_id: c.org.id, assignment_id: str(form, "assignmentId"), user_id: str(form, "userId"), month: `${month}-01` };
  if (actualText === "") {
    await c.supabase.from("kpi_results").delete().match(key);
    refresh();
    return { ok: true, message: "Đã xóa kết quả." };
  }
  const actual = Number(actualText);
  if (!(actual >= 0 && actual <= 100_000_000_000)) return { ok: false, message: "Kết quả là số không âm." };
  const note = str(form, "note").slice(0, 200) || null;
  const { error } = await c.supabase.from("kpi_results").upsert({ ...key, actual, note }, { onConflict: "assignment_id,user_id,month" });
  if (error) return { ok: false, message: "Không lưu được (tháng đã khóa sổ, hoặc bạn không được nhập cho người này)." };
  refresh();
  return { ok: true, message: "Đã lưu." };
}

/** Nối một nhân sự 1Click với tài khoản nhân viên trên Pancake (KPI doanh thu đơn gán). */
export async function saveSellerLink(_prev: KpiState, form: FormData): Promise<KpiState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý." };
  const userId = str(form, "userId");
  const sellerId = str(form, "sellerId").slice(0, 64) || null;
  const upd = await c.supabase
    .from("staff_settings")
    .update({ pancake_seller_id: sellerId })
    .eq("org_id", c.org.id)
    .eq("user_id", userId)
    .select("user_id");
  if (upd.error) return { ok: false, message: "Không lưu được (bạn không được cấu hình người này)." };
  if (!upd.data?.length) return { ok: false, message: "Cấu hình nhân sự (ca làm, lương) cho người này trước." };
  refresh();
  return { ok: true, message: "Đã lưu." };
}

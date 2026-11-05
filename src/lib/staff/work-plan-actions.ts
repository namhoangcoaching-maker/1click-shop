"use server";

import { refresh } from "next/cache";
import { todayInVN } from "@/lib/date-range";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";

export interface PlanState {
  ok?: boolean;
  message?: string;
}

const str = (form: FormData, k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function ctx() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub as string | undefined;
  return me ? { org, me, supabase } : null;
}

/** Thêm việc: Nhân viên tự thêm cho mình (từ hôm nay trở đi); Quản lý / Chủ giao cho người mình quản lý. */
export async function addTask(_prev: PlanState, form: FormData): Promise<PlanState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const title = str(form, "title");
  if (title.length < 1 || title.length > 200) return { ok: false, message: "Nhập tên việc (tối đa 200 ký tự)." };
  const userId = str(form, "userId") || c.me;
  const dueDate = str(form, "dueDate") || todayInVN();
  if (!DATE.test(dueDate)) return { ok: false, message: "Ngày không hợp lệ." };
  if (userId === c.me && c.org.role === "staff" && dueDate < todayInVN()) return { ok: false, message: "Chỉ thêm việc từ hôm nay trở đi." };
  const { error } = await c.supabase.from("tasks").insert({ org_id: c.org.id, user_id: userId, title, due_date: dueDate, created_by: c.me });
  if (error) return { ok: false, message: "Không thêm được (bạn không được giao việc cho người này)." };
  refresh();
  return { ok: true, message: userId === c.me ? "Đã thêm việc." : "Đã giao việc." };
}

/** Tích / bỏ tích xong một việc (giờ xong do database ghi). */
export async function setTaskDone(id: string, done: boolean): Promise<PlanState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const { data, error } = await c.supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("org_id", c.org.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Không lưu được." };
  refresh();
  return { ok: true };
}

export async function removeTask(id: string): Promise<PlanState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const { error, count } = await c.supabase.from("tasks").delete({ count: "exact" }).eq("id", id).eq("org_id", c.org.id);
  if (error || !count) return { ok: false, message: "Không xóa được (việc do Quản lý giao thì chỉ Quản lý xóa)." };
  refresh();
  return { ok: true };
}

/** Tích / bỏ tích việc lặp lại của một người trong một ngày. */
export async function setRecurringDone(recurringId: string, userId: string, date: string, done: boolean): Promise<PlanState> {
  const c = await ctx();
  if (!c || !DATE.test(date)) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const key = { org_id: c.org.id, recurring_id: recurringId, user_id: userId, work_date: date };
  const { error } = done ? await c.supabase.from("recurring_done").insert(key) : await c.supabase.from("recurring_done").delete().match(key);
  if (error && error.code !== "23505") return { ok: false, message: "Không lưu được." };
  refresh();
  return { ok: true };
}

/**
 * Gửi / sửa báo cáo cuối ngày HÔM NAY của chính mình, kèm số KPI nhập tay của ngày (ô "kpi:<mã KPI gắn>").
 * Database chỉ cho ghi đúng ngày hôm nay.
 */
export async function saveReport(_prev: PlanState, form: FormData): Promise<PlanState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const today = todayInVN();
  const text = (k: string) => str(form, k).slice(0, 2000) || null;
  const values = { result_text: text("resultText"), blockers: text("blockers"), tomorrow: text("tomorrow") };

  // Số KPI theo ngày
  const kpi: { assignmentId: string; value: number | null }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("kpi:") || typeof v !== "string") continue;
    const s = v.trim().replace(/[.\s]/g, "").replace(",", ".");
    const value = s === "" ? null : Number(s);
    if (value !== null && !(value >= 0 && value <= 1_000_000_000)) return { ok: false, message: "Số KPI phải là số không âm." };
    kpi.push({ assignmentId: k.slice(4), value });
  }

  const key = { org_id: c.org.id, user_id: c.me, work_date: today };
  const { data: existing } = await c.supabase.from("work_reports").select("work_date").match(key).maybeSingle();
  const { error } = existing
    ? await c.supabase.from("work_reports").update(values).match(key)
    : await c.supabase.from("work_reports").insert({ ...key, ...values });
  if (error) return { ok: false, message: "Không gửi được báo cáo, thử lại." };

  for (const k of kpi) {
    const kk = { org_id: c.org.id, assignment_id: k.assignmentId, user_id: c.me, work_date: today };
    const r =
      k.value === null
        ? await c.supabase.from("kpi_daily").delete().match(kk)
        : await c.supabase.from("kpi_daily").upsert({ ...kk, value: k.value }, { onConflict: "assignment_id,user_id,work_date" });
    if (r.error) return { ok: false, message: "Đã lưu báo cáo nhưng không lưu được số KPI." };
  }
  refresh();
  return { ok: true, message: existing ? "Đã cập nhật báo cáo." : "Đã gửi báo cáo." };
}

/** Quản lý / Chủ ghi nhận xét vào báo cáo ngày của người mình quản lý. */
export async function saveManagerNote(_prev: PlanState, form: FormData): Promise<PlanState> {
  const c = await ctx();
  if (!c || c.org.role === "staff") return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý." };
  const date = str(form, "date");
  if (!DATE.test(date)) return { ok: false, message: "Ngày không hợp lệ." };
  const { data, error } = await c.supabase
    .from("work_reports")
    .update({ manager_note: str(form, "note").slice(0, 1000) || null })
    .eq("org_id", c.org.id)
    .eq("user_id", str(form, "userId"))
    .eq("work_date", date)
    .select("work_date");
  if (error || !data?.length) return { ok: false, message: "Không lưu được (người này chưa gửi báo cáo, hoặc bạn không quản lý họ)." };
  refresh();
  return { ok: true, message: "Đã lưu nhận xét." };
}

/** Tạo việc lặp lại cho người (Chủ / Quản lý) hoặc bộ phận (chỉ Chủ). */
export async function addRecurring(_prev: PlanState, form: FormData): Promise<PlanState> {
  const c = await ctx();
  if (!c || c.org.role === "staff") return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý." };
  const title = str(form, "title");
  if (title.length < 1 || title.length > 200) return { ok: false, message: "Nhập tên việc." };
  const workDays = [...new Set(form.getAll("workDays").map(Number))].filter((d) => d >= 1 && d <= 7).sort();
  if (workDays.length === 0) return { ok: false, message: "Chọn ít nhất một ngày trong tuần." };
  const who = str(form, "who");
  let row: { user_id: string | null; department: string | null };
  if (who.startsWith("user:")) row = { user_id: who.slice(5), department: null };
  else if (who.startsWith("dept:") && who.length > 5) {
    if (c.org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop giao việc cho cả bộ phận." };
    row = { user_id: null, department: who.slice(5) };
  } else return { ok: false, message: "Chọn người hoặc bộ phận." };
  const { error } = await c.supabase.from("recurring_tasks").insert({ org_id: c.org.id, title, work_days: workDays, created_by: c.me, ...row });
  if (error) return { ok: false, message: "Không lưu được (bạn không được giao việc cho người này)." };
  refresh();
  return { ok: true, message: "Đã tạo việc lặp lại." };
}

export async function archiveRecurring(id: string): Promise<PlanState> {
  const c = await ctx();
  if (!c) return { ok: false, message: "Phiên đăng nhập hết hạn." };
  const { data, error } = await c.supabase
    .from("recurring_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", c.org.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Không bỏ được (bạn không quản lý việc này)." };
  refresh();
  return { ok: true };
}

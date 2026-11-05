"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import type { OrgRole } from "@/lib/org/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkSettings, toRow } from "./settings";
import { checkNewMember, checkPassword, checkProfile } from "./validate";

export interface StaffState {
  ok?: boolean;
  message?: string;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Quyền quản lý nhân sự (Giai đoạn 6.2, chủ dự án duyệt 05/11/2026):
 * Chủ shop quản lý mọi người; Quản lý chỉ quản lý người vai trò Nhân viên. Database cũng chặn (RLS 0014).
 */
async function staffAdmin() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Tài khoản chưa được gắn vào shop." } as const;
  if (org.role === "staff") return { error: "Chỉ Chủ shop hoặc Quản lý mới quản lý nhân sự." } as const;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) return { error: "Phiên đăng nhập hết hạn, đăng nhập lại." } as const;
  return { org, me, supabase } as const;
}

/** Vai trò hiện tại của một thành viên shop (đọc qua RLS); null = không phải thành viên / không được xem. */
async function memberRole(supabase: Supabase, orgId: string, userId: string): Promise<OrgRole | null> {
  const { data } = await supabase.from("memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return (data?.role as OrgRole | undefined) ?? null;
}

/** Quản lý chỉ được thao tác với Nhân viên (và chỉ đặt vai trò Nhân viên). */
function managerMayTouch(actorRole: OrgRole, targetRole: OrgRole | null, newRole?: OrgRole) {
  if (actorRole === "owner") return true;
  return targetRole === "staff" && (newRole === undefined || newRole === "staff");
}

/** Tìm tài khoản đã có theo email (Supabase không có hàm tìm theo email: duyệt từng trang). */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

const friendly = (msg: string) =>
  msg.includes("ít nhất một Chủ") ? "Shop phải còn ít nhất một Chủ." : msg.includes("không thuộc shop") ? "Địa điểm không thuộc shop." : "Không lưu được, thử lại sau.";

/**
 * Thêm nhân sự: tạo tài khoản (email + mật khẩu tạm, đã xác nhận) rồi gắn vào shop, kèm cấu hình mặc định.
 * Email đã có tài khoản thì chỉ gắn vào shop, KHÔNG đổi mật khẩu của họ. Quản lý chỉ thêm được vai trò Nhân viên.
 */
export async function addMember(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const input = checkNewMember(form);
  if (!input.ok) return { ok: false, message: input.message };
  const { email, password, displayName, role, department } = input.value;
  if (ctx.org.role === "manager" && role !== "staff") return { ok: false, message: "Quản lý chỉ thêm được vai trò Nhân viên." };

  const admin = createAdminClient();
  let userId: string | null = null;
  let created = false;
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.data.user) {
    userId = res.data.user.id;
    created = true;
  } else {
    userId = await findUserIdByEmail(email).catch(() => null);
    if (!userId) return { ok: false, message: "Không tạo được tài khoản, thử lại sau." };
  }

  // Gắn vào shop bằng phiên của người thao tác (RLS: Chủ thêm mọi vai trò, Quản lý chỉ thêm Nhân viên).
  const ins = await ctx.supabase
    .from("memberships")
    .insert({ org_id: ctx.org.id, user_id: userId, role, display_name: displayName, department });
  if (ins.error) {
    if (created) await admin.auth.admin.deleteUser(userId); // không để lại tài khoản mồ côi
    if (ins.error.code === "23505") return { ok: false, message: "Email này đã là thành viên shop." };
    console.error("Thêm nhân sự lỗi:", ins.error.message);
    return { ok: false, message: "Không thêm được, thử lại sau." };
  }
  await ctx.supabase.from("staff_settings").insert({ org_id: ctx.org.id, user_id: userId, updated_by: ctx.me });
  refresh();
  return {
    ok: true,
    message: created
      ? `Đã thêm ${displayName}. Bấm vào tên để cấu hình chấm công, ca làm, lương. Gửi cho họ: web shop.nhankhoitu.com.vn, email ${email} và mật khẩu tạm; đăng nhập xong vào “Tài khoản” để đổi mật khẩu.`
      : `Đã gắn ${displayName} (${email}) vào shop. Email này đã có tài khoản nên giữ mật khẩu cũ của họ.`,
  };
}

/** Sửa họ tên, bộ phận, vai trò. Không tự đổi vai trò của mình; Quản lý chỉ sửa Nhân viên. */
export async function updateMember(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const userId = String(form.get("userId") ?? "");
  const p = checkProfile(form);
  if (!p.ok) return { ok: false, message: p.message };
  const target = await memberRole(ctx.supabase, ctx.org.id, userId);
  if (!target) return { ok: false, message: "Không tìm thấy thành viên." };
  if (userId === ctx.me && p.value.role !== target) return { ok: false, message: "Không tự đổi vai trò của chính mình." };
  if (!managerMayTouch(ctx.org.role, target, p.value.role)) return { ok: false, message: "Quản lý chỉ sửa được Nhân viên." };
  const { data, error } = await ctx.supabase
    .from("memberships")
    .update({ display_name: p.value.displayName, department: p.value.department, role: p.value.role })
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, message: friendly(error.message) };
  if (!data?.length) return { ok: false, message: "Không có quyền sửa người này." };
  refresh();
  return { ok: true, message: "Đã lưu thông tin." };
}

/** Khóa (nghỉ việc) hoặc mở khóa. Không tự khóa mình; Quản lý chỉ khóa Nhân viên. */
export async function setMemberLocked(userId: string, locked: boolean): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (userId === ctx.me) return { ok: false, message: "Không tự khóa tài khoản của mình." };
  const target = await memberRole(ctx.supabase, ctx.org.id, userId);
  if (!managerMayTouch(ctx.org.role, target)) return { ok: false, message: "Quản lý chỉ khóa được Nhân viên." };
  const { data, error } = await ctx.supabase
    .from("memberships")
    .update({ disabled_at: locked ? new Date().toISOString() : null })
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, message: friendly(error.message) };
  if (!data?.length) return { ok: false, message: "Không tìm thấy thành viên." };
  refresh();
  return { ok: true, message: locked ? "Đã khóa: người này không vào được shop nữa." : "Đã mở khóa." };
}

/** Đặt lại mật khẩu cho người quên mật khẩu (chỉ người mình quản lý, không thuộc shop khác). */
export async function resetMemberPassword(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const userId = String(form.get("userId") ?? "");
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
  const bad = checkPassword(password);
  if (bad) return { ok: false, message: bad };
  const target = await memberRole(ctx.supabase, ctx.org.id, userId);
  if (!target) return { ok: false, message: "Không tìm thấy thành viên." };
  if (target === "owner" && userId !== ctx.me) return { ok: false, message: "Không đặt lại mật khẩu cho Chủ shop khác." };
  if (!managerMayTouch(ctx.org.role, target)) return { ok: false, message: "Quản lý chỉ đặt lại mật khẩu cho Nhân viên." };
  // Chống chiếm tài khoản: chỉ đặt lại khi tài khoản này KHÔNG thuộc shop nào khác
  // (nếu không, Chủ shop A có thể gắn email của người khác vào shop mình rồi đổi mật khẩu của họ).
  const admin = createAdminClient();
  const { count, error: countErr } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("org_id", ctx.org.id);
  if (countErr) return { ok: false, message: "Không kiểm tra được tài khoản, thử lại sau." };
  if ((count ?? 0) > 0) {
    return { ok: false, message: "Tài khoản này còn dùng ở shop khác: nhờ họ tự đổi mật khẩu ở “Tài khoản”." };
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: "Không đặt lại được, thử lại sau." };
  return { ok: true, message: "Đã đặt mật khẩu mới. Gửi cho người đó và nhắc họ đổi lại ở “Tài khoản”." };
}

/** Lưu cấu hình chấm công, ca làm, lương của một người (RLS: chỉ người mình quản lý). */
export async function saveStaffSettings(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const userId = String(form.get("userId") ?? "");
  const s = checkSettings(form);
  if (!s.ok) return { ok: false, message: s.message };
  const target = await memberRole(ctx.supabase, ctx.org.id, userId);
  if (!managerMayTouch(ctx.org.role, target)) return { ok: false, message: "Quản lý chỉ cấu hình được Nhân viên." };
  const { error } = await ctx.supabase
    .from("staff_settings")
    .upsert({ org_id: ctx.org.id, user_id: userId, ...toRow(s.value), updated_by: ctx.me }, { onConflict: "org_id,user_id" });
  if (error) return { ok: false, message: friendly(error.message) };
  refresh();
  return { ok: true, message: "Đã lưu cấu hình." };
}

/** Sao chép cấu hình (chấm công, ca, lương) từ một người sang người đang xem. */
export async function copyStaffSettings(fromUserId: string, toUserId: string): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const target = await memberRole(ctx.supabase, ctx.org.id, toUserId);
  if (!managerMayTouch(ctx.org.role, target)) return { ok: false, message: "Quản lý chỉ cấu hình được Nhân viên." };
  const { data: src } = await ctx.supabase
    .from("staff_settings")
    .select("attendance_mode, location_id, work_days, shift_start, shift_end, late_grace_min, pay_type, base_salary, standard_days, allowance, late_penalty")
    .eq("org_id", ctx.org.id)
    .eq("user_id", fromUserId)
    .maybeSingle();
  if (!src) return { ok: false, message: "Người được chọn chưa có cấu hình (hoặc bạn không được xem)." };
  const { error } = await ctx.supabase
    .from("staff_settings")
    .upsert({ org_id: ctx.org.id, user_id: toUserId, ...src, updated_by: ctx.me }, { onConflict: "org_id,user_id" });
  if (error) return { ok: false, message: friendly(error.message) };
  refresh();
  return { ok: true, message: "Đã sao chép cấu hình. Kiểm tra lại lương cứng trước khi dùng." };
}

/** Thêm địa điểm chấm công GPS (tọa độ lấy từ điện thoại tại shop hoặc dán từ Google Maps). */
export async function addLocation(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const name = String(form.get("name") ?? "").trim();
  const lat = Number(String(form.get("lat") ?? "").replace(",", "."));
  const lng = Number(String(form.get("lng") ?? "").replace(",", "."));
  const radius = Number(form.get("radius") ?? 100);
  if (name.length < 1 || name.length > 80) return { ok: false, message: "Tên địa điểm từ 1 đến 80 ký tự." };
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || (lat === 0 && lng === 0)) {
    return { ok: false, message: "Chưa có tọa độ: bấm “Lấy vị trí hiện tại” khi đang ở shop, hoặc dán tọa độ từ Google Maps." };
  }
  if (!Number.isInteger(radius) || radius < 20 || radius > 2000) return { ok: false, message: "Bán kính từ 20 đến 2000 m." };
  const { error } = await ctx.supabase.from("work_locations").insert({ org_id: ctx.org.id, name, lat, lng, radius_m: radius });
  if (error) return { ok: false, message: friendly(error.message) };
  refresh();
  return { ok: true, message: `Đã thêm địa điểm ${name}.` };
}

export async function removeLocation(id: string): Promise<StaffState> {
  const ctx = await staffAdmin();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.from("work_locations").delete().eq("org_id", ctx.org.id).eq("id", id);
  if (error) return { ok: false, message: friendly(error.message) };
  refresh();
  return { ok: true, message: "Đã xóa địa điểm. Người đang chấm công GPS ở đây cần chọn địa điểm khác." };
}

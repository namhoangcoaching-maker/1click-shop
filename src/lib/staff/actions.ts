"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkNewMember, checkPassword, checkProfile } from "./validate";

export interface StaffState {
  ok?: boolean;
  message?: string;
}

/** Chỉ Chủ shop quản lý nhân viên. Trả về shop + mã người đang thao tác. */
async function ownerOnly() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Tài khoản chưa được gắn vào shop." } as const;
  if (org.role !== "owner") return { error: "Chỉ Chủ shop mới quản lý nhân viên." } as const;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) return { error: "Phiên đăng nhập hết hạn, đăng nhập lại." } as const;
  return { org, me, supabase } as const;
}

/** Người này có đúng là thành viên shop của Chủ đang thao tác không (đọc qua RLS). */
async function isMemberOf(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, userId: string) {
  const { data } = await supabase.from("memberships").select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
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

/**
 * Thêm nhân viên: tạo tài khoản (email + mật khẩu tạm, đã xác nhận) rồi gắn vào shop.
 * Email đã có tài khoản (ví dụ đã là thành viên shop khác) thì chỉ gắn vào shop, KHÔNG đổi mật khẩu của họ.
 */
export async function addMember(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await ownerOnly();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const input = checkNewMember(form);
  if (!input.ok) return { ok: false, message: input.message };
  const { email, password, displayName, role, department } = input.value;

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

  // Gắn vào shop bằng phiên của Chủ (RLS: chỉ Chủ shop thêm được thành viên).
  const ins = await ctx.supabase
    .from("memberships")
    .insert({ org_id: ctx.org.id, user_id: userId, role, display_name: displayName, department });
  if (ins.error) {
    if (created) await admin.auth.admin.deleteUser(userId); // không để lại tài khoản mồ côi
    if (ins.error.code === "23505") return { ok: false, message: "Email này đã là thành viên shop." };
    console.error("Thêm nhân viên lỗi:", ins.error.message);
    return { ok: false, message: "Không thêm được, thử lại sau." };
  }
  refresh();
  return {
    ok: true,
    message: created
      ? `Đã thêm ${displayName}. Gửi cho họ: web shop.nhankhoitu.com.vn, email ${email} và mật khẩu tạm vừa đặt; đăng nhập xong vào “Của tôi” để đổi mật khẩu.`
      : `Đã gắn ${displayName} (${email}) vào shop. Email này đã có tài khoản nên giữ mật khẩu cũ của họ.`,
  };
}

/** Sửa họ tên, bộ phận, vai trò. Không tự đổi vai trò của chính mình. */
export async function updateMember(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await ownerOnly();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const userId = String(form.get("userId") ?? "");
  const p = checkProfile(form);
  if (!p.ok) return { ok: false, message: p.message };
  if (userId === ctx.me && p.value.role !== "owner") {
    return { ok: false, message: "Không tự đổi vai trò của chính mình." };
  }
  const { data, error } = await ctx.supabase
    .from("memberships")
    .update({ display_name: p.value.displayName, department: p.value.department, role: p.value.role })
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    return { ok: false, message: error.message.includes("ít nhất một Chủ") ? "Shop phải còn ít nhất một Chủ." : "Không lưu được." };
  }
  if (!data?.length) return { ok: false, message: "Không tìm thấy thành viên." };
  refresh();
  return { ok: true, message: "Đã lưu." };
}

/** Khóa (nghỉ việc) hoặc mở khóa. Không tự khóa chính mình. */
export async function setMemberLocked(userId: string, locked: boolean): Promise<StaffState> {
  const ctx = await ownerOnly();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (userId === ctx.me) return { ok: false, message: "Không tự khóa tài khoản của mình." };
  const { data, error } = await ctx.supabase
    .from("memberships")
    .update({ disabled_at: locked ? new Date().toISOString() : null })
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    return { ok: false, message: error.message.includes("ít nhất một Chủ") ? "Shop phải còn ít nhất một Chủ." : "Không lưu được." };
  }
  if (!data?.length) return { ok: false, message: "Không tìm thấy thành viên." };
  refresh();
  return { ok: true, message: locked ? "Đã khóa: người này không vào được shop nữa." : "Đã mở khóa." };
}

/** Đặt lại mật khẩu cho nhân viên quên mật khẩu (chỉ người thuộc shop mình, không phải Chủ khác). */
export async function resetMemberPassword(_prev: StaffState, form: FormData): Promise<StaffState> {
  const ctx = await ownerOnly();
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const userId = String(form.get("userId") ?? "");
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
  const bad = checkPassword(password);
  if (bad) return { ok: false, message: bad };
  if (!(await isMemberOf(ctx.supabase, ctx.org.id, userId))) return { ok: false, message: "Không tìm thấy thành viên." };
  const { data: target } = await ctx.supabase
    .from("memberships")
    .select("role")
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .single();
  if (target?.role === "owner" && userId !== ctx.me) {
    return { ok: false, message: "Không đặt lại mật khẩu cho Chủ shop khác." };
  }
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
    return { ok: false, message: "Tài khoản này còn dùng ở shop khác: nhờ họ tự đổi mật khẩu ở “Của tôi”." };
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: "Không đặt lại được, thử lại sau." };
  return { ok: true, message: "Đã đặt mật khẩu mới. Gửi cho nhân viên và nhắc họ đổi lại ở “Của tôi”." };
}

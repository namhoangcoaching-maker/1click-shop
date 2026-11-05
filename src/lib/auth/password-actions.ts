"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { checkPasswordChange } from "@/lib/staff/validate";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface PasswordState {
  ok?: boolean;
  message?: string;
}

/**
 * Tự đổi mật khẩu (mọi vai trò). Phải nhập đúng mật khẩu hiện tại: kiểm tra bằng một lần đăng nhập
 * riêng (không lưu phiên), để người khác cầm máy đang đăng nhập không đổi được mật khẩu.
 */
export async function changeOwnPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const input = checkPasswordChange(form);
  if (!input.ok) return { ok: false, message: input.message };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = claims?.claims?.email as string | undefined;
  if (!email) return { ok: false, message: "Phiên đăng nhập hết hạn, đăng nhập lại." };

  const { url, key } = getSupabaseEnv();
  const probe = createPlainClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = await probe.auth.signInWithPassword({ email, password: input.value.current });
  if (check.error) return { ok: false, message: "Mật khẩu hiện tại không đúng." };
  await probe.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: input.value.next });
  if (error) return { ok: false, message: "Không đổi được mật khẩu, thử lại sau." };
  return { ok: true, message: "Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới." };
}

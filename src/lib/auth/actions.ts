"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkLoginInput, loginErrorMessage } from "./login";
import { LOGIN_PATH, safeNextPath } from "./paths";

export interface LoginState {
  error?: string;
  /** Giữ lại email đã gõ khi đăng nhập lỗi. */
  email?: string;
}

/** Đăng nhập bằng email + mật khẩu (tài khoản do quản trị tạo sẵn trên Supabase). */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const check = checkLoginInput(rawEmail, formData.get("password"));
  if (!check.ok) {
    return { error: check.error, email: typeof rawEmail === "string" ? rawEmail : "" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(check.value);
  if (error) {
    return { error: loginErrorMessage(error.code), email: check.value.email };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

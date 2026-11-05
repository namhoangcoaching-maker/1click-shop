"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PasswordState } from "@/lib/auth/password-actions";
import { PASSWORD_MIN } from "@/lib/staff/validate";
import { cn } from "@/lib/utils";

const input = "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-primary";

/** Tự đổi mật khẩu (cần mật khẩu hiện tại). */
export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeOwnPassword, {});
  return (
    <form action={action} className="max-w-sm space-y-2.5">
      <label className="block text-sm">
        Mật khẩu hiện tại
        <input name="current" type="password" required autoComplete="current-password" className={input} />
      </label>
      <label className="block text-sm">
        Mật khẩu mới (ít nhất {PASSWORD_MIN} ký tự)
        <input name="next" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" className={input} />
      </label>
      <label className="block text-sm">
        Nhập lại mật khẩu mới
        <input name="confirm" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Đang đổi…" : "Đổi mật khẩu"}
      </button>
      {state.message && (
        <p role="status" className={cn("text-sm", state.ok ? "text-success" : "text-destructive")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

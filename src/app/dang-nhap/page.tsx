import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

/**
 * Trang Đăng nhập. Chưa mở đăng ký công khai: tài khoản do quản trị tạo trên Supabase
 * (Authentication → Users → Add user), xem HUONG_DAN.md.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            1C
          </span>
          <span className="text-xl font-bold">1Click</span>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Đăng nhập</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Quản trị vận hành shop của bạn trong một nơi.
          </p>
          <Suspense fallback={<div className="h-56" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị 1Click để được cấp.
        </p>
      </div>
    </main>
  );
}

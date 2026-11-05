import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { KeyRoundIcon, UserRoundIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { PasswordForm } from "@/components/staff/password-form";
import { getCurrentOrg } from "@/lib/org/current";
import { roleLabel } from "@/lib/org/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tài khoản" };

/** Thông tin tài khoản và đổi mật khẩu (mọi vai trò). */
export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Tài khoản</h1>
      <Suspense fallback={<Skeleton className="h-24 bg-card" />}>
        <Me />
      </Suspense>
      <Panel title="Đổi mật khẩu" icon={KeyRoundIcon} tone="slate">
        <PasswordForm />
      </Panel>
    </main>
  );
}

async function Me() {
  await connection();
  const [org, supabase] = await Promise.all([getCurrentOrg(), createClient()]);
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? "";
  return (
    <Panel title={org?.displayName ?? email} icon={UserRoundIcon} tone="blue">
      <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{email}</dd>
        <dt className="text-muted-foreground">Shop</dt>
        <dd>{org?.name ?? "Chưa được gắn vào shop"}</dd>
        {org && (
          <>
            <dt className="text-muted-foreground">Vai trò</dt>
            <dd>{roleLabel(org.role)}</dd>
          </>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Họ tên, bộ phận do Chủ shop / Quản lý đặt ở Cấu hình nhân sự.</p>
    </Panel>
  );
}

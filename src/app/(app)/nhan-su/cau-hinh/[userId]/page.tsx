import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, ClockIcon, IdCardIcon, TargetIcon } from "lucide-react";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { AccountActions, CopySettings, ProfileForm, SettingsForm } from "@/components/staff/member-manager";
import { formatVND } from "@/lib/format";
import { getManagerOrg } from "@/lib/org/guard";
import { roleLabel } from "@/lib/org/roles";
import { createClient } from "@/lib/supabase/server";
import { getLocations, getMembers } from "@/lib/staff/data";
import { assignableRoles, canManage } from "@/lib/staff/permissions";
import { DEFAULT_SETTINGS, dailyRate } from "@/lib/staff/settings";

export const metadata: Metadata = { title: "Cấu hình nhân sự" };

export default function MemberConfigPage({ params }: PageProps<"/nhan-su/cau-hinh/[userId]">) {
  return (
    <main className="mx-auto w-full max-w-[900px] space-y-4 px-4 py-4 md:px-6">
      <Link href="/nhan-su/cau-hinh" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Cấu hình nhân sự
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px] bg-card" />}>
        <MemberConfig params={params} />
      </Suspense>
    </main>
  );
}

async function MemberConfig({ params }: Pick<PageProps<"/nhan-su/cau-hinh/[userId]">, "params">) {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const { userId } = await params;
  const [members, locations, supabase] = await Promise.all([getMembers(org.id), getLocations(org.id), createClient()]);
  const m = members.find((x) => x.userId === userId);
  if (!m) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  const isMe = claims?.claims?.sub === userId;

  if (!canManage(org.role, m.role)) {
    return (
      <Panel title={m.displayName ?? m.email ?? "Thành viên"} icon={IdCardIcon}>
        <p className="text-sm text-muted-foreground">
          {roleLabel(m.role)} – chỉ Chủ shop xem và cấu hình được người này.
        </p>
      </Panel>
    );
  }

  const settings = m.settings ?? DEFAULT_SETTINGS;
  const sources = members
    .filter((x) => x.userId !== userId && x.settings && canManage(org.role, x.role))
    .map((x) => ({ userId: x.userId, label: `${x.displayName ?? x.email}${x.department ? ` (${x.department})` : ""}` }));

  return (
    <>
      <div>
        <h1 className="text-xl font-bold">{m.displayName ?? "(chưa đặt tên)"}</h1>
        <p className="text-sm text-muted-foreground">
          {m.email} · {roleLabel(m.role)}
          {m.department ? ` · ${m.department}` : ""}
          {m.disabledAt ? " · ĐÃ KHÓA" : ""}
        </p>
      </div>

      <Panel title="Thông tin" icon={IdCardIcon} tone="blue">
        <div className="space-y-4">
          <ProfileForm
            userId={userId}
            displayName={m.displayName}
            department={m.department}
            role={m.role}
            roles={assignableRoles(org.role)}
            isMe={isMe}
          />
          {!isMe && <AccountActions userId={userId} locked={m.disabledAt !== null} canReset={m.role !== "owner"} />}
        </div>
      </Panel>

      <Panel title="Chấm công, ca làm, lương" icon={ClockIcon} tone="green">
        <div className="space-y-4">
          {!m.settings && <p className="text-sm text-warning">Chưa cấu hình: đang hiện giá trị mặc định, bấm “Lưu cấu hình” để áp dụng.</p>}
          {m.settings && m.settings.baseSalary > 0 && (
            <p className="text-sm text-muted-foreground">
              Một ngày công đủ ≈ <b className="text-foreground">{formatVND(dailyRate(m.settings))}</b>
            </p>
          )}
          <CopySettings toUserId={userId} sources={sources} />
          <SettingsForm userId={userId} settings={settings} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
        </div>
      </Panel>

      <NoDataPanel
        title="KPI"
        icon={TargetIcon}
        stage="Bước 6.6"
        note="Chọn mẫu KPI cho người này: % doanh số, theo số lượng, bậc thang theo % chỉ tiêu, tỷ lệ hoàn thành công việc, trừ phạt."
      />
    </>
  );
}

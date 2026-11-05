import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { formatVND } from "@/lib/format";
import { getManagerOrg } from "@/lib/org/guard";
import { roleLabel } from "@/lib/org/roles";
import { getMembers } from "@/lib/staff/data";
import { canManage } from "@/lib/staff/permissions";
import { PAY_LABELS, dailyRate, describeShift } from "@/lib/staff/settings";

export const metadata: Metadata = { title: "Nhân sự" };

/** Nhân sự tổng quát (Chủ, Quản lý). Chấm công hôm nay, ngày công, KPI, lương dự kiến: bước 6.3–6.6. */
export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Nhân sự</h1>
        <Link href="/nhan-su/cau-hinh" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
          <SlidersHorizontalIcon className="size-4" aria-hidden />
          Cấu hình nhân sự
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-80 bg-card" />}>
        <Overview />
      </Suspense>
    </main>
  );
}

async function Overview() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const members = (await getMembers(org.id)).filter((m) => !m.disabledAt);

  return (
    <Panel title={`${members.length} người đang làm`} icon={UsersIcon}>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Nhân sự</th>
              <th className="px-3 py-2 font-normal">Chấm công</th>
              <th className="px-3 py-2 font-normal">Ca làm</th>
              <th className="px-3 py-2 font-normal">Lương cứng</th>
              <th className="px-3 py-2 font-normal text-muted-foreground/70">Hôm nay</th>
              <th className="px-3 py-2 font-normal text-muted-foreground/70">Ngày công</th>
              <th className="px-3 py-2 font-normal text-muted-foreground/70">Lương dự kiến</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const s = m.settings;
              const manageable = canManage(org.role, m.role);
              return (
                <tr key={m.userId} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 pr-3">
                    {manageable ? (
                      <Link href={`/nhan-su/cau-hinh/${m.userId}`} className="font-medium text-primary hover:underline">
                        {m.displayName ?? m.email}
                      </Link>
                    ) : (
                      <span className="font-medium">{m.displayName ?? m.email}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {roleLabel(m.role)}
                      {m.department ? ` · ${m.department}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{s ? (s.attendanceMode === "gps" ? "GPS tại shop" : "Online tại nhà") : "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{s ? describeShift(s) : "—"}</td>
                  <td className="px-3 py-2.5">
                    {s && s.baseSalary > 0 ? (
                      <>
                        <div className="whitespace-nowrap tabular-nums">{formatVND(s.baseSalary)}</div>
                        <div className="text-xs text-muted-foreground">
                          {PAY_LABELS[s.payType]}
                          {s.payType === "monthly" ? ` · ≈ ${formatVND(dailyRate(s))}/ngày` : ""}
                        </div>
                      </>
                    ) : manageable ? (
                      <span className="text-warning">Chưa cấu hình</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground/70">6.3</td>
                  <td className="px-3 py-2.5 text-muted-foreground/70">6.3</td>
                  <td className="px-3 py-2.5 text-muted-foreground/70">6.4</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cột Hôm nay (đã vào ca chưa), Ngày công có ở bước 6.3 Chấm công; Lương dự kiến, KPI, bấm vào từng người xem chi
        tiết có ở bước 6.4–6.6. Bấm tên để cấu hình.
      </p>
    </Panel>
  );
}

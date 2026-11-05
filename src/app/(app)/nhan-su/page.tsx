import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarCheckIcon, ListTodoIcon, SlidersHorizontalIcon, TargetIcon, UsersIcon } from "lucide-react";
import { reportedUsers } from "@/lib/staff/work-plan-data";
import { dayLabel } from "@/components/staff/attendance-view";
import { todayInVN } from "@/lib/date-range";
import { monthRange } from "@/lib/finance/month";
import { formatUnits, personMonth, vnTimeOf } from "@/lib/staff/attendance";
import { getAttendance } from "@/lib/staff/attendance-data";
import { estimatePay } from "@/lib/staff/payroll";
import { getKpiMonth } from "@/lib/staff/kpi-data";
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
        <div className="flex flex-wrap gap-2">
          <Link href="/nhan-su/cham-cong" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <CalendarCheckIcon className="size-4" aria-hidden />
            Bảng chấm công
          </Link>
          <Link href="/nhan-su/bao-cao-ngay" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <ListTodoIcon className="size-4" aria-hidden />
            Báo cáo ngày
          </Link>
          <Link href="/nhan-su/kpi" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <TargetIcon className="size-4" aria-hidden />
            KPI
          </Link>
          <Link href="/nhan-su/cau-hinh" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <SlidersHorizontalIcon className="size-4" aria-hidden />
            Cấu hình nhân sự
          </Link>
        </div>
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
  const today = todayInVN();
  const { from, to } = monthRange(today.slice(0, 7));
  const [all, rows, reported] = await Promise.all([getMembers(org.id), getAttendance(org.id, from, today), reportedUsers(org.id, today)]);
  const members = all.filter((m) => !m.disabledAt);
  // Bảng công + KPI + lương dự kiến của người mình được quản lý (đã có cấu hình).
  const managed = members.filter((m) => m.settings && canManage(org.role, m.role));
  const kpi = await getKpiMonth(
    org.id,
    today.slice(0, 7),
    today,
    managed.map((m) => ({ userId: m.userId, department: m.department, sellerId: m.settings!.pancakeSellerId ?? null })),
  );
  const calc = new Map(
    managed.map((m) => {
      const pm = personMonth(rows.filter((r) => r.userId === m.userId), m.settings!.workDays, from, to, today);
      const k = kpi.totalByUser.get(m.userId) ?? 0;
      return [m.userId, { pm, kpi: k, pay: m.settings!.baseSalary > 0 ? estimatePay(m.settings!, pm, k) : null }] as const;
    }),
  );
  const totalSofar = [...calc.values()].reduce((s, c) => s + (c.pay?.sofar.total ?? 0), 0);
  const totalMonth = [...calc.values()].reduce((s, c) => s + (c.pay?.month.total ?? 0), 0);

  return (
    <Panel
      title={`${members.length} người đang làm`}
      icon={UsersIcon}
      action={
        totalSofar > 0 ? (
          <div className="text-right text-sm">
            <div className="text-xs text-muted-foreground">Quỹ lương dự kiến tháng {today.slice(5, 7)}</div>
            <div className="font-semibold tabular-nums">
              {formatVND(totalSofar)} <span className="font-normal text-muted-foreground">tới hôm nay · ước {formatVND(totalMonth)}</span>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Nhân sự</th>
              <th className="px-3 py-2 font-normal">Chấm công</th>
              <th className="px-3 py-2 font-normal">Ca làm</th>
              <th className="px-3 py-2 font-normal">Lương cứng</th>
              <th className="px-3 py-2 font-normal">Hôm nay</th>
              <th className="px-3 py-2 font-normal">Công tháng này</th>
              <th className="px-3 py-2 text-right font-normal">Lương dự kiến</th>
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
                  {calc.has(m.userId) ? (
                    (() => {
                      const { pm } = calc.get(m.userId)!;
                      const t = pm.days.find((d) => d.date === today)!;
                      const l = dayLabel(t);
                      return (
                        <>
                          <td className={`px-3 py-2.5 whitespace-nowrap ${l.className}`}>
                            {t.row?.checkInAt ? `${vnTimeOf(t.row.checkInAt)}${t.row.checkOutAt ? `–${vnTimeOf(t.row.checkOutAt)}` : ""} · ` : ""}
                            {l.text}
                            <div className={`text-xs ${reported.has(m.userId) ? "text-success" : "text-muted-foreground"}`}>
                              {reported.has(m.userId) ? "Đã gửi báo cáo" : "Chưa gửi báo cáo"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                            {formatUnits(pm.summary.units)}
                            {pm.summary.lateCount + pm.summary.missingOut > 0 && (
                              <div className="text-xs text-warning">
                                {pm.summary.lateCount > 0 ? `${pm.summary.lateCount} muộn` : ""}
                                {pm.summary.lateCount > 0 && pm.summary.missingOut > 0 ? " · " : ""}
                                {pm.summary.missingOut > 0 ? `${pm.summary.missingOut} thiếu giờ ra` : ""}
                              </div>
                            )}
                          </td>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <td className="px-3 py-2.5 text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-muted-foreground">—</td>
                    </>
                  )}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {calc.get(m.userId)?.pay ? (
                      <>
                        <div className="font-medium tabular-nums">{formatVND(calc.get(m.userId)!.pay!.sofar.total)}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">ước {formatVND(calc.get(m.userId)!.pay!.month.total)}</div>
                        {calc.get(m.userId)!.kpi !== 0 && (
                          <div className={`text-xs tabular-nums ${calc.get(m.userId)!.kpi < 0 ? "text-destructive" : "text-success"}`}>
                            gồm KPI {calc.get(m.userId)!.kpi > 0 ? "+" : "−"}
                            {formatVND(Math.abs(calc.get(m.userId)!.kpi))}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Công và lương dự kiến tính tới hôm nay theo bảng chấm công; “ước” = nếu đi làm đủ các ngày còn lại. Lương dự
        kiến chỉ để xem: Lợi nhuận và Dòng tiền vẫn trừ theo phiếu chi thẻ Lương trên Pancake. Sửa công ở Bảng chấm công;
        bấm tên để cấu hình.
      </p>
    </Panel>
  );
}

import { TriangleAlertIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsetBox, Panel, ProgressBar } from "@/components/dashboard/panel";
import { formatDateVN, type DateString } from "@/lib/date-range";
import { formatNumber, formatPercent, formatVND } from "@/lib/format";
import type { AttendanceStatus, StaffSummary as StaffData } from "@/lib/overview/types";

const ATTENDANCE: Record<AttendanceStatus, { label: string; dot: string }> = {
  on_time: { label: "Đúng giờ", dot: "bg-success" },
  late: { label: "Đi muộn", dot: "bg-warning" },
  absent: { label: "Chưa check-in", dot: "bg-destructive" },
};

/** Cột phụ bên phải trang Tổng quan: chấm công, KPI, lương tạm tính, hiệu suất. */
export function StaffSummary({ staff, today }: { staff: StaffData; today: DateString }) {
  const checkedIn = staff.attendance.filter((a) => a.status !== "absent").length;

  return (
    <Panel title="Nhân sự" icon={UsersIcon}>
      <div className="space-y-5">
        <section>
          <SubHeading
            title="Chấm công hôm nay"
            right={`${checkedIn}/${staff.attendance.length} đã check-in`}
          />
          <ul className="space-y-1.5">
            {staff.attendance.map((person) => {
              const status = ATTENDANCE[person.status];
              return (
                <li key={person.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{person.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <span className={cn("size-2 rounded-full", status.dot)} aria-hidden />
                    {status.label}
                    {person.lateMinutes ? ` ${person.lateMinutes}′` : ""}
                    {person.checkIn && <span className="tabular-nums text-foreground">{person.checkIn}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <SubHeading title="Tiến độ KPI tháng" />
          <ul className="space-y-3">
            {staff.kpi.map((person) => (
              <li key={person.name} className="space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{person.name}</span>
                  <span className="font-semibold tabular-nums">{formatPercent(person.progress, 0)}</span>
                </div>
                <ProgressBar
                  value={person.progress}
                  tone={person.progress >= 100 ? "green" : "blue"}
                  label={`KPI ${person.name}`}
                />
                <div className="text-xs text-muted-foreground">
                  {person.gapToNextTier === null
                    ? "Đã đạt bậc thưởng cao nhất"
                    : `Còn thiếu ${formatVND(person.gapToNextTier)} doanh số để lên bậc thưởng tiếp`}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SubHeading title="Lương tạm tính tháng này" />
          <InsetBox>
            <div className="text-xl font-semibold tabular-nums">{formatVND(staff.payrollToDate)}</div>
            <div className="text-xs text-muted-foreground">
              Tính đến hôm nay {formatDateVN(today)}, gồm ngày công, phụ cấp, KPI
            </div>
          </InsetBox>
        </section>

        <section>
          <SubHeading title="Hiệu suất bán hàng" />
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-1.5 text-left font-normal">Nhân viên</th>
                <th className="py-1.5 text-right font-normal">Đơn</th>
                <th className="py-1.5 text-right font-normal">Doanh thu</th>
                <th className="py-1.5 text-right font-normal">Chốt</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {staff.performance.map((p) => (
                <tr key={p.name} className="border-b last:border-0">
                  <td className="max-w-28 truncate py-2">{p.name}</td>
                  <td className="py-2 text-right">{formatNumber(p.orders)}</td>
                  <td className="py-2 text-right font-medium">{formatVND(p.revenue)}</td>
                  <td className="py-2 text-right">{formatPercent(p.closeRate, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.unassignedOrders > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
              {formatNumber(staff.unassignedOrders)} đơn chưa gán nhân viên (chỉ có “Hệ thống”) nên chưa
              tính vào bảng này.
            </p>
          )}
        </section>
      </div>
    </Panel>
  );
}

function SubHeading({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {right && <span className="text-xs text-muted-foreground">{right}</span>}
    </div>
  );
}

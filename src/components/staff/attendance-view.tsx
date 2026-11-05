import { formatDuration, formatUnits, vnTimeOf, weekday, type DayResult, type MonthSummary } from "@/lib/staff/attendance";
import { DAY_LABELS } from "@/lib/staff/settings";
import { cn } from "@/lib/utils";

/** Chữ + màu trạng thái một ngày. */
export function dayLabel(d: DayResult): { text: string; className: string } {
  switch (d.status) {
    case "done":
      return d.late
        ? { text: `${formatUnits(d.units)} · muộn ${d.lateMin}′`, className: "text-warning" }
        : { text: formatUnits(d.units), className: d.units < 1 ? "text-foreground" : "text-success" };
    case "working":
      return { text: d.late ? `Đang làm · muộn ${d.lateMin}′` : "Đang làm", className: d.late ? "text-warning" : "text-primary" };
    case "missing_out":
      return { text: "Thiếu giờ ra", className: "text-warning font-medium" };
    case "absent":
      return { text: "Vắng", className: "text-destructive" };
    case "pending":
      return { text: "Chưa vào", className: "text-muted-foreground" };
    case "off":
      return { text: "Nghỉ", className: "text-muted-foreground/60" };
    default:
      return { text: "", className: "" };
  }
}

const shortDate = (d: string) => `${DAY_LABELS[weekday(d) - 1]} ${d.slice(8)}/${d.slice(5, 7)}`;

/** Tổng hợp tháng: công, giờ, muộn, thiếu giờ ra, vắng. */
export function SummaryLine({ s }: { s: MonthSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div className="rounded-md bg-muted px-3 py-2">
        <div className="text-xs text-muted-foreground">Ngày công</div>
        <div className="text-lg font-semibold tabular-nums">{formatUnits(s.units)}</div>
      </div>
      <div className="rounded-md bg-muted px-3 py-2">
        <div className="text-xs text-muted-foreground">Giờ làm trong ca</div>
        <div className="text-lg font-semibold tabular-nums">{formatDuration(s.workedMin)}</div>
      </div>
      <div className="rounded-md bg-muted px-3 py-2">
        <div className="text-xs text-muted-foreground">Đi muộn</div>
        <div className={cn("text-lg font-semibold tabular-nums", s.lateCount > 0 && "text-warning")}>{s.lateCount} lần</div>
      </div>
      <div className="rounded-md bg-muted px-3 py-2">
        <div className="text-xs text-muted-foreground">Vắng / thiếu giờ ra</div>
        <div className={cn("text-lg font-semibold tabular-nums", s.absent + s.missingOut > 0 && "text-destructive")}>
          {s.absent} / {s.missingOut}
        </div>
      </div>
    </div>
  );
}

/** Bảng công từng ngày của một người (mới nhất trước, bỏ ngày tương lai). */
export function DayList({ days }: { days: DayResult[] }) {
  const shown = days.filter((d) => d.status !== "future").reverse();
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">Chưa có ngày nào.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-2 font-normal">Ngày</th>
          <th className="px-2 py-1.5 font-normal">Vào</th>
          <th className="px-2 py-1.5 font-normal">Ra</th>
          <th className="py-1.5 pl-2 text-right font-normal">Công</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((d) => {
          const l = dayLabel(d);
          return (
            <tr key={d.date} className="border-b last:border-0">
              <td className="py-1.5 pr-2 whitespace-nowrap">{shortDate(d.date)}</td>
              <td className="px-2 py-1.5 tabular-nums">{d.row?.checkInAt ? vnTimeOf(d.row.checkInAt) : "—"}</td>
              <td className="px-2 py-1.5 tabular-nums">{d.row?.checkOutAt ? vnTimeOf(d.row.checkOutAt) : "—"}</td>
              <td className={cn("py-1.5 pl-2 text-right", l.className)}>
                {l.text}
                {d.row?.editNote && <div className="text-xs text-muted-foreground">Đã sửa: {d.row.editNote}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

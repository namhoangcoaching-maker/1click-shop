import { formatVND } from "@/lib/format";
import { formatDuration, formatUnits } from "@/lib/staff/attendance";
import type { PayEstimate } from "@/lib/staff/payroll";
import { PAY_LABELS, type StaffSettings } from "@/lib/staff/settings";

function Row({ label, value, sign, muted }: { label: string; value: number; sign?: "+" | "−"; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span>
        {sign && <span className="mr-1 inline-block w-3 text-muted-foreground">{sign}</span>}
        {label}
      </span>
      <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>
    </div>
  );
}

/** Bảng tính lương dự kiến của một người: tới hôm nay + ước cả tháng. */
export function PayBreakdown({ s, e }: { s: StaffSettings; e: PayEstimate }) {
  const p = e.sofar;
  const basis =
    s.payType === "monthly"
      ? `${formatVND(s.baseSalary)} ÷ ${formatUnits(s.standardDays)} × ${formatUnits(p.units)} công`
      : s.payType === "daily"
        ? `${formatVND(s.baseSalary)} × ${formatUnits(p.units)} công`
        : `${formatVND(s.baseSalary)}/giờ × ${formatDuration(Math.round(p.hours * 60))}`;
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted px-3 py-2">
          <div className="text-xs text-muted-foreground">Tới hôm nay</div>
          <div className="text-xl font-semibold tabular-nums">{formatVND(p.total)}</div>
        </div>
        <div className="rounded-md bg-muted px-3 py-2">
          <div className="text-xs text-muted-foreground">Ước cả tháng (đi làm đủ các ngày còn lại)</div>
          <div className="text-xl font-semibold tabular-nums text-success">{formatVND(e.month.total)}</div>
        </div>
      </div>
      <Row label={`Lương cứng (${basis})`} value={p.base} />
      {s.allowance > 0 && <Row label={`Phụ cấp (${formatVND(s.allowance)} theo tỷ lệ công)`} value={p.allowance} sign="+" />}
      {p.latePenalty > 0 && <Row label={`Phạt đi muộn (${p.lateCount} lần × ${formatVND(s.latePenalty)})`} value={p.latePenalty} sign="−" />}
      <p className="mt-2 text-xs text-muted-foreground">
        {PAY_LABELS[s.payType]}. Số dự kiến theo bảng chấm công, chưa gồm KPI / thưởng; lương chốt khi Chủ shop trả.
      </p>
    </div>
  );
}

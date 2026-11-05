import { formatVND } from "@/lib/format";
import type { PersonKpi } from "@/lib/staff/kpi-data";
import { describeFormula, isRevenueSource } from "@/lib/staff/kpi";
import { cn } from "@/lib/utils";

/** Số tiền (₫) hoặc số lượng kèm đơn vị. */
export function KpiValue({ value, unit }: { value: number; unit: string }) {
  if (unit === "₫") return <>{formatVND(value)}</>;
  return (
    <>
      {(Math.round(value * 100) / 100).toLocaleString("vi-VN")} {unit}
    </>
  );
}

/** KPI của một người (trang Của tôi): mỗi KPI một dòng, có thanh % hoàn thành. */
export function MyKpiList({ items }: { items: PersonKpi[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Bạn chưa được gắn KPI nào.</p>;
  return (
    <div className="space-y-3">
      {items.map(({ assignment: a, template: t, outcome: o, note }) => {
        const unit = isRevenueSource(t.source) ? "₫" : (t.unitLabel ?? "lần");
        const pct = o.completion === null ? null : Math.min(100, Math.max(0, o.completion));
        return (
          <div key={a.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{t.name}</span>
              <span className={cn("font-semibold tabular-nums", o.amount < 0 ? "text-destructive" : "text-success")}>
                {o.amount < 0 ? "−" : "+"}
                {formatVND(Math.abs(o.amount))}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{describeFormula(t)}</div>
            <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs">
              <span>
                Thực tế:{" "}
                {o.actual === null ? (
                  <span className="text-warning">{t.source === "manual" ? "chưa nhập" : "chưa có"}</span>
                ) : (
                  <b className="tabular-nums">
                    <KpiValue value={o.actual} unit={unit} />
                  </b>
                )}
                {note && <span className="text-muted-foreground"> ({note})</span>}
              </span>
              {a.target !== null && (
                <span>
                  Chỉ tiêu:{" "}
                  <b className="tabular-nums">
                    <KpiValue value={a.target} unit={unit} />
                  </b>
                  {o.completion !== null && ` · ${String(o.completion).replace(".", ",")}%`}
                </span>
              )}
            </div>
            {pct !== null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

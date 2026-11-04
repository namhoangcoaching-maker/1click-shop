import { ChevronRightIcon, OctagonAlertIcon } from "lucide-react";
import { formatDecimal, formatNumber, formatVelocity } from "@/lib/format";
import type { ProductAlarm } from "@/lib/inventory/alarms";
import type { StockAnalysis } from "@/lib/inventory/stock";
import { cn } from "@/lib/utils";
import { StockStatusChip } from "./stock-status";

/**
 * Báo động tồn kho theo MẪU: mỗi dòng một mẫu, bấm vào xổ ra từng màu/size
 * (còn bao nhiêu, kể cả âm; bán bao nhiêu/ngày; có cần đặt không).
 */
export function StockAlarms({ groups, safetyDays }: { groups: ProductAlarm[]; safetyDays: number }) {
  if (groups.length === 0) return null;
  const sizes = groups.reduce((n, g) => n + g.alarmCount, 0);

  return (
    <section aria-label="Báo động tồn kho" className="rounded-lg border border-destructive/40 bg-card">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2">
        <OctagonAlertIcon className="size-4 text-destructive" aria-hidden />
        <span className="font-semibold text-destructive">Báo động: {groups.length} mẫu cần sản xuất ngay</span>
        <span className="text-sm text-muted-foreground">({sizes} màu/size thiếu · bấm vào mẫu để xem từng size)</span>
      </header>
      <ul className="max-h-[32rem] divide-y overflow-y-auto">
        {groups.map((g) => (
          <li key={g.productId}>
            {/* Người dùng có thể bấm mở trước khi trang tải xong: không coi là lệch. */}
            <details className="group" suppressHydrationWarning>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  aria-hidden
                />
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">
                  {g.alarmCount}/{g.variants.length} size thiếu
                  {g.worstStatus === "out" && " · có size đã hết"}
                </span>
                <span className="ml-auto font-semibold tabular-nums">Đặt ngay {formatNumber(g.totalSuggested)} cái</span>
              </summary>
              <VariantTable variants={g.variants} safetyDays={safetyDays} />
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VariantTable({ variants, safetyDays }: { variants: StockAnalysis[]; safetyDays: number }) {
  return (
    <div className="overflow-x-auto bg-muted/40 px-4 pt-1 pb-3">
      <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 text-left font-normal">Màu / Size</th>
            <th className="px-3 py-1.5 text-right font-normal">Có thể bán</th>
            <th className="px-3 py-1.5 text-right font-normal">Bán / ngày</th>
            <th className="px-3 py-1.5 text-right font-normal">Đủ bán</th>
            <th className="px-3 py-1.5 text-left font-normal">Trạng thái</th>
            <th className="py-1.5 pl-3 text-right font-normal">Nên đặt</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {variants.map((v) => {
            const alarm = v.status === "out" || v.status === "urgent";
            return (
              <tr key={v.item.id ?? v.item.sku} className="border-t border-border/60">
                <td className="py-1.5 pr-3">
                  <span className={cn(alarm && "font-medium")}>{v.item.variant ?? v.item.sku}</span>{" "}
                  <span className="text-xs text-muted-foreground">{v.item.sku}</span>
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right font-semibold",
                    v.item.stock < 0 && "text-destructive",
                  )}
                >
                  {formatNumber(v.item.stock)}
                </td>
                <td className="px-3 py-1.5 text-right">{formatVelocity(v.velocity)}</td>
                <td className={cn("px-3 py-1.5 text-right", alarm && "font-semibold text-destructive")}>
                  {v.daysOfStock === Infinity ? "Không bán" : `${formatDecimal(v.daysOfStock)} ngày`}
                </td>
                <td className="px-3 py-1.5" title={`Cần đủ bán ${v.requiredDays} ngày (SX ${v.leadTimeDays}${v.leadTimeIsDefault ? " mặc định" : ""} + dự phòng ${safetyDays})`}>
                  <StockStatusChip status={v.status} />
                </td>
                <td className="py-1.5 pl-3 text-right font-semibold">
                  {v.suggestedQuantity > 0 ? formatNumber(v.suggestedQuantity) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

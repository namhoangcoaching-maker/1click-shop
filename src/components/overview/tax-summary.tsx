import { LandmarkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyValue, Panel, ProgressBar } from "@/components/dashboard/panel";
import { daysUntil, formatDateVN, type DateString } from "@/lib/date-range";
import { formatNumber, formatPercent, ratio } from "@/lib/format";
import type { TaxSummary as TaxSummaryData } from "@/lib/overview/types";

/** Còn từ 7 ngày trở xuống thì tô đỏ (trùng mốc nhắc trước 7 ngày trong brief). */
const URGENT_DAYS = 7;

/** Thuế: tỷ lệ đơn đã xuất hóa đơn, hóa đơn cần điều chỉnh, các hạn sắp tới. */
export function TaxSummary({ tax, today }: { tax: TaxSummaryData; today: DateString }) {
  const invoicedRate = ratio(tax.invoicedOrders, tax.totalOrders);
  const uninvoiced = tax.totalOrders - tax.invoicedOrders;

  return (
    <Panel title="Thuế & hóa đơn" icon={LandmarkIcon} tone="slate">
      <p className="mb-3 text-xs text-muted-foreground">{tax.profile}</p>

      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Đơn đã xuất hóa đơn</span>
        <span className="tabular-nums">
          <span className="font-semibold">{formatNumber(tax.invoicedOrders)}</span>
          <span className="text-muted-foreground">
            /{formatNumber(tax.totalOrders)} ({formatPercent(invoicedRate, 0)})
          </span>
        </span>
      </div>
      <ProgressBar value={invoicedRate} tone="green" label="Tỷ lệ đơn đã xuất hóa đơn" className="mb-2" />

      <KeyValue
        label="Hóa đơn cần điều chỉnh"
        value={<span className={cn(tax.invoicesToAdjust > 0 && "text-destructive")}>{tax.invoicesToAdjust}</span>}
      />
      <KeyValue label="Đơn chưa xuất hóa đơn" value={formatNumber(uninvoiced)} />

      <h3 className="mt-3 mb-1 text-sm font-medium">Hạn sắp tới</h3>
      <ul className="space-y-1.5">
        {tax.deadlines.map((deadline) => {
          const left = daysUntil(deadline.date, today);
          return (
            <li key={deadline.title} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div>{deadline.title}</div>
                <div className="text-xs text-muted-foreground">{formatDateVN(deadline.date)}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                  left <= URGENT_DAYS ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                )}
              >
                {left < 0 ? `Quá hạn ${-left} ngày` : left === 0 ? "Hôm nay" : `Còn ${left} ngày`}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t pt-2 text-xs text-muted-foreground italic">
        Thông tin tham khảo, vui lòng xác nhận với kế toán hoặc cơ quan thuế.
      </p>
    </Panel>
  );
}

import { ExternalLinkIcon, StoreIcon } from "lucide-react";
import { Panel, ProgressBar } from "@/components/dashboard/panel";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import { formatNumber, formatPercent, formatVND, percentChange, ratio } from "@/lib/format";
import type { OrderSourceRow } from "@/lib/overview/types";

/** Bảng doanh thu, lợi nhuận, đơn chốt theo từng nguồn đơn (Shopee, TikTok, Facebook…). */
export function OrderSources({ rows }: { rows: OrderSourceRow[] }) {
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue.value, 0);
  const hasPrevious = rows.some((r) => r.revenue.previous !== null);
  const totalPrevious = rows.reduce((sum, r) => sum + (r.revenue.previous ?? 0), 0);
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);

  return (
    <Panel
      title="Nguồn đơn"
      icon={StoreIcon}
      action={
        <a
          href="https://pos.pages.fm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Xem chi tiết trên Pancake
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 text-left font-normal">Nguồn</th>
              <th className="px-3 py-2 text-right font-normal">Doanh thu</th>
              {hasPrevious && <th className="px-3 py-2 text-right font-normal">So kỳ trước</th>}
              <th className="px-3 py-2 text-right font-normal">Lợi nhuận</th>
              <th className="px-3 py-2 text-right font-normal">Đơn chốt</th>
              <th className="px-3 py-2 text-right font-normal">GTTB</th>
              <th className="py-2 pl-3 text-left font-normal">Tỷ trọng doanh thu</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => {
              const share = ratio(row.revenue.value, totalRevenue);
              return (
                <tr key={row.source} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 pr-3 font-medium">{row.source}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatVND(row.revenue.value)}</td>
                  {hasPrevious && (
                    <td className="px-3 py-2.5 text-right">
                      {row.revenue.previous !== null && (
                        <TrendBadge change={percentChange(row.revenue.value, row.revenue.previous)} />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">{formatVND(row.profit)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(row.orders)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {formatVND(row.orders ? row.revenue.value / row.orders : 0)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={share} label={`Tỷ trọng ${row.source}`} className="w-24" />
                      <span className="w-14 text-right text-muted-foreground">
                        {formatPercent(share, 1)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t bg-muted/50 font-semibold">
              <td className="py-2.5 pr-3 pl-2">Tổng</td>
              <td className="px-3 py-2.5 text-right">{formatVND(totalRevenue)}</td>
              {hasPrevious && (
                <td className="px-3 py-2.5 text-right">
                  <TrendBadge change={percentChange(totalRevenue, totalPrevious)} />
                </td>
              )}
              <td className="px-3 py-2.5 text-right">{formatVND(totalProfit)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(totalOrders)}</td>
              <td className="px-3 py-2.5 text-right">
                {formatVND(totalOrders ? totalRevenue / totalOrders : 0)}
              </td>
              <td className="py-2.5 pl-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

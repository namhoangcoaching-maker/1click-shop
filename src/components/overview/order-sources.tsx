import { ExternalLinkIcon, StoreIcon } from "lucide-react";
import { Panel, ProgressBar } from "@/components/dashboard/panel";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import type { SourceGroupView } from "@/lib/finance/efficiency";
import { formatPercent, formatVND, percentChange, ratio } from "@/lib/format";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v === null ? "—" : formatPercent(v, 1));
const money = (v: number) => (v ? formatVND(v) : "—");

/**
 * Bảng nguồn đơn (Shopee, TikTok, Facebook…): doanh thu CHƯA trừ phí sàn, phí sàn, chi phí ads,
 * ME/RE = ads ÷ doanh thu, và phí sàn + ads (% doanh thu) để so kênh nào còn lại nhiều hơn.
 * Facebook + Instagram dùng chung một khoản quảng cáo: hai dòng doanh thu, một ô ads/ME/RE chung.
 */
export function OrderSources({ groups }: { groups: SourceGroupView[] }) {
  const rows = groups.flatMap((g) => g.rows);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const hasPrevious = rows.some((r) => r.previous !== null);
  const totalPrevious = rows.reduce((s, r) => s + (r.previous ?? 0), 0);
  const totalFee = rows.reduce((s, r) => s + r.fee, 0);
  const totalAds = groups.reduce((s, g) => s + g.ads, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const hasAds = totalAds > 0;

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
        <table className="w-full min-w-[920px] text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 text-left font-normal">Nguồn</th>
              <th className="px-3 py-2 text-right font-normal" title="Đơn chốt, đã trừ chiết khấu và hàng hoàn, CHƯA trừ phí sàn">
                Doanh thu
              </th>
              {hasPrevious && <th className="px-3 py-2 text-right font-normal">So kỳ trước</th>}
              <th className="px-3 py-2 text-right font-normal">Phí sàn</th>
              <th className="px-3 py-2 text-right font-normal">Chi phí ads</th>
              <th className="px-3 py-2 text-right font-normal" title="Chi phí ads ÷ doanh thu">
                ME/RE
              </th>
              <th className="px-3 py-2 text-right font-normal" title="(Phí sàn + chi phí ads) ÷ doanh thu">
                Phí sàn + ads
              </th>
              <th className="px-3 py-2 text-right font-normal">Lợi nhuận</th>
              <th className="px-3 py-2 text-right font-normal">GTTB</th>
              <th className="py-2 pl-3 text-left font-normal">Tỷ trọng doanh thu</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {groups.map((g) =>
              g.rows.map((row, i) => {
                const share = ratio(row.revenue, totalRevenue);
                const first = i === 0;
                const span = g.rows.length;
                const last = i === span - 1;
                return (
                  <tr key={row.source} className={cn("hover:bg-muted/50", last && "border-b last:border-0")}>
                    <td className="py-2.5 pr-3 font-medium">{row.source}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatVND(row.revenue)}</td>
                    {hasPrevious && (
                      <td className="px-3 py-2.5 text-right">
                        {row.previous !== null && <TrendBadge change={percentChange(row.revenue, row.previous)} />}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right">{money(row.fee)}</td>
                    {first && (
                      <>
                        <td rowSpan={span} className={cn("px-3 py-2.5 text-right", span > 1 && "border-x bg-muted/30")}>
                          {money(g.ads)}
                        </td>
                        <td rowSpan={span} className={cn("px-3 py-2.5 text-right", span > 1 && "border-x bg-muted/30")}>
                          {pct(g.meRe)}
                        </td>
                        <td
                          rowSpan={span}
                          className={cn("px-3 py-2.5 text-right font-medium", span > 1 && "border-x bg-muted/30")}
                        >
                          {pct(g.costPercent)}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-right">{formatVND(row.profit)}</td>
                    <td className="px-3 py-2.5 text-right">{formatVND(row.orders ? row.gross / row.orders : 0)}</td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={share} label={`Tỷ trọng ${row.source}`} className="w-24" />
                        <span className="w-14 text-right text-muted-foreground">{formatPercent(share, 1)}</span>
                      </div>
                    </td>
                  </tr>
                );
              }),
            )}
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
              <td className="px-3 py-2.5 text-right">{money(totalFee)}</td>
              <td className="px-3 py-2.5 text-right">{money(totalAds)}</td>
              <td className="px-3 py-2.5 text-right">{pct(hasAds && totalRevenue ? (totalAds / totalRevenue) * 100 : null)}</td>
              <td className="px-3 py-2.5 text-right">
                {pct(totalRevenue ? ((totalFee + totalAds) / totalRevenue) * 100 : null)}
              </td>
              <td className="px-3 py-2.5 text-right">{formatVND(totalProfit)}</td>
              <td className="px-3 py-2.5 text-right">{formatVND(totalOrders ? totalGross / totalOrders : 0)}</td>
              <td className="py-2.5 pl-3" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Doanh thu chưa trừ phí sàn. Chi phí ads từ phiếu chi thẻ “Quảng cáo …” (theo ngày phát sinh); Facebook và Instagram
        chung một khoản quảng cáo. Lợi nhuận theo Pancake, chưa trừ ads.
      </p>
    </Panel>
  );
}

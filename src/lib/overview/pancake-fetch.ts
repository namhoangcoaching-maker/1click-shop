import "server-only";
import type { DateRange } from "@/lib/date-range";
import { fetchOrderSources, fetchSaleStats, type SaleRow } from "@/lib/pancake/analytics";
import type { PancakeCredentials } from "@/lib/pancake/client";
import { rangeToPancake } from "./compute";
import { buildPancakeOverview, type PancakeOverview } from "./pancake-stats";

/**
 * Lấy số liệu Tổng quan từ thống kê Pancake (các lượt hỏi chạy song song).
 * `withSeries = false` bỏ phần biểu đồ theo giờ/ngày (báo cáo 8:00 không cần).
 */
export async function fetchPancakeOverview(
  creds: PancakeCredentials,
  range: DateRange,
  previousRange: DateRange | null,
  withSeries = true,
): Promise<PancakeOverview> {
  const cur = rangeToPancake(range);
  const prev = previousRange ? rangeToPancake(previousRange) : null;
  const split = (r: DateRange) => (r.from === r.to ? "Time.hour" : "Time.day");
  const none: SaleRow[] = [];
  const [total, series, bySource, byProduct, sourceNames, prevTotal, prevSeries, prevBySource] = await Promise.all([
    fetchSaleStats(creds, cur),
    withSeries ? fetchSaleStats(creds, cur, split(range)) : none,
    fetchSaleStats(creds, cur, "Order.order_sources"),
    fetchSaleStats(creds, cur, "Variation.product_id"),
    fetchOrderSources(creds),
    prev ? fetchSaleStats(creds, prev) : none,
    prev && withSeries ? fetchSaleStats(creds, prev, split(previousRange!)) : none,
    prev ? fetchSaleStats(creds, prev, "Order.order_sources") : none,
  ]);
  return buildPancakeOverview({
    range,
    previousRange,
    total: total[0],
    previousTotal: prevTotal[0],
    series,
    previousSeries: prevSeries,
    bySource,
    previousBySource: prevBySource,
    sourceNames,
    byProduct,
  });
}

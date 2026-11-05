import "server-only";
import type { DateRange } from "@/lib/date-range";
import type { SaleRow } from "@/lib/pancake/analytics";
import { cachedOrderSources, cachedSaleStats } from "@/lib/pancake/cached";
import { rangeToPancake } from "./compute";
import { buildPancakeOverview, type PancakeOverview } from "./pancake-stats";

/**
 * Lấy số liệu Tổng quan từ thống kê Pancake (các lượt hỏi chạy song song, có nhớ tạm ~2 phút: xem pancake/cached.ts).
 * `orgId` phải là shop của người đang đăng nhập hoặc việc nền.
 * `withSeries = false` bỏ phần biểu đồ theo giờ/ngày (báo cáo 8:00 không cần).
 */
export async function fetchPancakeOverview(
  orgId: string,
  range: DateRange,
  previousRange: DateRange | null,
  withSeries = true,
): Promise<PancakeOverview> {
  const cur = rangeToPancake(range);
  const prev = previousRange ? rangeToPancake(previousRange) : null;
  const split = (r: DateRange) => (r.from === r.to ? "Time.hour" : "Time.day");
  const none: SaleRow[] = [];
  const [total, series, bySource, byProduct, sourceNames, prevTotal, prevSeries, prevBySource] = await Promise.all([
    cachedSaleStats(orgId, cur),
    withSeries ? cachedSaleStats(orgId, cur, split(range)) : none,
    cachedSaleStats(orgId, cur, "Order.order_sources"),
    cachedSaleStats(orgId, cur, "Variation.product_id"),
    cachedOrderSources(orgId),
    prev ? cachedSaleStats(orgId, prev) : none,
    prev && withSeries ? cachedSaleStats(orgId, prev, split(previousRange!)) : none,
    prev ? cachedSaleStats(orgId, prev, "Order.order_sources") : none,
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

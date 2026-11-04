import "server-only";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import type { DateRange } from "@/lib/date-range";
import { getRealInventory } from "@/lib/inventory/real-data";
import type { RealStockItem } from "@/lib/inventory/real-stock";
import { fetchOrderSources, fetchSaleStats, type SaleRow } from "@/lib/pancake/analytics";
import { PancakeError } from "@/lib/pancake/client";
import { CONFIRMED_STATUSES } from "@/lib/pancake/map";
import { createClient } from "@/lib/supabase/server";
import { rangeToInstants, rangeToPancake, unlinkedQuantity, type ProductSalesRow } from "./compute";
import { buildPancakeOverview, type PancakeOverview } from "./pancake-stats";

export interface RealOverview {
  /** Số tiền theo thống kê Pancake; null khi không lấy được (kèm statsError). */
  stats: PancakeOverview | null;
  statsError: string | null;
  stock: RealStockItem[];
  /** Số lượng hàng bán ra (kỳ này) không gắn với sản phẩm nào trên Pancake. */
  unlinkedQty: number;
  /** Lần cuối đồng bộ tồn kho/đơn về 1Click. */
  syncedAt: string | null;
  /** Shop đã kết nối Pancake chưa. */
  connected: boolean;
}

/**
 * Số liệu trang Tổng quan:
 * - Tiền (doanh số, doanh thu, lợi nhuận, đơn chốt, nguồn đơn, top sản phẩm): gọi THẲNG thống kê Pancake
 *   để luôn khớp màn hình Pancake.
 * - Tồn kho, báo động, hàng chưa liên kết: từ dữ liệu đã đồng bộ về 1Click (đọc qua RLS).
 * `orgId` phải là shop của người đang đăng nhập (trang gọi getCurrentOrg trước).
 */
export async function getRealOverview(
  orgId: string,
  range: DateRange,
  previousRange: DateRange | null,
  velocityWindowDays: number,
  now: Date,
): Promise<RealOverview> {
  const supabase = await createClient();
  const instants = rangeToInstants(range);

  const [creds, inventory, salesRows, state] = await Promise.all([
    getPancakeCredentials(orgId),
    getRealInventory(orgId, velocityWindowDays, now),
    supabase.rpc("product_sales", {
      p_org_id: orgId,
      p_start: instants.start,
      p_end: instants.end,
      p_statuses: CONFIRMED_STATUSES,
    }),
    supabase
      .from("sync_state")
      .select("orders_cursor")
      .eq("org_id", orgId)
      .eq("provider", "pancake_pos")
      .maybeSingle(),
  ]);

  let stats: PancakeOverview | null = null;
  let statsError: string | null = null;
  if (creds) {
    try {
      const cur = rangeToPancake(range);
      const prev = previousRange ? rangeToPancake(previousRange) : null;
      const timeSplit = range.from === range.to ? "Time.hour" : "Time.day";
      const prevTimeSplit = previousRange && previousRange.from === previousRange.to ? "Time.hour" : "Time.day";
      const none: SaleRow[] = [];
      // Các lượt hỏi Pancake chạy song song (mỗi lượt ~0,2–0,7 giây).
      const [total, series, bySource, byProduct, sourceNames, prevTotal, prevSeries, prevBySource] = await Promise.all([
        fetchSaleStats(creds, cur),
        fetchSaleStats(creds, cur, timeSplit),
        fetchSaleStats(creds, cur, "Order.order_sources"),
        fetchSaleStats(creds, cur, "Variation.product_id"),
        fetchOrderSources(creds),
        prev ? fetchSaleStats(creds, prev) : none,
        prev ? fetchSaleStats(creds, prev, prevTimeSplit) : none,
        prev ? fetchSaleStats(creds, prev, "Order.order_sources") : none,
      ]);
      stats = buildPancakeOverview({
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
    } catch (err) {
      statsError =
        err instanceof PancakeError
          ? err.message
          : "Không lấy được số liệu thống kê từ Pancake (mạng chậm hoặc Pancake đang lỗi). Bấm Tải lại sau ít phút.";
    }
  }

  return {
    stats,
    statsError,
    stock: inventory.items,
    unlinkedQty: unlinkedQuantity(
      (salesRows.data ?? []) as ProductSalesRow[],
      inventory.items.map((i) => i.id!),
    ),
    syncedAt: state.data?.orders_cursor ?? null,
    connected: Boolean(creds),
  };
}

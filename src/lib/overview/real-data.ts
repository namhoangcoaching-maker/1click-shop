import "server-only";
import { cache } from "react";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import type { DateString } from "@/lib/date-range";
import { getRealInventory } from "@/lib/inventory/real-data";
import type { RealStockItem } from "@/lib/inventory/real-stock";
import { PancakeError } from "@/lib/pancake/client";
import { CONFIRMED_STATUSES } from "@/lib/pancake/map";
import { createClient } from "@/lib/supabase/server";
import { rangeToInstants, unlinkedQuantity, type ProductSalesRow } from "./compute";
import { fetchPancakeOverview } from "./pancake-fetch";
import type { PancakeOverview } from "./pancake-stats";

/**
 * Số liệu trang Tổng quan, tách HAI phần độc lập để trang hiện dần (phần nào xong trước hiện trước):
 * - getOverviewStats: tiền (doanh số, doanh thu, lợi nhuận, nguồn đơn, top sản phẩm) gọi THẲNG thống kê Pancake
 *   (có nhớ tạm ~2 phút) để luôn khớp màn hình Pancake.
 * - getOverviewStock: tồn kho, hàng chưa liên kết, lần đồng bộ: từ dữ liệu đã đồng bộ về 1Click (đọc qua RLS).
 * Cả hai bọc React `cache`: nhiều khối cùng gọi với cùng tham số trong MỘT lượt mở trang thì chỉ chạy một lần.
 * Tham số là chuỗi/số (không phải object) để `cache` nhận ra là cùng một lần gọi.
 * `orgId` phải là shop của người đang đăng nhập (trang gọi getCurrentOrg trước).
 */

export interface OverviewStats {
  /** null khi chưa kết nối hoặc Pancake lỗi (kèm statsError). */
  stats: PancakeOverview | null;
  statsError: string | null;
  connected: boolean;
}

export const getOverviewStats = cache(
  async (orgId: string, from: DateString, to: DateString, prevFrom: DateString | null, prevTo: DateString | null): Promise<OverviewStats> => {
    const creds = await getPancakeCredentials(orgId);
    if (!creds) return { stats: null, statsError: null, connected: false };
    try {
      const previous = prevFrom && prevTo ? { from: prevFrom, to: prevTo } : null;
      return { stats: await fetchPancakeOverview(orgId, { from, to }, previous), statsError: null, connected: true };
    } catch (err) {
      return {
        stats: null,
        statsError:
          err instanceof PancakeError
            ? err.message
            : "Không lấy được số liệu thống kê từ Pancake (mạng chậm hoặc Pancake đang lỗi). Bấm Tải lại sau ít phút.",
        connected: true,
      };
    }
  },
);

export interface OverviewStock {
  stock: RealStockItem[];
  /** Số lượng hàng bán ra (kỳ này) không gắn với sản phẩm nào trên Pancake. */
  unlinkedQty: number;
  /** Lần cuối đồng bộ tồn kho/đơn về 1Click. */
  syncedAt: string | null;
}

export const getOverviewStock = cache(
  async (orgId: string, from: DateString, to: DateString, velocityWindowDays: number, nowIso: string): Promise<OverviewStock> => {
    const supabase = await createClient();
    const instants = rangeToInstants({ from, to });
    const [inventory, salesRows, state] = await Promise.all([
      getRealInventory(orgId, velocityWindowDays, new Date(nowIso)),
      supabase.rpc("product_sales", {
        p_org_id: orgId,
        p_start: instants.start,
        p_end: instants.end,
        p_statuses: CONFIRMED_STATUSES,
      }),
      supabase.from("sync_state").select("orders_cursor").eq("org_id", orgId).eq("provider", "pancake_pos").maybeSingle(),
    ]);
    return {
      stock: inventory.items,
      unlinkedQty: unlinkedQuantity(
        (salesRows.data ?? []) as ProductSalesRow[],
        inventory.items.map((i) => i.id!),
      ),
      syncedAt: state.data?.orders_cursor ?? null,
    };
  },
);

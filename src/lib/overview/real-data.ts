import "server-only";
import type { DateRange } from "@/lib/date-range";
import { getRealInventory } from "@/lib/inventory/real-data";
import type { RealStockItem } from "@/lib/inventory/real-stock";
import { CONFIRMED_STATUSES } from "@/lib/pancake/map";
import { createClient } from "@/lib/supabase/server";
import {
  buildOverviewNumbers,
  buildTopProducts,
  rangeToInstants,
  unlinkedQuantity,
  type OrderFacts,
  type OverviewNumbers,
  type ProductSalesRow,
} from "./compute";
import type { TopProduct } from "./types";

const PAGE = 1000;

export interface RealOverview extends OverviewNumbers {
  topProducts: TopProduct[];
  stock: RealStockItem[];
  /** Số lượng hàng đã bán (kỳ này) không gắn với sản phẩm nào trên Pancake. */
  unlinkedQty: number;
  /** Lần cuối lấy đơn hàng từ Pancake. */
  syncedAt: string | null;
  /** Shop đã từng đồng bộ dữ liệu chưa. */
  hasData: boolean;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Gọi hàm database trả về nhiều dòng, tự lấy đủ các trang (Supabase trả tối đa 1.000 dòng/lần). */
async function rpcAll<T>(supabase: Supabase, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const first = await supabase.rpc(fn, args, { count: "exact" }).range(0, PAGE - 1);
  if (first.error) throw new Error(`Không đọc được số liệu (${fn}): ${first.error.message}`);
  const total = first.count ?? (first.data as T[]).length;
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) =>
      supabase.rpc(fn, args).range((i + 1) * PAGE, (i + 2) * PAGE - 1),
    ),
  );
  for (const r of rest) if (r.error) throw new Error(`Không đọc được số liệu (${fn}): ${r.error.message}`);
  return [first, ...rest].flatMap((r) => (r.data ?? []) as T[]);
}

/** Số liệu thật cho trang Tổng quan, đọc qua RLS bằng phiên người dùng. Các lượt hỏi chạy song song. */
export async function getRealOverview(
  orgId: string,
  range: DateRange,
  previousRange: DateRange | null,
  velocityWindowDays: number,
  now: Date,
): Promise<RealOverview> {
  const supabase = await createClient();
  const args = (r: DateRange) => ({ p_org_id: orgId, ...prefix(rangeToInstants(r)), p_statuses: CONFIRMED_STATUSES });

  const [current, previous, sales, inventory, state] = await Promise.all([
    rpcAll<OrderFacts>(supabase, "overview_orders", args(range)),
    previousRange ? rpcAll<OrderFacts>(supabase, "overview_orders", args(previousRange)) : null,
    rpcAll<ProductSalesRow>(supabase, "product_sales", args(range)),
    getRealInventory(orgId, velocityWindowDays, now),
    supabase
      .from("sync_state")
      .select("last_run_at, orders_cursor")
      .eq("org_id", orgId)
      .eq("provider", "pancake_pos")
      .maybeSingle(),
  ]);

  const products = inventory.items.map((i) => ({
    variation_id: i.id!,
    product_id: i.productId ?? i.id!,
    name: i.name,
    sku: i.sku,
  }));

  return {
    ...buildOverviewNumbers(current, previous, range, previousRange),
    topProducts: buildTopProducts(sales, products),
    stock: inventory.items,
    unlinkedQty: unlinkedQuantity(sales, products),
    syncedAt: state.data?.orders_cursor ?? null,
    hasData: Boolean(state.data) || inventory.items.length > 0,
  };
}

function prefix(i: { start: string; end: string }) {
  return { p_start: i.start, p_end: i.end };
}

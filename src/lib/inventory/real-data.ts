import "server-only";
import { CONFIRMED_STATUSES } from "@/lib/pancake/map";
import { createClient } from "@/lib/supabase/server";
import { buildStockItems, netSalesByVariation, type ProductRecord, type RealStockItem, type SalesRecord } from "./real-stock";

const DAY = 86_400_000;
const PAGE = 1000;

export interface RealInventory {
  items: RealStockItem[];
  /** Lần cuối lấy sản phẩm/tồn kho từ Pancake; null nếu chưa đồng bộ. */
  syncedAt: string | null;
}

/**
 * Tồn kho thật của shop (đọc qua RLS bằng phiên người dùng).
 * Tốc độ bán lấy từ đơn chốt trong `velocityWindowDays` ngày gần nhất.
 */
export async function getRealInventory(orgId: string, velocityWindowDays: number, now: Date): Promise<RealInventory> {
  const supabase = await createClient();

  const loadProducts = async () => {
    const products: ProductRecord[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("products")
        .select("variation_id, sku, name, variant, retail_price, cost_price, stock, internal_note, is_hidden")
        .eq("org_id", orgId)
        .order("variation_id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Không đọc được sản phẩm: ${error.message}`);
      products.push(...(data as ProductRecord[]));
      if (!data || data.length < PAGE) return products;
    }
  };

  const sales = async (days: number) => {
    const { data, error } = await supabase.rpc("variation_sales", {
      p_org_id: orgId,
      p_since: new Date(now.getTime() - days * DAY).toISOString(),
      p_statuses: CONFIRMED_STATUSES,
    });
    if (error) throw new Error(`Không tính được số đã bán: ${error.message}`);
    return netSalesByVariation((data ?? []) as SalesRecord[]);
  };

  const loadSyncedAt = async () => {
    const { data } = await supabase
      .from("sync_state")
      .select("products_synced_at")
      .eq("org_id", orgId)
      .eq("provider", "pancake_pos")
      .maybeSingle();
    return data?.products_synced_at ?? null;
  };

  // Hỏi song song: database ở xa (Sydney), mỗi lượt hỏi tốn vài trăm mili-giây.
  const [products, in90, inWindow, syncedAt] = await Promise.all([
    loadProducts(),
    sales(90),
    velocityWindowDays === 90 ? null : sales(velocityWindowDays),
    loadSyncedAt(),
  ]);

  return { items: buildStockItems(products, inWindow ?? in90, in90), syncedAt };
}

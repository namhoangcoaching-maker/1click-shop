/**
 * Ghép dữ liệu Pancake đã đồng bộ thành danh sách tồn kho (thuần tính toán, có unit test).
 * Số bán dùng cho tốc độ bán = số lượng trong ĐƠN CHỐT − số lượng khách hoàn lại.
 */
import { parseLeadTime } from "./lead-time";
import type { StockItem } from "./stock";

export interface ProductRecord {
  variation_id: string;
  sku: string | null;
  name: string;
  variant: string | null;
  retail_price: number;
  cost_price: number | null;
  stock: number;
  internal_note: string | null;
  is_hidden: boolean;
}

export interface SalesRecord {
  variation_id: string;
  sold: number;
  returned: number;
}

/** Số đã bán thực theo mã: bán − hoàn, không âm. */
export function netSalesByVariation(rows: SalesRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.variation_id, (map.get(r.variation_id) ?? 0) + Math.max(0, Number(r.sold) - Number(r.returned)));
  }
  return map;
}

export interface RealStockItem extends StockItem {
  /** Số đã bán thực trong 90 ngày, để biết mã còn kinh doanh không. */
  sold90: number;
  /** Mã ngừng kinh doanh: ẩn trên Pancake, hoặc hết hàng và 90 ngày không bán được cái nào. */
  inactive: boolean;
}

export function buildStockItems(
  products: ProductRecord[],
  salesInWindow: Map<string, number>,
  sales90: Map<string, number>,
): RealStockItem[] {
  return products.map((p) => {
    const sold90 = sales90.get(p.variation_id) ?? 0;
    return {
      id: p.variation_id,
      sku: p.sku ?? p.variation_id.slice(0, 8),
      name: p.name,
      variant: p.variant,
      stock: p.stock,
      soldInWindow: salesInWindow.get(p.variation_id) ?? 0,
      leadTimeDays: parseLeadTime(p.internal_note),
      costPrice: p.cost_price,
      price: p.retail_price,
      sold90,
      inactive: p.is_hidden || (p.stock <= 0 && sold90 === 0),
    };
  });
}

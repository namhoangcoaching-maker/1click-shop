/**
 * Phần còn tự tính của trang Tổng quan (thuần, có unit test).
 * Số TIỀN (doanh số, doanh thu, lợi nhuận…) lấy nguyên từ thống kê Pancake: xem pancake-stats.ts.
 */
import { addDays, type DateRange } from "@/lib/date-range";

/** Khoảng ngày (giờ Việt Nam) → mốc bắt đầu và mốc kết thúc (không gồm) theo giờ quốc tế. */
export function rangeToInstants(range: DateRange): { start: string; end: string } {
  return {
    start: new Date(`${range.from}T00:00:00+07:00`).toISOString(),
    end: new Date(`${addDays(range.to, 1)}T00:00:00+07:00`).toISOString(),
  };
}

/** Khoảng ngày → since/until cho thống kê Pancake (until là giây cuối cùng của ngày cuối). */
export function rangeToPancake(range: DateRange): { since: string; until: string } {
  const { start, end } = rangeToInstants(range);
  return { since: start.replace(".000Z", "Z"), until: new Date(Date.parse(end) - 1000).toISOString().replace(".000Z", "Z") };
}

/** Một dòng của hàm database product_sales. */
export interface ProductSalesRow {
  variation_id: string | null;
  quantity: number;
  returned: number;
  gross: number;
}

/** Số lượng hàng bán ra (đơn chốt) không gắn được với sản phẩm đang có trên Pancake. */
export function unlinkedQuantity(rows: ProductSalesRow[], knownVariationIds: Iterable<string>): number {
  const known = new Set(knownVariationIds);
  return rows
    .filter((r) => !r.variation_id || !known.has(r.variation_id))
    .reduce((s, r) => s + Math.max(0, Number(r.quantity) - Number(r.returned)), 0);
}

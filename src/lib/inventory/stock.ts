/**
 * Phân tích tồn kho: tốc độ bán, số ngày còn đủ bán, khi nào phải sản xuất/nhập hàng.
 *
 * Quy tắc báo động (theo yêu cầu của chủ shop):
 *   số ngày còn đủ bán < thời gian sản xuất + số ngày dự phòng  →  CẦN SẢN XUẤT NGAY
 * Ví dụ: bán 7 cái/ngày, còn 60 cái → đủ bán 8,6 ngày; sản xuất mất 8 ngày + 3 ngày dự phòng = 11 ngày
 * → 8,6 < 11 nên báo động.
 *
 * Toàn bộ là phép tính của code, AI không tự tính các con số này.
 */
import { addDays, type DateString } from "@/lib/date-range";

/** Ngưỡng mặc định. Sau này mỗi doanh nghiệp tự chỉnh trong phần cấu hình. */
export const STOCK_RULES = {
  /** Số ngày dự phòng ngoài thời gian sản xuất ("rôi ra ít nhất 3 ngày chuẩn bị"). */
  safetyDays: 3,
  /** Báo "sắp đến hạn đặt" khi còn ít hơn chừng này ngày nữa là phải đặt sản xuất. */
  warningWindowDays: 7,
  /** Đủ bán quá chừng này ngày thì coi là bán chậm, cần kế hoạch đẩy tồn. */
  slowMovingDays: 90,
  /** Lượng hàng nên có sau khi hàng mới về, tính theo số ngày bán. */
  targetCoverDays: 30,
  /** Tính tốc độ bán trung bình trên chừng này ngày gần nhất. */
  velocityWindowDays: 30,
} as const;

export type StockRules = typeof STOCK_RULES;

export interface StockItem {
  sku: string;
  name: string;
  /** Số lượng còn có thể bán. */
  stock: number;
  /** Số lượng đã bán trong cửa sổ tính tốc độ (mặc định 30 ngày gần nhất). */
  soldInWindow: number;
  /** Số ngày từ lúc đặt sản xuất/nhập đến khi hàng về kho. Pancake không có, nhập trên 1Click. */
  leadTimeDays: number;
  /** Giá vốn, null nếu chưa nhập trên Pancake. */
  costPrice: number | null;
  price: number;
}

export type StockStatus = "out" | "urgent" | "soon" | "slow" | "ok";

/** Thứ tự ưu tiên khi sắp xếp: việc gấp nhất lên đầu. */
export const STATUS_PRIORITY: Record<StockStatus, number> = {
  out: 0,
  urgent: 1,
  soon: 2,
  slow: 3,
  ok: 4,
};

export interface StockAnalysis {
  item: StockItem;
  /** Trung bình bán mỗi ngày. */
  velocity: number;
  /** Số ngày còn đủ bán; Infinity nếu không bán được cái nào. */
  daysOfStock: number;
  /** Thời gian sản xuất + dự phòng. */
  requiredDays: number;
  status: StockStatus;
  /**
   * Còn bao nhiêu ngày nữa là phải đặt sản xuất (làm tròn xuống).
   * Âm nghĩa là đã trễ. null nếu không bán được (không cần đặt).
   */
  daysUntilOrder: number | null;
  /** Ngày chậm nhất phải đặt sản xuất; null nếu không cần. */
  orderBy: DateString | null;
  /** Số lượng nên sản xuất để sau khi hàng về còn đủ bán targetCoverDays ngày. 0 nếu không cần. */
  suggestedQuantity: number;
  /** Giá trị tồn theo giá vốn; null nếu thiếu giá vốn. */
  costValue: number | null;
}

export function analyzeStock(
  item: StockItem,
  today: DateString,
  rules: StockRules = STOCK_RULES,
): StockAnalysis {
  const velocity = item.soldInWindow / rules.velocityWindowDays;
  const daysOfStock = velocity > 0 ? item.stock / velocity : Infinity;
  const requiredDays = item.leadTimeDays + rules.safetyDays;

  let status: StockStatus;
  if (velocity > 0 && item.stock <= 0) status = "out";
  else if (daysOfStock < requiredDays) status = "urgent";
  else if (daysOfStock < requiredDays + rules.warningWindowDays) status = "soon";
  else if (item.stock > 0 && daysOfStock > rules.slowMovingDays) status = "slow";
  else status = "ok";

  const daysUntilOrder = velocity > 0 ? Math.floor(daysOfStock - requiredDays) : null;
  const needsOrder = status === "out" || status === "urgent" || status === "soon";
  // Hàng về sau leadTimeDays; lúc đó cần còn đủ bán thêm targetCoverDays + safetyDays.
  const suggestedQuantity = needsOrder
    ? Math.max(0, Math.ceil(velocity * (requiredDays + rules.targetCoverDays) - Math.max(0, item.stock)))
    : 0;

  return {
    item,
    velocity,
    daysOfStock,
    requiredDays,
    status,
    daysUntilOrder,
    orderBy: daysUntilOrder === null ? null : addDays(today, Math.max(0, daysUntilOrder)),
    suggestedQuantity,
    costValue: item.costPrice === null ? null : item.stock * item.costPrice,
  };
}

/** Phân tích cả danh sách, việc gấp nhất lên đầu. */
export function analyzeInventory(
  items: StockItem[],
  today: DateString,
  rules: StockRules = STOCK_RULES,
): StockAnalysis[] {
  return items
    .map((item) => analyzeStock(item, today, rules))
    .sort(
      (a, b) =>
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
        a.daysOfStock - b.daysOfStock,
    );
}

export interface InventoryTotals {
  quantity: number;
  /** Chỉ cộng sản phẩm đã có giá vốn. */
  costValue: number;
  retailValue: number;
  /** Sản phẩm còn tồn nhưng thiếu giá vốn: giá trị tồn đang bị thiếu phần này. */
  missingCost: StockItem[];
}

export function summarizeInventory(items: StockItem[]): InventoryTotals {
  const inStock = items.filter((i) => i.stock > 0);
  return {
    quantity: inStock.reduce((sum, i) => sum + i.stock, 0),
    costValue: inStock.reduce((sum, i) => sum + (i.costPrice === null ? 0 : i.stock * i.costPrice), 0),
    retailValue: inStock.reduce((sum, i) => sum + i.stock * i.price, 0),
    missingCost: inStock.filter((i) => i.costPrice === null),
  };
}

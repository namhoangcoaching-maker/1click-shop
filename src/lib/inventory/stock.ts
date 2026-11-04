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
import { DEFAULT_LEAD_TIME_DAYS } from "./lead-time";

/** Các con số mỗi shop tự cấu hình (trang Tồn kho → Cấu hình). Giới hạn nhập nằm ở settings.ts. */
export interface StockRules {
  /** Số ngày dự phòng ngoài thời gian sản xuất ("rôi ra ít nhất 3 ngày chuẩn bị"). */
  safetyDays: number;
  /** Báo "sắp đến hạn đặt" khi còn ít hơn chừng này ngày nữa là phải đặt sản xuất. */
  warningWindowDays: number;
  /** Đủ bán quá chừng này ngày thì coi là bán chậm, cần kế hoạch đẩy tồn. */
  slowMovingDays: number;
  /** Lượng hàng nên có sau khi hàng mới về, tính theo số ngày bán (21 ngày để tránh tồn nhiều). */
  targetCoverDays: number;
  /** Tính tốc độ bán trung bình trên chừng này ngày gần nhất. */
  velocityWindowDays: number;
  /** Thời gian sản xuất dùng cho sản phẩm chưa ghi "SX: …" trong Ghi chú nội bộ. */
  defaultLeadTimeDays: number;
}

/** Ngưỡng mặc định cho shop chưa cấu hình. */
export const STOCK_RULES: Readonly<StockRules> = Object.freeze({
  safetyDays: 3,
  warningWindowDays: 7,
  slowMovingDays: 90,
  targetCoverDays: 21,
  velocityWindowDays: 30,
  defaultLeadTimeDays: DEFAULT_LEAD_TIME_DAYS,
});

export interface StockItem {
  sku: string;
  name: string;
  /** Số lượng còn có thể bán. */
  stock: number;
  /** Số lượng đã bán trong `velocityWindowDays` ngày gần nhất (mặc định 30). */
  soldInWindow: number;
  /**
   * Số ngày từ lúc đặt sản xuất/nhập đến khi hàng về kho, đọc từ "Ghi chú nội bộ" trên Pancake
   * (xem lead-time.ts). null nếu chưa ghi: dùng rules.defaultLeadTimeDays và cảnh báo.
   */
  leadTimeDays: number | null;
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
  /** Thời gian sản xuất dùng để tính (của sản phẩm, hoặc mặc định nếu chưa ghi). */
  leadTimeDays: number;
  /** true nếu sản phẩm chưa ghi thời gian sản xuất, đang dùng số mặc định. */
  leadTimeIsDefault: boolean;
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
  const leadTimeDays = item.leadTimeDays ?? rules.defaultLeadTimeDays;
  const requiredDays = leadTimeDays + rules.safetyDays;

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
    leadTimeDays,
    leadTimeIsDefault: item.leadTimeDays === null,
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

/**
 * Gom báo động tồn kho theo MẪU (sản phẩm), không báo lẻ từng size (chủ dự án yêu cầu 04/11/2026).
 * Một mẫu bị báo động khi có ÍT NHẤT một màu/size hết hàng hoặc cần sản xuất ngay.
 * Khi xổ ra: thấy MỌI màu/size của mẫu đó (kể cả size còn đủ) để biết tình trạng từng size.
 */
import { STATUS_PRIORITY, type StockAnalysis, type StockStatus } from "./stock";

export interface ProductAlarm {
  productId: string;
  name: string;
  /** Trạng thái gấp nhất trong các size. */
  worstStatus: StockStatus;
  /** Mọi size/màu của mẫu, xếp theo màu rồi size (S, M, L…). */
  variants: StockAnalysis[];
  /** Số size/màu đang hết hoặc cần sản xuất ngay. */
  alarmCount: number;
  /** Tổng số nên đặt sản xuất của cả mẫu. */
  totalSuggested: number;
}

const ALARM: StockStatus[] = ["out", "urgent"];

/** Thứ tự size quen thuộc; size lạ xếp sau, theo chữ cái. */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "FREE", "FREESIZE", "F"];

/** Tách "Xám / M" thành màu "Xám" và size "M" (phần cuối cùng là size). */
export function splitVariant(variant: string | null | undefined): { color: string; size: string } {
  const parts = (variant ?? "").split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { color: "", size: "" };
  const size = parts[parts.length - 1];
  return { color: parts.slice(0, -1).join(" / "), size };
}

function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size.toUpperCase().replace(/\s+/g, ""));
  return i === -1 ? SIZE_ORDER.length : i;
}

export function compareVariants(
  a: { item: { variant?: string | null } },
  b: { item: { variant?: string | null } },
): number {
  const va = splitVariant(a.item.variant);
  const vb = splitVariant(b.item.variant);
  return (
    va.color.localeCompare(vb.color, "vi") ||
    sizeRank(va.size) - sizeRank(vb.size) ||
    va.size.localeCompare(vb.size, "vi", { numeric: true })
  );
}

export function groupStockAlarms(analyses: StockAnalysis[]): ProductAlarm[] {
  const byProduct = new Map<string, StockAnalysis[]>();
  for (const a of analyses) {
    const key = a.item.productId ?? a.item.id ?? a.item.sku;
    byProduct.set(key, [...(byProduct.get(key) ?? []), a]);
  }

  const groups: ProductAlarm[] = [];
  for (const [productId, list] of byProduct) {
    const alarms = list.filter((a) => ALARM.includes(a.status));
    if (alarms.length === 0) continue;
    const worst = list.reduce((w, a) => (STATUS_PRIORITY[a.status] < STATUS_PRIORITY[w] ? a.status : w), list[0].status);
    groups.push({
      productId,
      name: list[0].item.name,
      worstStatus: worst,
      variants: [...list].sort(compareVariants),
      alarmCount: alarms.length,
      totalSuggested: list.reduce((sum, a) => sum + a.suggestedQuantity, 0),
    });
  }

  // Mẫu gấp nhất lên đầu; cùng mức thì mẫu cần đặt nhiều hơn lên trước.
  return groups.sort(
    (a, b) => STATUS_PRIORITY[a.worstStatus] - STATUS_PRIORITY[b.worstStatus] || b.totalSuggested - a.totalSuggested,
  );
}

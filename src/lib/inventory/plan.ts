/**
 * Kế hoạch đặt hàng theo lịch (chủ dự án chốt 05/11/2026, thuần tính toán, có unit test):
 *
 * - Lịch đặt mỗi tháng: ĐẶT CHÍNH ngày 16 và ngày cuối tháng; ĐẶT BỔ SUNG mùng 5 và ngày 20
 *   (chỉ khi mã bán chạy lên hoặc đã đặt rồi vẫn thiếu).
 * - Hàng đặt ngày D phải đủ bán tới (lần đặt chính kế tiếp sau D) + 7 ngày.
 *   Ví dụ đặt ngày 16 → đủ bán tới mùng 7 tháng sau; đặt cuối tháng → đủ bán tới ngày 23 tháng sau.
 * - Mỗi size đặt tối thiểu 20 cái.
 * - Thời gian sản xuất theo SỐ LƯỢNG cả mẫu trong lần đặt: ≤50 cái 7 ngày, 51–150 cái 10 ngày, >150 cái 14 ngày.
 * - Cho phép bán âm kho tối đa 7 ngày (3–5 ngày là bình thường). Nếu đợi tới lần đặt kế tiếp mà hàng về
 *   trễ hơn 7 ngày sau khi hết → "Cần sản xuất ngay".
 * - Hàng sắp về (shop nhập trên 1Click) được cộng vào tồn theo ngày về.
 * - Mã bán chậm (đặt tối thiểu 20 cái mà lâu hơn N ngày mới bán hết) không gợi ý, trừ khi shop muốn xem.
 */
import { addDays, daysUntil, type DateString } from "@/lib/date-range";
import { compareVariants } from "./alarms";
import type { StockItem } from "./stock";

export interface PlanRules {
  /** Số lượng tối thiểu mỗi size mỗi lần đặt. */
  moqPerSize: number;
  /** Thời gian sản xuất theo số lượng cả mẫu: ≤ tier1Qty → tier1Days; ≤ tier2Qty → tier2Days; lớn hơn → tier3Days. */
  tier1Qty: number;
  tier1Days: number;
  tier2Qty: number;
  tier2Days: number;
  tier3Days: number;
  /** Bán âm kho tối đa chừng này ngày (chờ hàng về). */
  maxNegativeDays: number;
  /** Hàng phải đủ bán tới lần đặt chính kế tiếp + chừng này ngày. */
  extraCoverDays: number;
  /** Mã mà lượng đặt tối thiểu phải lâu hơn chừng này ngày mới bán hết là "bán chậm": ẩn khỏi gợi ý. */
  slowCoverDays: number;
}

export const PLAN_RULES: Readonly<PlanRules> = Object.freeze({
  moqPerSize: 20,
  tier1Qty: 50,
  tier1Days: 7,
  tier2Qty: 150,
  tier2Days: 10,
  tier3Days: 14,
  maxNegativeDays: 7,
  extraCoverDays: 7,
  slowCoverDays: 60,
});

export interface Incoming {
  quantity: number;
  eta: DateString;
}

export interface PlanItem extends StockItem {
  /** Tốc độ bán mỗi ngày. */
  velocity: number;
  /** Hàng đã đặt xưởng, chưa về. */
  incoming: Incoming[];
}

// ----------------------------------------------------------------------------
// Lịch đặt hàng
// ----------------------------------------------------------------------------

export type OrderDayKind = "main" | "extra";

export interface OrderDay {
  date: DateString;
  kind: OrderDayKind;
  /** "Mùng 5", "Ngày 16", "Ngày 20", "Cuối tháng". */
  label: string;
}

export function lastDayOfMonth(date: DateString): DateString {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // ngày 0 của tháng sau = ngày cuối tháng này
  return d.toISOString().slice(0, 10);
}

function dayOfMonth(date: DateString, day: number): DateString {
  return `${date.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** Các ngày đặt trong tháng: mùng 5, 16, 20, cuối tháng (chủ shop đổi ngày 10 → mùng 5 ngày 05/11/2026). */
function orderDaysInMonth(date: DateString): OrderDay[] {
  return [
    { date: dayOfMonth(date, 5), kind: "extra", label: "Mùng 5" },
    { date: dayOfMonth(date, 16), kind: "main", label: "Ngày 16" },
    { date: dayOfMonth(date, 20), kind: "extra", label: "Ngày 20" },
    { date: lastDayOfMonth(date), kind: "main", label: "Cuối tháng" },
  ];
}

/** Ngày đặt từ hôm nay trở đi (gồm hôm nay nếu hôm nay là ngày đặt), đủ `count` ngày. */
export function upcomingOrderDays(today: DateString, count = 4): OrderDay[] {
  const result: OrderDay[] = [];
  let month = today;
  while (result.length < count) {
    for (const d of orderDaysInMonth(month)) if (d.date >= today && result.length < count) result.push(d);
    month = addDays(lastDayOfMonth(month), 1);
  }
  return result;
}

/** Lần đặt CHÍNH kế tiếp, sau ngày `date` (không gồm chính ngày đó). */
export function nextMainAfter(date: DateString): DateString {
  const d16 = dayOfMonth(date, 16);
  if (date < d16) return d16;
  const last = lastDayOfMonth(date);
  if (date < last) return last;
  return dayOfMonth(addDays(last, 1), 16);
}

/** Hàng đặt ngày D phải đủ bán tới ngày này. */
export function coverUntil(orderDate: DateString, rules: PlanRules = PLAN_RULES): DateString {
  return addDays(nextMainAfter(orderDate), rules.extraCoverDays);
}

export function leadTimeFor(totalQty: number, rules: PlanRules = PLAN_RULES): number {
  if (totalQty <= rules.tier1Qty) return rules.tier1Days;
  if (totalQty <= rules.tier2Qty) return rules.tier2Days;
  return rules.tier3Days;
}

// ----------------------------------------------------------------------------
// Dự báo tồn kho từng size
// ----------------------------------------------------------------------------

/** Tồn dự kiến vào cuối ngày `date` (có thể âm = đang bán âm kho). */
export function projectedStock(item: PlanItem, today: DateString, date: DateString): number {
  const arrived = item.incoming.filter((i) => i.eta <= date).reduce((s, i) => s + i.quantity, 0);
  return item.stock + arrived - item.velocity * Math.max(0, daysUntil(date, today));
}

/** Ngày bắt đầu hết hàng (tồn dự kiến < 0) trong vòng `horizon` ngày; null nếu không hết. */
export function stockoutDate(item: PlanItem, today: DateString, horizon = 120): DateString | null {
  if (item.stock <= 0 && item.velocity > 0 && item.incoming.every((i) => i.eta > today)) return today;
  for (let d = 0; d <= horizon; d++) {
    const date = addDays(today, d);
    if (projectedStock(item, today, date) < 0) return date;
  }
  return null;
}

/** Số ngày bán âm kho trong khoảng [from, to) theo dự báo (không tính lô đang xét). */
export function negativeDaysBetween(item: PlanItem, today: DateString, from: DateString, to: DateString): number {
  let n = 0;
  for (let d = from; d < to; d = addDays(d, 1)) if (projectedStock(item, today, d) < 0) n++;
  return n;
}

export function isSlowItem(item: PlanItem, rules: PlanRules = PLAN_RULES): boolean {
  return item.velocity <= 0 || rules.moqPerSize / item.velocity > rules.slowCoverDays;
}

/** Thiếu bao nhiêu cái để đủ bán tới `until` (đã tính tồn hiện tại, hàng sắp về, bán âm). */
export function shortfall(item: PlanItem, today: DateString, until: DateString): number {
  return Math.max(0, -projectedStock(item, today, until));
}

// ----------------------------------------------------------------------------
// Gợi ý đặt theo mẫu
// ----------------------------------------------------------------------------

export interface VariantSuggestion {
  item: PlanItem;
  /** Tồn dự kiến ngày đặt. */
  stockAtOrder: number;
  incomingQty: number;
  stockout: DateString | null;
  /** Thiếu tới ngày phải đủ bán. */
  short: number;
  /** Gợi ý đặt (≥ tối thiểu mỗi size), 0 nếu không cần. */
  suggested: number;
  slow: boolean;
}

export interface ProductSuggestion {
  productId: string;
  name: string;
  orderDate: DateString;
  coverUntil: DateString;
  /** Tổng gợi ý đặt cả mẫu. */
  total: number;
  leadTimeDays: number;
  /** Ngày hàng về nếu đặt đúng ngày đặt. */
  arrival: DateString;
  /** Số ngày bán âm kho từ ngày đặt tới khi lô này về (size tệ nhất). */
  negativeDays: number;
  /** Mọi size của mẫu (để thấy cả size còn đủ). */
  variants: VariantSuggestion[];
  /** Cả mẫu đều là mã bán chậm. */
  slow: boolean;
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

/** Gợi ý đặt cho MỘT ngày đặt: mỗi mẫu có ít nhất một size thiếu thì hiện cả mẫu. */
export function suggestForDay(
  items: PlanItem[],
  today: DateString,
  orderDate: DateString,
  rules: PlanRules = PLAN_RULES,
  /** Đếm ngày bán âm từ ngày này tới lúc hàng về (mặc định: từ ngày đặt). */
  negativeFrom: DateString = orderDate,
): ProductSuggestion[] {
  const until = coverUntil(orderDate, rules);
  const result: ProductSuggestion[] = [];

  for (const [productId, list] of groupBy(items, (i) => i.productId ?? i.id ?? i.sku)) {
    const variants: VariantSuggestion[] = list.map((item) => {
      const short = shortfall(item, today, until);
      const slow = isSlowItem(item, rules);
      return {
        item,
        stockAtOrder: projectedStock(item, today, orderDate),
        incomingQty: item.incoming.reduce((s, i) => s + i.quantity, 0),
        stockout: stockoutDate(item, today),
        short,
        suggested: short > 0 ? Math.max(rules.moqPerSize, Math.ceil(short)) : 0,
        slow,
      };
    });
    const total = variants.reduce((s, v) => s + v.suggested, 0);
    if (total === 0) continue;

    const leadTimeDays = leadTimeFor(total, rules);
    const arrival = addDays(orderDate, leadTimeDays);
    const negativeDays = Math.max(
      0,
      ...variants.filter((v) => v.suggested > 0).map((v) => negativeDaysBetween(v.item, today, negativeFrom, arrival)),
    );
    result.push({
      productId,
      name: list[0].name,
      orderDate,
      coverUntil: until,
      total,
      leadTimeDays,
      arrival,
      negativeDays,
      variants: variants.sort((a, b) => compareVariants(a, b)),
      slow: variants.filter((v) => v.suggested > 0).every((v) => v.slow),
    });
  }
  return result.sort((a, b) => b.negativeDays - a.negativeDays || b.total - a.total);
}

/**
 * "Cần sản xuất ngay": nếu đợi tới ngày đặt kế tiếp (kể cả mùng 5 / ngày 20) thì hàng về trễ hơn
 * `maxNegativeDays` ngày sau khi hết hàng. Gợi ý số lượng như khi đặt HÔM NAY.
 * Hôm nay là ngày đặt thì không có mục "ngay" (đã nằm trong danh sách hôm nay).
 */
export function urgentNow(items: PlanItem[], today: DateString, rules: PlanRules = PLAN_RULES): ProductSuggestion[] {
  // Hôm nay là ngày đặt: mọi mẫu cần đặt nằm chung danh sách của hôm nay, không tách "ngay".
  if (upcomingOrderDays(today, 1)[0].date === today) return [];
  const next = upcomingOrderDays(addDays(today, 1), 1)[0].date;
  // Nếu đợi: tính cả những ngày đang âm từ hôm nay tới khi lô đặt ngày kế tiếp về.
  const ifWait = new Map(suggestForDay(items, today, next, rules, today).map((p) => [p.productId, p]));
  return suggestForDay(items, today, today, rules).filter((p) => {
    const waited = ifWait.get(p.productId);
    return waited !== undefined && waited.negativeDays > rules.maxNegativeDays;
  });
}

export interface OrderPlan {
  urgent: ProductSuggestion[];
  days: { day: OrderDay; products: ProductSuggestion[] }[];
}

/**
 * Toàn bộ kế hoạch: cần sản xuất ngay + 4 ngày đặt sắp tới.
 * Tính lần lượt từng ngày, GIẢ ĐỊNH các lần trước được đặt đúng gợi ý (cộng thành hàng sắp về),
 * nên mùng 5 / ngày 20 chỉ còn những mẫu thật sự vẫn thiếu, không lặp lại gợi ý của ngày 16/cuối tháng.
 */
export function buildOrderPlan(items: PlanItem[], today: DateString, rules: PlanRules = PLAN_RULES): OrderPlan {
  const urgent = urgentNow(items, today, rules);
  let simulated = withPlanned(items, urgent);
  const days: OrderPlan["days"] = [];
  for (const day of upcomingOrderDays(today, 4)) {
    const products = suggestForDay(simulated, today, day.date, rules);
    days.push({ day, products });
    simulated = withPlanned(simulated, products);
  }
  return { urgent, days };
}

/** Cộng các gợi ý đặt vào "hàng sắp về" (về ngày arrival) để tính các lần đặt sau. */
function withPlanned(items: PlanItem[], planned: ProductSuggestion[]): PlanItem[] {
  const add = new Map<string, Incoming[]>();
  for (const p of planned) {
    for (const v of p.variants) {
      if (v.suggested <= 0) continue;
      const key = v.item.id ?? v.item.sku;
      add.set(key, [...(add.get(key) ?? []), { quantity: v.suggested, eta: p.arrival }]);
    }
  }
  if (add.size === 0) return items;
  return items.map((i) => {
    const extra = add.get(i.id ?? i.sku);
    return extra ? { ...i, incoming: [...i.incoming, ...extra] } : i;
  });
}

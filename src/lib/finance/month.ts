/**
 * Lợi nhuận kinh doanh tháng và Dòng tiền thực tế tháng – HAI phần tách bạch (chủ dự án chốt 05/11/2026).
 * Thuần tính toán, có unit test.
 *
 *  LỢI NHUẬN KINH DOANH = Doanh thu (Pancake, ĐÃ trừ chiết khấu, hàng hoàn, phí sàn)
 *                         − phí vận chuyển ngoại sàn (Pancake `partner_fee`: Doanh thu Pancake không trừ khoản này)
 *                         − chi phí theo thẻ phiếu chi (Sản xuất = trả xưởng/nhập hàng, Quay chụp, Lương…)
 *                         − quảng cáo
 *    (khác Lợi nhuận của Pancake: Pancake trừ giá vốn từng sản phẩm bán ra; ở đây trừ tiền thực trả xưởng trong tháng)
 *
 *  DÒNG TIỀN THỰC TẾ = Tiền về trong tháng (ĐÃ trừ phí sàn và phí ship đơn vị vận chuyển giữ lại)
 *                      − chi phí theo thẻ phiếu chi − phí ship trả riêng − quảng cáo
 *
 * Phiếu Pancake tự sinh theo đơn (trả trước, hoàn, đổi số tiền) KHÔNG phải chi phí: đã nằm trong Doanh thu/Tiền về.
 */
import { addDays, type DateString } from "@/lib/date-range";
import { lastDayOfMonth } from "@/lib/inventory/plan";
import { vnDate } from "@/lib/cash/compute";

export type MonthString = string; // "2026-11"

export function monthRange(month: MonthString): { from: DateString; to: DateString } {
  const from = `${month}-01`;
  return { from, to: lastDayOfMonth(from) };
}

/** Tháng hợp lệ từ thanh địa chỉ (?thang=2026-10), sai thì tháng hiện tại. */
export function resolveMonth(value: unknown, today: DateString): MonthString {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= today.slice(0, 7)
    ? value
    : today.slice(0, 7);
}

/** `count` tháng gần nhất, mới nhất trước. */
export function recentMonths(today: DateString, count = 6): MonthString[] {
  const months: MonthString[] = [];
  let d = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < count; i++) {
    months.push(d.slice(0, 7));
    d = `${addDays(d, -1).slice(0, 7)}-01`;
  }
  return months;
}

export interface ExpenseTransaction {
  display_id: string | null;
  name: string | null;
  amount: number;
  tag_ids: string[];
  time_incurred: string | null;
  posted_at: string;
  status: number | null;
  is_canceled: boolean;
}

export interface ExpenseLine {
  date: DateString;
  /** Số tiền chi (dương). */
  amount: number;
  tagId: string;
  category: string;
  displayId: string | null;
  name: string | null;
}

export const UNNAMED_TAG = "Thẻ chưa đặt tên";

/**
 * Phiếu chi CÓ THẺ trong khoảng ngày → các dòng chi phí. Ngày = thời điểm phát sinh (không có thì ngày tạo).
 * Bỏ phiếu hủy, phiếu chưa hiệu lực (status ≠ 1), phiếu thu (số dương).
 */
export function expenseLines(
  txs: ExpenseTransaction[],
  tagNames: Map<string, string>,
  from: DateString,
  to: DateString,
): ExpenseLine[] {
  return txs
    .filter((t) => t.tag_ids.length > 0 && !t.is_canceled && (t.status ?? 1) === 1 && t.amount < 0)
    .sort((a, b) => (a.time_incurred ?? a.posted_at).localeCompare(b.time_incurred ?? b.posted_at))
    .map((t) => {
      const tagId = t.tag_ids[0];
      return {
        date: vnDate(t.time_incurred ?? t.posted_at),
        amount: -t.amount,
        tagId,
        category: tagNames.get(tagId) ?? UNNAMED_TAG,
        displayId: t.display_id,
        name: t.name,
      };
    })
    .filter((l) => l.date >= from && l.date <= to);
}

export interface ShippingFeeLine {
  date: DateString;
  /** Số tiền chi (dương). */
  amount: number;
}

/** Phiếu "Thanh toán phí vận chuyển…" (phí ship trả riêng) trong khoảng, theo ngày tạo phiếu giờ VN; bỏ phiếu hủy. */
export function shippingFeeLines(txs: ExpenseTransaction[], from: DateString, to: DateString): ShippingFeeLine[] {
  return txs
    .filter((t) => /^Thanh toán phí vận chuyển/i.test(t.name ?? "") && !t.is_canceled)
    .map((t) => ({ date: vnDate(t.posted_at), amount: -t.amount }))
    .filter((l) => l.date >= from && l.date <= to);
}

export interface CashOutDay {
  date: DateString;
  /** Chi theo loại thẻ (tên thẻ → số dương). */
  byCategory: Record<string, number>;
  shippingFee: number;
  /** Tổng chi trong ngày (số dương). */
  total: number;
}

/** Cột chi phí "Khác" luôn có sẵn (thẻ "Khác" trên Pancake), kể cả khi chưa có phiếu nào. */
export const OTHER_EXPENSE = "Khác";

/**
 * Tiền chi từng ngày trong [from, to] (kể cả ngày không chi = 0) và danh sách loại chi để làm cột:
 * mọi thẻ đã đặt tên (`knownCategories`) + thẻ có tiền trong khoảng + "Khác" (luôn có).
 * Thứ tự: Sản xuất trước, rồi theo số tiền, thẻ chưa có tiền theo tên, "Khác" cuối.
 */
export function cashOutByDay(
  expenses: ExpenseLine[],
  shippingFees: ShippingFeeLine[],
  from: DateString,
  to: DateString,
  knownCategories: string[] = [],
): { days: CashOutDay[]; categories: string[] } {
  const days: CashOutDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, byCategory: {}, shippingFee: 0, total: 0 });
  const index = new Map(days.map((d, i) => [d.date, i]));
  const inRange = expenses.filter((l) => index.has(l.date));
  for (const l of inRange) {
    const day = days[index.get(l.date)!];
    day.byCategory[l.category] = (day.byCategory[l.category] ?? 0) + l.amount;
    day.total += l.amount;
  }
  for (const l of shippingFees) {
    const i = index.get(l.date);
    if (i === undefined) continue;
    days[i].shippingFee += l.amount;
    days[i].total += l.amount;
  }
  const withMoney = groupExpenses(inRange).map((g) => g.category);
  const idle = [...new Set(knownCategories)]
    .filter((c) => c && !withMoney.includes(c))
    .sort((a, b) => Number(b === "Sản xuất") - Number(a === "Sản xuất") || a.localeCompare(b, "vi"));
  const all = [...withMoney, ...idle];
  const isOther = (c: string) => c.toLocaleLowerCase("vi") === OTHER_EXPENSE.toLocaleLowerCase("vi");
  const categories = [...all.filter((c) => !isOther(c)), all.find(isOther) ?? OTHER_EXPENSE];
  return { days, categories };
}

export interface ExpenseGroup {
  category: string;
  total: number;
  lines: ExpenseLine[];
}

/** Gộp theo loại; "Sản xuất" (trả xưởng) lên đầu, còn lại theo số tiền giảm dần. */
export function groupExpenses(lines: ExpenseLine[]): ExpenseGroup[] {
  const map = new Map<string, ExpenseLine[]>();
  for (const l of lines) map.set(l.category, [...(map.get(l.category) ?? []), l]);
  return [...map.entries()]
    .map(([category, ls]) => ({ category, lines: ls, total: ls.reduce((s, l) => s + l.amount, 0) }))
    .sort((a, b) => Number(b.category === "Sản xuất") - Number(a.category === "Sản xuất") || b.total - a.total);
}

export interface MonthFinanceInput {
  month: MonthString;
  today: DateString;
  /** Thống kê Pancake của tháng (đến hôm nay nếu là tháng hiện tại); null nếu không lấy được. */
  pancake: { sales: number; revenue: number; fee: number; partnerFee: number } | null;
  /** Tiền về từng ngày của cả tháng (gồm ngày tới = dự kiến). */
  cashDays: { date: DateString; total: number }[];
  expenses: ExpenseLine[];
  /** Phí ship shop trả riêng (Thu chi Pancake) trong tháng, số dương. */
  shippingFeePaid: number;
  /** Chi phí quảng cáo; null = chưa kết nối. */
  ads: number | null;
}

export interface MonthFinance {
  month: MonthString;
  isCurrentMonth: boolean;
  expenseGroups: ExpenseGroup[];
  expenseTotal: number;
  profit: {
    sales: number | null;
    fee: number | null;
    revenue: number | null;
    /** Phí vận chuyển ngoại sàn shop trả đơn vị vận chuyển (Pancake `partner_fee`). */
    partnerFee: number | null;
    ads: number | null;
    /** null khi không có Doanh thu Pancake. */
    result: number | null;
  };
  cash: {
    /** Tiền về đã tới hạn (tới hôm nay). */
    received: number;
    /** Tiền về dự kiến từ mai tới hết tháng. */
    expected: number;
    shippingFeePaid: number;
    ads: number | null;
    /** Tiền về đã tới hạn − mọi khoản chi đã chi. */
    net: number;
    /** Thêm phần dự kiến về tới cuối tháng. */
    netWithExpected: number;
  };
}

export function buildMonthFinance(i: MonthFinanceInput): MonthFinance {
  const groups = groupExpenses(i.expenses);
  const expenseTotal = groups.reduce((s, g) => s + g.total, 0);
  const ads = i.ads ?? 0;
  const received = i.cashDays.filter((d) => d.date <= i.today).reduce((s, d) => s + d.total, 0);
  const expected = i.cashDays.filter((d) => d.date > i.today).reduce((s, d) => s + d.total, 0);
  const net = received - expenseTotal - i.shippingFeePaid - ads;
  return {
    month: i.month,
    isCurrentMonth: i.today.startsWith(i.month),
    expenseGroups: groups,
    expenseTotal,
    profit: {
      sales: i.pancake?.sales ?? null,
      fee: i.pancake?.fee ?? null,
      revenue: i.pancake?.revenue ?? null,
      partnerFee: i.pancake?.partnerFee ?? null,
      ads: i.ads,
      result: i.pancake ? i.pancake.revenue - i.pancake.partnerFee - expenseTotal - ads : null,
    },
    cash: {
      received,
      expected,
      shippingFeePaid: i.shippingFeePaid,
      ads: i.ads,
      net,
      netWithExpected: net + expected,
    },
  };
}

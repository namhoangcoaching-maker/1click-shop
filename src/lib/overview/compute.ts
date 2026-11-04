/**
 * Công thức tiền của trang Tổng quan (thuần tính toán, có unit test). Chủ dự án chốt 04/11/2026:
 *
 *   Doanh số   = tổng giá bán × số lượng của đơn chốt (Pancake: total_price)
 *   Hàng hoàn  = giá trị hàng khách trả lại (số lượng hoàn × giá bán)
 *   Phí sàn    = phí Pancake ghi × phần hàng khách giữ lại (đơn hoàn không tính phí)
 *                + phí cố định mỗi đơn hoàn của sàn (Shopee: PiShip) – RETURN_FEE_PER_ORDER
 *   Doanh thu  = (Doanh số − Chiết khấu) × phần hàng khách giữ − Phí sàn   (giống Pancake: đã trừ phí sàn)
 *   Lợi nhuận  = Doanh thu − Giá vốn hàng khách giữ                        (giống Pancake)
 *
 * Giá vốn = giá nhập trung bình HIỆN TẠI của mã (Pancake không lưu giá vốn theo từng đơn).
 */
import { addDays, listDays, type DateRange, type DateString } from "@/lib/date-range";
import { RETURN_STATUSES } from "@/lib/pancake/map";
import type { Metric, MetricKey, OrderSourceRow, OrderTotals, SeriesPoint, TopProduct } from "./types";

/**
 * Phí sàn vẫn bị trừ cho MỖI đơn hoàn (theo tên nguồn đơn trên Pancake).
 * Shopee PiShip: 2.700 ₫/đơn từ 23/05/2026 theo Sapo (chưa thấy thông báo chính thức của Shopee) –
 * chủ shop đối chiếu Kênh Người Bán rồi sửa số ở đây nếu khác.
 */
export const RETURN_FEE_PER_ORDER: Readonly<Record<string, number>> = { Shopee: 2_700 };

/** Một đơn chốt như hàm database overview_orders trả về. */
export interface OrderFacts {
  order_id: string;
  inserted_at: string;
  status: number;
  source: string | null;
  total_price: number;
  total_discount: number;
  fee_marketplace: number;
  returned_value: number;
  kept_cost: number;
  kept_qty_without_cost: number;
}

export interface OrderMoney {
  gross: number;
  discount: number;
  returnedValue: number;
  isReturn: boolean;
  fee: number;
  revenue: number;
  cost: number;
  profit: number;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function orderMoney(o: OrderFacts): OrderMoney {
  const gross = n(o.total_price);
  const discount = n(o.total_discount);
  const returnedValue = Math.min(gross, Math.max(0, n(o.returned_value)));
  const kept = gross > 0 ? (gross - returnedValue) / gross : 0;
  const isReturn = returnedValue > 0 || RETURN_STATUSES.includes(o.status);
  const returnFee = isReturn ? (RETURN_FEE_PER_ORDER[o.source ?? ""] ?? 0) : 0;
  const fee = n(o.fee_marketplace) * kept + returnFee;
  const revenue = (gross - discount) * kept - fee;
  const cost = n(o.kept_cost);
  return { gross, discount, returnedValue, isReturn, fee, revenue, cost, profit: revenue - cost };
}

/** Ngày và giờ theo giờ Việt Nam của một mốc thời gian. */
function vnParts(iso: string): { date: DateString; hour: number } {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

/** Khoảng ngày (giờ Việt Nam) → mốc bắt đầu và mốc kết thúc (không gồm) theo giờ quốc tế. */
export function rangeToInstants(range: DateRange): { start: string; end: string } {
  return {
    start: new Date(`${range.from}T00:00:00+07:00`).toISOString(),
    end: new Date(`${addDays(range.to, 1)}T00:00:00+07:00`).toISOString(),
  };
}

interface Totals {
  gross: number;
  discount: number;
  revenue: number;
  profit: number;
  fee: number;
  orders: number;
  returnedValue: number;
  returnedOrders: number;
}

const zero = (): Totals => ({
  gross: 0,
  discount: 0,
  revenue: 0,
  profit: 0,
  fee: 0,
  orders: 0,
  returnedValue: 0,
  returnedOrders: 0,
});

function add(t: Totals, m: OrderMoney) {
  t.gross += m.gross;
  t.discount += m.discount;
  t.revenue += m.revenue;
  t.profit += m.profit;
  t.fee += m.fee;
  t.orders += 1;
  t.returnedValue += m.returnedValue;
  if (m.isReturn) t.returnedOrders += 1;
}

function totalsOf(rows: OrderFacts[]): Totals {
  const t = zero();
  for (const r of rows) add(t, orderMoney(r));
  return t;
}

/** Cộng theo giờ (khoảng 1 ngày) hoặc theo ngày; mỗi ô có đủ chỉ số. */
function bucketize(rows: OrderFacts[], range: DateRange): { labels: string[]; buckets: Totals[] } {
  const hourly = range.from === range.to;
  const days = listDays(range);
  const labels = hourly ? Array.from({ length: 24 }, (_, h) => `${h}h`) : days.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`);
  const buckets = labels.map(zero);
  for (const r of rows) {
    const { date, hour } = vnParts(r.inserted_at);
    const i = hourly ? hour : days.indexOf(date);
    if (i >= 0) add(buckets[i], orderMoney(r));
  }
  return { labels, buckets };
}

const METRIC_DEFS: {
  key: MetricKey;
  label: string;
  format: "vnd" | "number";
  positiveIsGood: boolean;
  hint: string;
  pick: (t: Totals) => number;
}[] = [
  { key: "grossSales", label: "Doanh số", format: "vnd", positiveIsGood: true, hint: "Tổng giá bán × số lượng của đơn chốt (từ Đã xác nhận trở đi).", pick: (t) => t.gross },
  { key: "revenue", label: "Doanh thu", format: "vnd", positiveIsGood: true, hint: "Doanh số − chiết khấu − hàng hoàn − phí sàn (giống Pancake).", pick: (t) => t.revenue },
  { key: "profit", label: "Lợi nhuận", format: "vnd", positiveIsGood: true, hint: "Doanh thu − giá vốn hàng khách giữ (giá nhập trung bình hiện tại). Chưa trừ quảng cáo, lương, mặt bằng.", pick: (t) => t.profit },
  { key: "orders", label: "Đơn chốt", format: "number", positiveIsGood: true, hint: "Số đơn từ Đã xác nhận trở đi, kể cả đơn hoàn.", pick: (t) => t.orders },
  { key: "aov", label: "GTTB", format: "vnd", positiveIsGood: true, hint: "Giá trị trung bình mỗi đơn = Doanh số ÷ Đơn chốt.", pick: (t) => (t.orders ? t.gross / t.orders : 0) },
  { key: "platformFees", label: "Phí sàn", format: "vnd", positiveIsGood: false, hint: "Phí Shopee, TikTok… trên phần hàng khách giữ, cộng phí cố định mỗi đơn hoàn (Shopee PiShip).", pick: (t) => t.fee },
];

export interface OverviewNumbers {
  metrics: Metric[];
  closedOrders: OrderTotals;
  returnedOrders: OrderTotals;
  sources: OrderSourceRow[];
  /** Số lượng hàng (khách giữ) chưa có giá vốn: lợi nhuận đang bị tính cao hơn thực tế. */
  qtyWithoutCost: number;
}

export function buildOverviewNumbers(
  current: OrderFacts[],
  previous: OrderFacts[] | null,
  range: DateRange,
  previousRange: DateRange | null,
): OverviewNumbers {
  const cur = totalsOf(current);
  const prev = previous ? totalsOf(previous) : null;
  const curB = bucketize(current, range);
  const prevB = previous && previousRange ? bucketize(previous, previousRange) : null;

  const metrics: Metric[] = METRIC_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    format: d.format,
    positiveIsGood: d.positiveIsGood,
    hint: d.hint,
    value: d.pick(cur),
    previous: prev ? d.pick(prev) : null,
    series: curB.labels.map(
      (label, i): SeriesPoint => ({
        label,
        current: d.pick(curB.buckets[i]),
        previous: prevB && i < prevB.buckets.length ? d.pick(prevB.buckets[i]) : null,
      }),
    ),
  }));

  // Nguồn đơn: doanh thu (so kỳ trước), lợi nhuận, số đơn. Nguồn trống ghi "Khác".
  const bySource = new Map<string, { cur: Totals; prev: Totals | null }>();
  const slot = (s: string | null) => {
    const key = s ?? "Khác";
    if (!bySource.has(key)) bySource.set(key, { cur: zero(), prev: previous ? zero() : null });
    return bySource.get(key)!;
  };
  for (const r of current) add(slot(r.source).cur, orderMoney(r));
  for (const r of previous ?? []) {
    const s = slot(r.source);
    if (s.prev) add(s.prev, orderMoney(r));
  }
  const sources: OrderSourceRow[] = [...bySource.entries()]
    .map(([source, v]) => ({
      source,
      gross: v.cur.gross,
      revenue: { value: v.cur.revenue, previous: v.prev ? v.prev.revenue : null },
      profit: v.cur.profit,
      orders: v.cur.orders,
    }))
    .filter((s) => s.orders > 0 || (s.revenue.previous ?? 0) !== 0)
    .sort((a, b) => b.revenue.value - a.revenue.value);

  return {
    metrics,
    closedOrders: {
      amount: { value: cur.gross, previous: prev ? prev.gross : null },
      count: { value: cur.orders, previous: prev ? prev.orders : null },
    },
    returnedOrders: {
      amount: { value: cur.returnedValue, previous: prev ? prev.returnedValue : null },
      count: { value: cur.returnedOrders, previous: prev ? prev.returnedOrders : null },
    },
    sources,
    qtyWithoutCost: current.reduce((s, r) => s + n(r.kept_qty_without_cost), 0),
  };
}

/** Một dòng của hàm database product_sales. */
export interface ProductSalesRow {
  variation_id: string | null;
  quantity: number;
  returned: number;
  gross: number;
}

export interface ProductInfo {
  variation_id: string;
  product_id: string;
  name: string;
  sku: string | null;
}

/**
 * Top sản phẩm theo MẪU (cộng mọi màu/size), xếp theo doanh số hàng khách giữ.
 * Dòng hàng không gắn mã sản phẩm (hoặc mã đã xóa) gom vào "Sản phẩm chưa liên kết".
 */
export function buildTopProducts(rows: ProductSalesRow[], products: ProductInfo[], limit = 5): TopProduct[] {
  const info = new Map(products.map((p) => [p.variation_id, p]));
  const groups = new Map<string, TopProduct>();
  for (const r of rows) {
    const p = r.variation_id ? info.get(r.variation_id) : undefined;
    const key = p ? p.product_id : "__unlinked";
    const g =
      groups.get(key) ??
      ({ productId: p?.product_id, name: p ? p.name : "Sản phẩm chưa liên kết", sku: null, quantity: 0, revenue: 0, linked: Boolean(p) } as TopProduct);
    g.quantity += Math.max(0, n(r.quantity) - n(r.returned));
    g.revenue += n(r.gross);
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.quantity > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** Số dòng hàng (đơn chốt) không gắn được với sản phẩm đang có trên Pancake. */
export function unlinkedQuantity(rows: ProductSalesRow[], products: ProductInfo[]): number {
  const known = new Set(products.map((p) => p.variation_id));
  return rows
    .filter((r) => !r.variation_id || !known.has(r.variation_id))
    .reduce((s, r) => s + Math.max(0, n(r.quantity) - n(r.returned)), 0);
}

/**
 * Chuyển số liệu thống kê của Pancake thành các khối trang Tổng quan (thuần, có unit test).
 * KHÔNG tự tính lại tiền: lấy nguyên số Pancake để luôn khớp màn hình Thống kê của Pancake.
 */
import { listDays, type DateRange } from "@/lib/date-range";
import type { SaleField, SaleRow } from "@/lib/pancake/analytics";
import type { Metric, MetricKey, OrderSourceRow, OrderTotals, SeriesPoint, TopProduct } from "./types";

const METRICS: {
  key: MetricKey;
  field: SaleField;
  label: string;
  format: "vnd" | "number";
  positiveIsGood: boolean;
  hint: string;
}[] = [
  { key: "grossSales", field: "sales", label: "Doanh số", format: "vnd", positiveIsGood: true, hint: "Doanh số theo Pancake." },
  { key: "revenue", field: "revenue", label: "Doanh thu", format: "vnd", positiveIsGood: true, hint: "Doanh thu theo Pancake: đã trừ chiết khấu, phí sàn và doanh thu hàng hoàn." },
  { key: "profit", field: "profit", label: "Lợi nhuận", format: "vnd", positiveIsGood: true, hint: "Lợi nhuận theo Pancake = Doanh thu − Giá vốn. Chưa trừ quảng cáo, lương, mặt bằng." },
  { key: "orders", field: "success_order_count", label: "Đơn chốt", format: "number", positiveIsGood: true, hint: "Số đơn thành công theo Pancake." },
  { key: "aov", field: "avg_order", label: "GTTB", format: "vnd", positiveIsGood: true, hint: "Giá trị trung bình đơn = Doanh thu không trừ hoàn ÷ Đơn chốt (Pancake)." },
  { key: "platformFees", field: "fee_marketplace", label: "Phí sàn", format: "vnd", positiveIsGood: false, hint: "Phí Shopee, TikTok… theo Pancake." },
];

const v = (n: number | undefined) => n ?? 0;

export interface PancakeStatsInput {
  range: DateRange;
  previousRange: DateRange | null;
  total: SaleRow | undefined;
  previousTotal: SaleRow | undefined;
  /** Chia theo giờ (khoảng 1 ngày) hoặc theo ngày. */
  series: SaleRow[];
  previousSeries: SaleRow[];
  bySource: SaleRow[];
  previousBySource: SaleRow[];
  sourceNames: Map<string, string>;
  byProduct: SaleRow[];
}

export interface PancakeOverview {
  metrics: Metric[];
  closedOrders: OrderTotals;
  returnedOrders: OrderTotals;
  sources: OrderSourceRow[];
  topProducts: TopProduct[];
}

/** Nhãn và khóa của từng ô biểu đồ: 24 giờ, hoặc từng ngày trong khoảng. */
function buckets(range: DateRange): { keys: string[]; labels: string[] } {
  if (range.from === range.to) {
    const keys = Array.from({ length: 24 }, (_, h) => String(h));
    return { keys, labels: keys.map((h) => `${h}h`) };
  }
  const days = listDays(range);
  return { keys: days, labels: days.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`) };
}

/** Khóa thời gian Pancake trả về: giờ "07" hoặc "7", ngày "2026-11-04". */
function normKey(key: string | null): string {
  if (key == null) return "";
  return /^\d{1,2}$/.test(key) ? String(Number(key)) : key.slice(0, 10);
}

export function buildPancakeOverview(i: PancakeStatsInput): PancakeOverview {
  const cur = buckets(i.range);
  const prev = i.previousRange ? buckets(i.previousRange) : null;
  const curMap = new Map(i.series.map((r) => [normKey(r.key), r]));
  const prevMap = new Map(i.previousSeries.map((r) => [normKey(r.key), r]));

  const metrics: Metric[] = METRICS.map((m) => ({
    key: m.key,
    label: m.label,
    format: m.format,
    positiveIsGood: m.positiveIsGood,
    hint: m.hint,
    value: v(i.total?.result[m.field]),
    previous: i.previousRange ? v(i.previousTotal?.result[m.field]) : null,
    series: cur.keys.map(
      (k, idx): SeriesPoint => ({
        label: cur.labels[idx],
        current: v(curMap.get(k)?.result[m.field]),
        previous: prev && idx < prev.keys.length ? v(prevMap.get(prev.keys[idx])?.result[m.field]) : null,
      }),
    ),
  }));

  const pair = (field: "price" | "product_count", part: "success" | "returned") => ({
    value: v(i.total?.[part][field]),
    previous: i.previousRange ? v(i.previousTotal?.[part][field]) : null,
  });

  const name = (key: string | null) => (key == null ? "Khác" : (i.sourceNames.get(key) ?? `Nguồn ${key}`));
  // Gộp nguồn của cả 2 kỳ: nguồn chỉ có đơn ở kỳ trước vẫn hiện (0 đơn) để tổng "so kỳ trước" đúng.
  const curBySource = new Map(i.bySource.map((r) => [name(r.key), r]));
  const prevBySource = new Map(i.previousBySource.map((r) => [name(r.key), r]));
  const sources: OrderSourceRow[] = [...new Set([...curBySource.keys(), ...prevBySource.keys()])]
    .map((label) => {
      const r = curBySource.get(label);
      const p = prevBySource.get(label);
      return {
        source: label,
        // GTTB của bảng = gross ÷ đơn chốt; Pancake: Doanh thu không trừ hoàn ÷ Đơn chốt.
        gross: v(r?.result.net_revenue),
        revenue: { value: v(r?.result.revenue), previous: i.previousRange ? v(p?.result.revenue) : null },
        profit: v(r?.result.profit),
        orders: v(r?.result.success_order_count),
      };
    })
    .filter((s) => s.orders !== 0 || s.revenue.value !== 0 || (s.revenue.previous ?? 0) !== 0)
    .sort((a, b) => b.revenue.value - a.revenue.value);

  const topProducts: TopProduct[] = i.byProduct
    .filter((r) => r.key && v(r.result.product_count) > 0)
    .map((r) => ({
      productId: r.key!,
      name: r.productName ?? "Sản phẩm không tên",
      sku: null,
      quantity: v(r.result.product_count),
      revenue: v(r.result.revenue),
      linked: true,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    metrics,
    closedOrders: { amount: pair("price", "success"), count: pair("product_count", "success") },
    returnedOrders: { amount: pair("price", "returned"), count: pair("product_count", "returned") },
    sources,
    topProducts,
  };
}

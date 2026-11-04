/**
 * Bộ thống kê đơn hàng của chính Pancake: GET /shops/{id}/analytics/sale
 * (tài liệu: docs.pancake.biz/pos/api, mục Analytics). Dùng để số tiền trên 1Click KHỚP Pancake
 * (Doanh số, Doanh thu, Lợi nhuận, Đơn chốt, GTTB, Phí sàn, Hàng chốt, Hàng hoàn).
 * Đã đối chiếu 04/11/2026 với màn hình Thống kê của Pancake: khớp từng đồng.
 */
import { pancakeGet, type PancakeCredentials } from "./client";

/** Các số liệu cần lấy (tên trường theo get_analytic_fields của Pancake). */
export const SALE_FIELDS = [
  "sales", // Doanh số
  "revenue", // Doanh thu (đã trừ chiết khấu, phí sàn, doanh thu hoàn)
  "net_revenue", // Doanh thu không trừ hoàn (Pancake tính GTTB từ số này)
  "profit", // Lợi nhuận
  "success_order_count", // Đơn chốt
  "avg_order", // GTTB
  "fee_marketplace", // Phí sàn
  "product_count", // SL bán thực
  "price", // Tiền hàng
  "returned_order_count", // Đơn hoàn
] as const;

export type SaleField = (typeof SALE_FIELDS)[number];
export type SaleNumbers = Partial<Record<SaleField, number>>;

export interface SaleRow {
  /** Giá trị nhóm, ví dụ "12" (giờ), "2026-11-04" (ngày), "-3" (nguồn đơn), mã sản phẩm. */
  key: string | null;
  result: SaleNumbers;
  /** Hàng chốt: price = Tổng tiền, product_count = Số lượng sản phẩm. */
  success: SaleNumbers;
  /** Hàng hoàn: price = Tổng tiền, product_count = Số lượng sản phẩm. */
  returned: SaleNumbers;
  /** Tên sản phẩm (khi chia theo sản phẩm). */
  productName?: string;
}

export type SplitBy = "Time.hour" | "Time.day" | "Order.order_sources" | "Variation.product_id";

const num = (o: Record<string, unknown> | null | undefined): SaleNumbers =>
  Object.fromEntries(
    Object.entries(o ?? {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
  ) as SaleNumbers;

/** Đọc kết quả thô của Pancake (tách riêng để có unit test). */
export function parseSaleResponse(body: unknown, splitBy?: SplitBy): SaleRow[] {
  const data = (body as { data?: Record<string, unknown>[] })?.data ?? [];
  return data.map((d) => ({
    key: splitBy ? (d[splitBy] == null ? null : String(d[splitBy])) : null,
    result: num(d.result as Record<string, unknown>),
    success: num(d.success as Record<string, unknown>),
    returned: num(d.returned as Record<string, unknown>),
    productName: (d.product as { name?: string } | undefined)?.name,
  }));
}

/** Khoảng thời gian theo giờ quốc tế (Pancake nhận since/until dạng ISO). */
export async function fetchSaleStats(
  creds: PancakeCredentials,
  range: { since: string; until: string },
  splitBy?: SplitBy,
): Promise<SaleRow[]> {
  const q = new URLSearchParams();
  for (const f of SALE_FIELDS) q.append("select_fields[]", f);
  if (splitBy) q.append("split_by[]", splitBy);
  const body = await pancakeGet(creds, `/analytics/sale?${q}`, range);
  return parseSaleResponse(body, splitBy);
}

/** Tên mặc định của các nguồn hệ thống Pancake (khi danh sách nguồn của shop không có). */
const DEFAULT_SOURCE_NAMES: Record<string, string> = {
  "-1": "Facebook",
  "-3": "Shopee",
  "-9": "TikTok",
  "-11": "Instagram",
  "-17": "Shopify",
};

/** Bảng mã nguồn đơn → tên, từ GET /shops/{id}/order_source. */
export function parseOrderSources(body: unknown): Map<string, string> {
  const list = ((body as { data?: unknown })?.data ?? body) as { id?: unknown; name?: unknown }[];
  const map = new Map(Object.entries(DEFAULT_SOURCE_NAMES));
  if (Array.isArray(list)) {
    for (const s of list) if (s.id != null && typeof s.name === "string") map.set(String(s.id), s.name);
  }
  return map;
}

export async function fetchOrderSources(creds: PancakeCredentials): Promise<Map<string, string>> {
  return parseOrderSources(await pancakeGet(creds, "/order_source"));
}

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
  "capital", // Giá vốn hàng bán (đã trừ hàng hoàn); Lợi nhuận Pancake = revenue − capital − partner_fee
  "partner_fee", // Phí vận chuyển shop trả đơn vị vận chuyển (đơn ngoại sàn; Doanh thu KHÔNG trừ khoản này)
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
  /** Tên, mã mẫu (custom_id, ví dụ SC155) và ảnh đầu tiên (khi chia theo sản phẩm). */
  productName?: string;
  productCode?: string;
  productImage?: string;
}

/** Order.assigning_seller_id: doanh thu theo nhân viên bán (null = đơn không gán; cộng lại = cả shop, đã đối chiếu 05/11/2026). */
export type SplitBy = "Time.hour" | "Time.day" | "Order.order_sources" | "Variation.product_id" | "Order.assigning_seller_id";

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
    ...productInfo(d.product),
  }));
}

function productInfo(product: unknown): Pick<SaleRow, "productName" | "productCode" | "productImage"> {
  const p = (product ?? {}) as { name?: unknown; custom_id?: unknown; images?: unknown };
  const image = Array.isArray(p.images) ? p.images.find((x): x is string => typeof x === "string" && /^https:\/\//.test(x)) : undefined;
  return {
    productName: typeof p.name === "string" ? p.name : undefined,
    productCode: typeof p.custom_id === "string" && p.custom_id ? p.custom_id : undefined,
    productImage: image,
  };
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

/** Nhân viên trên Pancake: GET /shops/{id}/users → [mã, tên] (mã = assigning_seller_id của đơn). Bỏ tài khoản API. */
export function parsePancakeUsers(body: unknown): [string, string][] {
  const list = (body as { data?: { user?: { id?: unknown; name?: unknown } }[] })?.data ?? [];
  return list
    .map((x) => x.user)
    .filter((u): u is { id: string; name: string } => typeof u?.id === "string" && typeof u.name === "string")
    .map((u) => [u.id, u.name] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1], "vi"));
}

export async function fetchPancakeUsers(creds: PancakeCredentials): Promise<[string, string][]> {
  return parsePancakeUsers(await pancakeGet(creds, "/users"));
}

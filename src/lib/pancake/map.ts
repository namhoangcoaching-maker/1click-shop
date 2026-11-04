/**
 * Đổi dữ liệu thô của Pancake POS sang dòng trong database 1Click.
 * Tên trường đã đối chiếu với tài liệu chính thức (docs.pancake.biz/pos/api) VÀ dữ liệu thật của shop.
 * Cố ý KHÔNG lấy thông tin cá nhân của khách (bill_full_name, bill_phone_number, shipping_address…).
 */

/** Mã trạng thái đơn của Pancake (tài liệu: tham số updateStatus; 6 = canceled thấy trong dữ liệu thật). */
export const ORDER_STATUS = {
  0: "Mới",
  11: "Chờ hàng",
  20: "Đã đặt hàng",
  1: "Đã xác nhận",
  12: "Chờ in",
  13: "Đã in",
  8: "Đang đóng hàng",
  9: "Chờ chuyển hàng",
  2: "Đã gửi hàng",
  3: "Đã nhận",
  16: "Đã thu tiền",
  4: "Đang hoàn",
  15: "Hoàn một phần",
  5: "Đã hoàn",
  6: "Đã hủy",
  7: "Đã xóa",
} as const satisfies Record<number, string>;

export function orderStatusLabel(status: number): string {
  return (ORDER_STATUS as Record<number, string>)[status] ?? `Trạng thái ${status}`;
}

/**
 * Đơn chốt: từ "Đã xác nhận" trở đi, kể cả đơn hoàn (chủ dự án chốt 04/11/2026).
 * Không tính: Mới, Chờ hàng, Đã đặt hàng, Đã hủy, Đã xóa.
 */
export const CONFIRMED_STATUSES: readonly number[] = [1, 12, 13, 8, 9, 2, 3, 16, 4, 15, 5];
/** Đơn hoàn (đang hoàn, hoàn một phần, đã hoàn). */
export const RETURN_STATUSES: readonly number[] = [4, 15, 5];

export function isConfirmed(status: number): boolean {
  return CONFIRMED_STATUSES.includes(status);
}

/** Pancake trả giờ quốc tế không kèm múi giờ: "2026-11-04T13:41:31.000000" → Date ISO. */
export function parsePancakeTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

type Raw = Record<string, unknown>;

export interface ProductRow {
  variation_id: string;
  product_id: string;
  sku: string | null;
  name: string;
  variant: string | null;
  retail_price: number;
  cost_price: number | null;
  stock: number;
  internal_note: string | null;
  is_hidden: boolean;
  pancake_updated_at: string | null;
}

/** Một mã màu/size (variation) của Pancake → dòng bảng products. Thiếu id thì bỏ qua (null). */
export function mapVariation(raw: Raw): ProductRow | null {
  const id = str(raw.id);
  if (!id) return null;
  const product = (raw.product ?? {}) as Raw;
  const fields = Array.isArray(raw.fields) ? (raw.fields as Raw[]) : [];
  const variant = fields
    .map((f) => str(f.value))
    .filter(Boolean)
    .join(" / ");
  const cost = int(raw.average_imported_price);
  return {
    variation_id: id,
    product_id: str(raw.product_id) ?? id,
    sku: str(raw.display_id),
    name: str(product.name) ?? str(raw.display_id) ?? "Không tên",
    variant: variant || null,
    retail_price: int(raw.retail_price),
    // Giá nhập trung bình (chủ dự án chốt). 0 nghĩa là chưa nhập giá vốn.
    cost_price: cost > 0 ? cost : null,
    stock: int(raw.remain_quantity),
    internal_note: str(product.note),
    is_hidden: raw.is_hidden === true,
    pancake_updated_at: parsePancakeTime(raw.updated_at),
  };
}

export interface OrderRow {
  /** Mã đơn Pancake, là CHỮ (đơn sàn có dạng "261104EK2E1FYN"). */
  order_id: string;
  /** Số thứ tự đơn trong shop trên Pancake. */
  system_id: number | null;
  inserted_at: string;
  pancake_updated_at: string | null;
  status: number;
  source: string | null;
  total_price: number;
  total_discount: number;
  shipping_fee: number;
  surcharge: number;
  fee_marketplace: number;
  partner_fee: number;
  tax: number;
  total_after_discount: number;
  total_quantity: number;
  seller_id: string | null;
  /** Lần đầu đơn sang "Đã nhận" (khách nhận hàng), theo lịch sử trạng thái. */
  delivered_at: string | null;
  /** Lần đầu đơn sang "Đã hoàn". */
  returned_at: string | null;
  /** Lần đầu đơn sang "Hoàn một phần". */
  partial_returned_at: string | null;
  /** Tiền thu hộ (COD); với đơn sàn = tiền sàn trả (đã trừ phí sàn). Có thể âm khi khách trả trước dư. */
  cod: number;
  /** Mã đơn vị vận chuyển trên Pancake (42 SPX, 15 J&T, 3 VTP…). */
  carrier_id: number | null;
  /** Giá trị hàng khách trả lại (số lượng hoàn × giá bán). */
  returned_value: number;
}

export interface OrderItemRow {
  order_id: string;
  item_id: string;
  variation_id: string | null;
  product_id: string | null;
  quantity: number;
  retail_price: number;
  discount_each_product: number;
  total_discount: number;
  return_quantity: number;
  is_bonus: boolean;
}

/** Một đơn của Pancake → dòng đơn + các dòng hàng. Đơn thiếu id/ngày tạo thì bỏ qua (null). */
export function mapOrder(raw: Raw): { order: OrderRow; items: OrderItemRow[] } | null {
  // Mã đơn có thể là số (đơn tạo trên Pancake) hoặc chữ (đơn sàn): luôn lưu dạng chữ.
  const orderId = typeof raw.id === "number" ? String(raw.id) : str(raw.id);
  const insertedAt = parsePancakeTime(raw.inserted_at);
  if (!orderId || !insertedAt) return null;

  const items = (Array.isArray(raw.items) ? (raw.items as Raw[]) : []).map((it, i) => {
    const info = (it.variation_info ?? {}) as Raw;
    return {
      order_id: orderId,
      item_id: str(it.id) ?? `#${i}`,
      variation_id: str(it.variation_id),
      product_id: str(it.product_id),
      quantity: int(it.quantity),
      retail_price: int(info.retail_price),
      discount_each_product: int(it.discount_each_product),
      total_discount: int(it.total_discount),
      return_quantity: int(it.return_quantity),
      is_bonus: it.is_bonus_product === true,
    };
  });

  return {
    order: {
      order_id: orderId,
      system_id: int(raw.system_id) || null,
      inserted_at: insertedAt,
      pancake_updated_at: parsePancakeTime(raw.updated_at),
      status: int(raw.status),
      source: str(raw.order_sources_name),
      total_price: int(raw.total_price),
      total_discount: int(raw.total_discount),
      shipping_fee: int(raw.shipping_fee),
      surcharge: int(raw.surcharge),
      fee_marketplace: int(raw.fee_marketplace),
      partner_fee: int(raw.partner_fee),
      tax: int(raw.tax),
      total_after_discount: int(raw.total_price_after_sub_discount),
      total_quantity: int(raw.total_quantity),
      seller_id: str(raw.assigning_seller_id),
      delivered_at: firstStatusTime(raw.status_history, 3),
      returned_at: firstStatusTime(raw.status_history, 5),
      partial_returned_at: firstStatusTime(raw.status_history, 15),
      cod: int(raw.cod),
      carrier_id: carrierId(raw.partner),
      returned_value: items.reduce((s, it) => s + it.return_quantity * it.retail_price, 0),
    },
    items,
  };
}

/** Lần đầu đơn chuyển sang trạng thái `status` (giờ quốc tế ISO), từ status_history của Pancake. */
export function firstStatusTime(history: unknown, status: number): string | null {
  if (!Array.isArray(history)) return null;
  const times = (history as Raw[])
    .filter((h) => int(h.status) === status && typeof h.updated_at === "string")
    .map((h) => parsePancakeTime(h.updated_at))
    .filter((t): t is string => t !== null)
    .sort();
  return times[0] ?? null;
}

function carrierId(partner: unknown): number | null {
  const id = (partner as Raw | null)?.partner_id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export interface TransactionRow {
  transaction_id: string;
  posted_at: string;
  amount: number;
  name: string | null;
  kind: number | null;
  account: string | null;
  order_display_id: string | null;
  is_canceled: boolean;
}

/** Một dòng Thu chi của Pancake → dòng bảng cash_transactions. */
export function mapTransaction(raw: Raw): TransactionRow | null {
  const id = str(raw.id);
  const postedAt = parsePancakeTime(raw.posted_at) ?? parsePancakeTime(raw.inserted_at);
  if (!id || !postedAt) return null;
  return {
    transaction_id: id,
    posted_at: postedAt,
    amount: int(raw.amount),
    name: str(raw.name),
    kind: raw.type_transaction == null ? null : int(raw.type_transaction),
    account: raw.account == null ? null : String(raw.account),
    order_display_id: raw.ref_display_id == null ? null : String(raw.ref_display_id),
    is_canceled: raw.is_canceled === true,
  };
}

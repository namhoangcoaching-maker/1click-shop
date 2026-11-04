/**
 * Tiền về theo luật thanh toán của từng kênh (chủ dự án chốt 05/11/2026, thuần tính toán, có unit test).
 * Không cần đối soát tay: tính từ thời điểm khách nhận / hoàn hàng mà Pancake ghi.
 *
 *  - Shopee: ngày khách nhận + 4 ngày, số tiền = tiền sàn trả (COD của đơn sàn, đã trừ phí sàn).
 *  - TikTok: ngày khách nhận + 7 ngày.
 *  - Đơn ngoại sàn có đơn vị vận chuyển (SPX, J&T, VTP…): ngày khách nhận + 3 ngày,
 *    số tiền = COD − phí ship (trừ khi phí ship đã trả riêng trong Thu chi).
 *  - Đơn không qua đơn vị vận chuyển: tiền COD về ngay ngày khách nhận.
 *  - Khách chuyển khoản trước / Shopify: theo Thu chi Pancake, về đúng ngày giao dịch
 *    (kể cả dòng âm khi hủy/hoàn/đổi số tiền trả trước).
 *  - Đơn ĐÃ NHẬN rồi mới hoàn: trừ lại số đã tính vào ngày đơn sang "Đã hoàn"
 *    (hoàn một phần: trừ theo tỷ lệ giá trị hàng hoàn).
 */
import { addDays, type DateString } from "@/lib/date-range";

export const CASH_RULES = {
  /** Số ngày sàn trả tiền sau khi khách nhận, theo tên nguồn đơn trên Pancake. */
  marketplaceDelay: { Shopee: 4, Tiktok: 7, TikTok: 7 } as Record<string, number>,
  /** Đơn ngoại sàn qua đơn vị vận chuyển (SPX, J&T…): số ngày tiền COD về sau khi khách nhận. */
  carrierDelay: 3,
};

/** Tên đơn vị vận chuyển theo mã Pancake (GET /partners). */
export const CARRIER_NAMES: Record<number, string> = {
  42: "SPX Express",
  15: "J&T",
  3: "Viettel Post",
  11: "Ahamove",
  32: "SuperShip",
  5: "GHN",
  1: "GHTK",
  17: "VNPost",
  19: "Ninja Van",
  37: "Grab Express",
  156: "Lalamove",
};

export interface CashOrder {
  order_id: string;
  system_id: number | null;
  source: string | null;
  total_price: number;
  cod: number;
  partner_fee: number;
  carrier_id: number | null;
  delivered_at: string | null;
  returned_at: string | null;
  partial_returned_at: string | null;
  returned_value: number;
}

export interface CashTransaction {
  posted_at: string;
  amount: number;
  name: string | null;
  order_display_id: string | null;
}

export interface CashEvent {
  date: DateString;
  amount: number;
  /** Nhóm hiển thị: "Shopee", "TikTok", "SPX Express", "Chuyển khoản trước"… */
  channel: string;
  kind: "payout" | "refund" | "prepaid";
}

/** Ngày theo giờ Việt Nam của một mốc thời gian. */
export function vnDate(iso: string): DateString {
  return new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
}

const isShippingFeeLine = (t: CashTransaction) => /^Thanh toán phí vận chuyển/i.test(t.name ?? "");

function channelOf(o: CashOrder): { channel: string; delay: number; marketplace: boolean } {
  const m = CASH_RULES.marketplaceDelay[o.source ?? ""];
  if (m !== undefined) return { channel: o.source === "Tiktok" ? "TikTok" : (o.source as string), delay: m, marketplace: true };
  if (o.carrier_id != null) {
    return {
      channel: CARRIER_NAMES[o.carrier_id] ?? `ĐVVC #${o.carrier_id}`,
      delay: CASH_RULES.carrierDelay,
      marketplace: false,
    };
  }
  return { channel: "Giao trực tiếp", delay: 0, marketplace: false };
}

/** Tất cả khoản tiền về (dương) và bị trừ (âm), mỗi khoản một ngày. */
export function cashEvents(orders: CashOrder[], transactions: CashTransaction[]): CashEvent[] {
  // Đơn đã trả phí ship riêng trong Thu chi: không trừ phí ship khỏi COD nữa.
  const feePaidSeparately = new Set(
    transactions.filter(isShippingFeeLine).map((t) => t.order_display_id).filter((x): x is string => x !== null),
  );
  const events: CashEvent[] = [];

  for (const o of orders) {
    if (!o.delivered_at) continue; // chưa tới tay khách: chưa ai trả tiền
    const { channel, delay, marketplace } = channelOf(o);
    const cod = Math.max(0, o.cod);
    const fee =
      !marketplace && o.carrier_id != null && !feePaidSeparately.has(String(o.system_id ?? "")) ? o.partner_fee : 0;
    const payout = marketplace ? cod : cod - fee;
    if (payout !== 0) {
      events.push({ date: addDays(vnDate(o.delivered_at), delay), amount: payout, channel, kind: "payout" });
    }

    // Hoàn sau khi khách đã nhận: trừ lại tiền hàng (phí ship đã mất thì không trả lại).
    if (o.returned_at && o.returned_at > o.delivered_at) {
      if (cod > 0) events.push({ date: vnDate(o.returned_at), amount: -cod, channel, kind: "refund" });
    } else if (o.partial_returned_at && o.partial_returned_at > o.delivered_at && o.total_price > 0) {
      const share = Math.min(1, Math.max(0, o.returned_value / o.total_price));
      const amount = Math.round(cod * share);
      if (amount > 0) events.push({ date: vnDate(o.partial_returned_at), amount: -amount, channel, kind: "refund" });
    }
  }

  for (const t of transactions) {
    if (isShippingFeeLine(t) || t.amount === 0) continue; // phí ship là tiền đi ra, thuộc Chi phí
    events.push({ date: vnDate(t.posted_at), amount: t.amount, channel: "Chuyển khoản trước", kind: "prepaid" });
  }
  return events;
}

export interface CashDay {
  date: DateString;
  total: number;
  byChannel: Record<string, number>;
}

/** Cộng theo ngày trong [from, to], kể cả ngày không có tiền (= 0). */
export function cashByDay(events: CashEvent[], from: DateString, to: DateString): CashDay[] {
  const days: CashDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, total: 0, byChannel: {} });
  const index = new Map(days.map((d, i) => [d.date, i]));
  for (const e of events) {
    const i = index.get(e.date);
    if (i === undefined) continue;
    days[i].total += e.amount;
    days[i].byChannel[e.channel] = (days[i].byChannel[e.channel] ?? 0) + e.amount;
  }
  return days;
}

/** Các kênh có tiền trong khoảng, xếp theo tổng giảm dần (để làm cột). */
export function channelsOf(days: CashDay[]): string[] {
  const totals = new Map<string, number>();
  for (const d of days) for (const [c, v] of Object.entries(d.byChannel)) totals.set(c, (totals.get(c) ?? 0) + Math.abs(v));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

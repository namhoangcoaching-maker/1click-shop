/**
 * Hóa đơn điện tử: tỷ lệ đã xuất, đơn chưa xuất, hóa đơn cần điều chỉnh (Giai đoạn 7.1, thuần, có unit test).
 * Chủ dự án chốt 06/11/2026:
 *  - Đơn CẦN hóa đơn = đơn khách đã nhận (Pancake tự xuất đúng lúc đơn chuyển "Đã nhận" – đã đối chiếu);
 *    đơn hoàn toàn bộ mà chưa có hóa đơn thì không cần nữa.
 *  - Chưa xuất bị coi là TRỄ từ ngày hôm sau ngày khách nhận.
 *  - Hạn điều chỉnh = hạn nộp tờ khai của kỳ chứa hóa đơn gốc.
 * Cần điều chỉnh (code tự phát hiện): đơn đã hoàn / hoàn một phần / đã hủy mà hóa đơn vẫn "Đã phát hành"
 * và chưa có hóa đơn điều chỉnh / thay thế; tiền hóa đơn lệch mọi cách tính tiền đơn.
 */
import type { DateString } from "@/lib/date-range";
import { vnDateOf } from "@/lib/staff/attendance";
import { daysUntil, periodOf, type VatPeriod } from "./rules";

export const INVOICE_STATUS: Record<number, string> = {
  0: "Chưa phát hành",
  1: "Chờ phát hành",
  2: "Đã phát hành",
  3: "Đã hủy",
  4: "Hóa đơn thay thế",
  5: "Bị thay thế",
  6: "Hóa đơn điều chỉnh",
  7: "Bị điều chỉnh",
};
/** Đã có hóa đơn hợp lệ cho đơn (kể cả đã thay thế / điều chỉnh). */
const ISSUED = new Set([2, 4, 5, 6, 7]);
const PENDING = new Set([0, 1]);

export interface InvoiceLite {
  id: number;
  invoiceNo: string | null;
  series: string | null;
  status: number;
  orderSystemId: string | null;
  originalId: number | null;
  totalAmount: number;
  releasedAt: string | null;
}

export interface OrderLite {
  systemId: string;
  orderId: string;
  source: string | null;
  status: number;
  deliveredAt: string | null;
  returnedAt: string | null;
  partialReturnedAt: string | null;
  totalPrice: number;
  totalDiscount: number;
  shippingFee: number;
  totalAfterDiscount: number;
  feeMarketplace: number;
}

export interface MissingInvoice {
  order: OrderLite;
  deliveredDate: DateString;
  /** Số ngày đã trễ (≥ 1). */
  daysLate: number;
}

export type AdjustKind = "returned" | "partial" | "canceled" | "amount";
export const ADJUST_LABELS: Record<AdjustKind, string> = {
  returned: "Đơn đã hoàn – hóa đơn chưa hủy / điều chỉnh giảm",
  partial: "Đơn hoàn một phần – hóa đơn chưa điều chỉnh giảm",
  canceled: "Đơn đã hủy nhưng hóa đơn vẫn còn hiệu lực",
  amount: "Tiền hóa đơn lệch tiền đơn",
};

export interface AdjustItem {
  kind: AdjustKind;
  order: OrderLite;
  invoice: InvoiceLite;
  /** Tiền đơn gần nhất để so (khi lệch tiền). */
  orderAmount: number;
  /** Ngày phát sinh việc cần điều chỉnh (ngày hoàn / ngày phát hành). */
  eventDate: DateString | null;
  /** Hạn = hạn nộp tờ khai của kỳ chứa hóa đơn gốc. */
  deadline: DateString;
  periodLabel: string;
  daysLeft: number;
}

export interface MonthCoverage {
  month: string; // "2026-11"
  needed: number;
  issued: number;
  pending: number;
  /** % đã xuất (2 số lẻ), null khi không có đơn nào cần. */
  rate: number | null;
}

/** Các cách tính tiền đơn có thể khớp tiền hóa đơn (đã đối chiếu 2.000 hóa đơn: 1.998 khớp ít nhất một cách). */
export function orderAmounts(o: OrderLite): number[] {
  return [
    o.totalAfterDiscount + o.feeMarketplace,
    o.totalPrice - o.totalDiscount + o.shippingFee,
    o.totalPrice - o.totalDiscount,
    o.totalPrice,
    o.totalAfterDiscount,
  ];
}

const AMOUNT_TOLERANCE = 1_000;

export function analyzeInvoices(input: {
  orders: OrderLite[];
  invoices: InvoiceLite[];
  today: DateString;
  period: VatPeriod;
  /** Từ khoảng ngày khách nhận nào thì tính (để tỷ lệ và danh sách cùng phạm vi). */
  from: DateString;
}): { coverage: MonthCoverage[]; missing: MissingInvoice[]; pendingToday: number; adjust: AdjustItem[] } {
  const { orders, invoices, today, period, from } = input;
  const byOrder = new Map<string, InvoiceLite[]>();
  for (const inv of invoices) {
    if (!inv.orderSystemId) continue;
    const list = byOrder.get(inv.orderSystemId) ?? [];
    list.push(inv);
    byOrder.set(inv.orderSystemId, list);
  }
  // Hóa đơn đã có hóa đơn điều chỉnh / thay thế trỏ về.
  const handled = new Set(invoices.filter((i) => i.originalId !== null && (i.status === 4 || i.status === 6)).map((i) => i.originalId!));

  const coverageMap = new Map<string, MonthCoverage>();
  const missing: MissingInvoice[] = [];
  const adjust: AdjustItem[] = [];
  let pendingToday = 0;

  for (const o of orders) {
    const list = byOrder.get(o.systemId) ?? [];
    const hasIssued = list.some((i) => ISSUED.has(i.status));
    const hasPending = list.some((i) => PENDING.has(i.status));
    const fullyReturned = o.status === 5 || o.returnedAt !== null;
    const canceled = o.status === 6 || o.status === 7;

    // 1) Cần hóa đơn: khách đã nhận; hoàn toàn bộ mà chưa có hóa đơn thì thôi.
    if (o.deliveredAt && !canceled) {
      const deliveredDate = vnDateOf(o.deliveredAt);
      if (deliveredDate >= from && deliveredDate <= today && !(fullyReturned && !hasIssued)) {
        const month = deliveredDate.slice(0, 7);
        const c = coverageMap.get(month) ?? { month, needed: 0, issued: 0, pending: 0, rate: null };
        c.needed++;
        if (hasIssued) c.issued++;
        else if (hasPending) c.pending++;
        coverageMap.set(month, c);
        if (!hasIssued) {
          const daysLate = daysUntil(deliveredDate, today);
          if (daysLate >= 1) missing.push({ order: o, deliveredDate, daysLate });
          else pendingToday++;
        }
      }
    }

    // 2) Cần điều chỉnh: hóa đơn "Đã phát hành", chưa bị điều chỉnh / thay thế.
    for (const inv of list) {
      if (inv.status !== 2 || handled.has(inv.id)) continue;
      const releasedDate = inv.releasedAt ? vnDateOf(inv.releasedAt) : null;
      const p = periodOf(releasedDate ?? today, period);
      const base = { order: o, invoice: inv, deadline: p.deadline, periodLabel: p.label, daysLeft: daysUntil(today, p.deadline) };
      const amounts = orderAmounts(o);
      if (canceled) adjust.push({ ...base, kind: "canceled", orderAmount: amounts[0], eventDate: releasedDate });
      else if (fullyReturned) adjust.push({ ...base, kind: "returned", orderAmount: amounts[0], eventDate: o.returnedAt ? vnDateOf(o.returnedAt) : null });
      else if (o.status === 15 || o.partialReturnedAt !== null)
        adjust.push({ ...base, kind: "partial", orderAmount: amounts[0], eventDate: o.partialReturnedAt ? vnDateOf(o.partialReturnedAt) : null });
      else if (!amounts.some((a) => Math.abs(a - inv.totalAmount) <= AMOUNT_TOLERANCE))
        adjust.push({ ...base, kind: "amount", orderAmount: amounts[0], eventDate: releasedDate });
    }
  }

  const coverage = [...coverageMap.values()]
    .map((c) => ({ ...c, rate: c.needed ? Math.round((c.issued / c.needed) * 10000) / 100 : null }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  missing.sort((a, b) => b.daysLate - a.daysLate);
  adjust.sort((a, b) => a.daysLeft - b.daysLeft || (a.order.systemId < b.order.systemId ? -1 : 1));
  return { coverage, missing, pendingToday, adjust };
}

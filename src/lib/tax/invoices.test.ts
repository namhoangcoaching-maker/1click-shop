import { describe, expect, it } from "vitest";
import { analyzeInvoices, type InvoiceLite, type OrderLite } from "./invoices";

const order = (id: string, o: Partial<OrderLite> = {}): OrderLite => ({
  systemId: id,
  orderId: `SP${id}`,
  source: "Shopee",
  status: 3,
  deliveredAt: "2026-11-05T03:00:00Z", // 05/11 giờ VN
  returnedAt: null,
  partialReturnedAt: null,
  totalPrice: 500_000,
  totalDiscount: 31_000,
  shippingFee: 0,
  totalAfterDiscount: 420_000,
  feeMarketplace: 49_000,
  ...o,
});
let nextId = 1;
const inv = (orderId: string, o: Partial<InvoiceLite> = {}): InvoiceLite => ({
  id: nextId++,
  invoiceNo: `000${nextId}`,
  series: "C26MSC",
  status: 2,
  orderSystemId: orderId,
  originalId: null,
  totalAmount: 469_000, // = 420.000 + 49.000 (khách trả)
  releasedAt: "2026-11-05T03:00:00Z",
  ...o,
});

const run = (orders: OrderLite[], invoices: InvoiceLite[], today = "2026-11-06") =>
  analyzeInvoices({ orders, invoices, today, period: "quarter", from: "2026-10-01" });

describe("tỷ lệ xuất hóa đơn và đơn chưa xuất", () => {
  it("đơn khách đã nhận có hóa đơn = đã xuất; chưa có thì trễ từ hôm sau", () => {
    const r = run(
      [order("1"), order("2"), order("3", { deliveredAt: "2026-11-06T02:00:00Z" }), order("4", { status: 2, deliveredAt: null })],
      [inv("1")],
    );
    expect(r.coverage).toEqual([{ month: "2026-11", needed: 3, issued: 1, pending: 0, rate: 33.33 }]);
    expect(r.missing.map((m) => [m.order.systemId, m.daysLate])).toEqual([["2", 1]]);
    expect(r.pendingToday).toBe(1); // đơn 3 nhận hôm nay, chưa coi là trễ
  });

  it("đơn hoàn toàn bộ chưa có hóa đơn: không cần nữa; đơn hủy không tính", () => {
    const r = run([order("1", { status: 5, returnedAt: "2026-11-06T01:00:00Z" }), order("2", { status: 6 })], []);
    expect(r.coverage).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it("hóa đơn chờ phát hành chưa tính là đã xuất", () => {
    const r = run([order("1")], [inv("1", { status: 1 })]);
    expect(r.coverage[0]).toMatchObject({ needed: 1, issued: 0, pending: 1 });
  });
});

describe("hóa đơn cần điều chỉnh", () => {
  it("đơn đã hoàn mà hóa đơn vẫn Đã phát hành → cần điều chỉnh, hạn = hạn khai quý của hóa đơn gốc", () => {
    const r = run([order("1", { status: 5, returnedAt: "2026-11-06T01:00:00Z" })], [inv("1")]);
    expect(r.adjust).toHaveLength(1);
    expect(r.adjust[0]).toMatchObject({ kind: "returned", deadline: "2027-01-31", periodLabel: "Quý 4/2026", daysLeft: 86, eventDate: "2026-11-06" });
  });

  it("hóa đơn quý trước: hạn đã qua (số ngày âm)", () => {
    const r = run([order("1", { status: 5, returnedAt: "2026-11-02T01:00:00Z" })], [inv("1", { releasedAt: "2026-09-20T03:00:00Z" })]);
    expect(r.adjust[0]).toMatchObject({ deadline: "2026-10-31", daysLeft: -6 });
  });

  it("đã có hóa đơn điều chỉnh / thay thế, hoặc hóa đơn đã hủy → không báo nữa", () => {
    const original = inv("1", { status: 7 });
    const r1 = run([order("1", { status: 5, returnedAt: "2026-11-06T01:00:00Z" })], [original]);
    expect(r1.adjust).toEqual([]);
    const o2 = inv("2");
    const r2 = run([order("2", { status: 5, returnedAt: "2026-11-06T01:00:00Z" })], [o2, inv("2", { status: 6, originalId: o2.id })]);
    expect(r2.adjust).toEqual([]);
    expect(run([order("3", { status: 5 })], [inv("3", { status: 3 })]).adjust).toEqual([]);
  });

  it("hoàn một phần, đơn hủy có hóa đơn", () => {
    const r = run([order("1", { status: 15, partialReturnedAt: "2026-11-06T01:00:00Z" }), order("2", { status: 6 })], [inv("1"), inv("2")]);
    expect(r.adjust.map((a) => [a.order.systemId, a.kind]).sort()).toEqual([
      ["1", "partial"],
      ["2", "canceled"],
    ]);
  });

  it("tiền hóa đơn lệch mọi cách tính tiền đơn (dung sai 1.000 ₫) → báo lệch", () => {
    expect(run([order("1")], [inv("1", { totalAmount: 469_500 })]).adjust).toEqual([]); // lệch 500 ₫: bỏ qua
    expect(run([order("1")], [inv("1", { totalAmount: 500_000 })]).adjust).toEqual([]); // = tổng giá bán
    const r = run([order("1")], [inv("1", { totalAmount: 582_000 })]);
    expect(r.adjust[0]).toMatchObject({ kind: "amount", orderAmount: 469_000 });
  });
});

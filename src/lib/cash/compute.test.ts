import { describe, expect, it } from "vitest";
import { cashByDay, cashEvents, channelsOf, vnDate, type CashOrder } from "./compute";

const order = (o: Partial<CashOrder>): CashOrder => ({
  order_id: "X",
  system_id: 1,
  source: "Shopee",
  total_price: 369_000,
  cod: 253_455,
  partner_fee: 0,
  carrier_id: 42,
  delivered_at: "2026-11-03T22:00:00Z", // 05:00 ngày 04/11 giờ VN
  returned_at: null,
  partial_returned_at: null,
  returned_value: 0,
  ...o,
});

describe("vnDate", () => {
  it("đổi sang ngày giờ Việt Nam", () => {
    expect(vnDate("2026-11-03T22:00:00Z")).toBe("2026-11-04");
    expect(vnDate("2026-11-03T16:59:59Z")).toBe("2026-11-03");
  });
});

describe("cashEvents – luật từng kênh", () => {
  it("Shopee: ngày khách nhận + 4, tiền sàn trả (đã trừ phí sàn)", () => {
    expect(cashEvents([order({})], [])).toEqual([
      { date: "2026-11-08", amount: 253_455, channel: "Shopee", kind: "payout" },
    ]);
  });

  it("TikTok: + 7 ngày", () => {
    const [e] = cashEvents([order({ source: "Tiktok", carrier_id: 15, cod: 337_867 })], []);
    expect(e).toMatchObject({ date: "2026-11-11", amount: 337_867, channel: "TikTok" });
  });

  it("ngoại sàn qua SPX/J&T: + 3 ngày, COD trừ phí ship", () => {
    const [e] = cashEvents([order({ source: "Instagram", cod: 850_000, partner_fee: 30_000 })], []);
    expect(e).toMatchObject({ date: "2026-11-07", amount: 820_000, channel: "SPX Express" });
  });

  it("phí ship đã trả riêng trong Thu chi thì không trừ khỏi COD lần nữa, và dòng phí đó không tính vào tiền về", () => {
    const events = cashEvents(
      [order({ source: "Facebook", system_id: 42035, carrier_id: 3, cod: 500_000, partner_fee: 34_720 })],
      [
        {
          posted_at: "2026-11-04T03:00:00Z",
          amount: -34_720,
          name: "Thanh toán phí vận chuyển của đơn hàng #ref_display_id cho đơn vị vận chuyển.",
          order_display_id: "42035",
        },
      ],
    );
    expect(events).toEqual([{ date: "2026-11-07", amount: 500_000, channel: "Viettel Post", kind: "payout" }]);
  });

  it("đơn khách đã trả trước hết (COD 0) qua SPX: phí ship bị trừ (số âm)", () => {
    const [e] = cashEvents([order({ source: "Instagram", cod: 0, partner_fee: 30_000 })], []);
    expect(e.amount).toBe(-30_000);
  });

  it("COD âm (khách trả trước dư) coi như 0", () => {
    expect(cashEvents([order({ source: "WEB", carrier_id: null, cod: -3_213_519 })], [])).toEqual([]);
  });

  it("chưa giao tới khách thì chưa có tiền", () => {
    expect(cashEvents([order({ delivered_at: null })], [])).toEqual([]);
  });
});

describe("cashEvents – hoàn hàng", () => {
  it("đã nhận rồi mới hoàn: trừ lại vào ngày Đã hoàn", () => {
    const events = cashEvents([order({ returned_at: "2026-11-06T02:00:00Z" })], []);
    expect(events).toEqual([
      { date: "2026-11-08", amount: 253_455, channel: "Shopee", kind: "payout" },
      { date: "2026-11-06", amount: -253_455, channel: "Shopee", kind: "refund" },
    ]);
  });

  it("hoàn một phần: trừ theo tỷ lệ giá trị hàng hoàn", () => {
    const events = cashEvents(
      [order({ total_price: 1_000_000, cod: 800_000, partial_returned_at: "2026-11-06T02:00:00Z", returned_value: 250_000 })],
      [],
    );
    expect(events[1]).toEqual({ date: "2026-11-06", amount: -200_000, channel: "Shopee", kind: "refund" });
  });

  it("hoàn trước khi khách nhận (không có Đã nhận) thì không cộng không trừ", () => {
    expect(cashEvents([order({ delivered_at: null, returned_at: "2026-11-06T02:00:00Z" })], [])).toEqual([]);
  });
});

describe("cashEvents – chuyển khoản trước (Thu chi)", () => {
  it("trả trước cộng đúng ngày; hủy đơn trả trước là dòng âm, cộng gộp ra 0", () => {
    const events = cashEvents(
      [],
      [
        { posted_at: "2026-11-04T03:13:58Z", amount: 928_000, name: "Trả trước cho đơn hàng #", order_display_id: "37382" },
        { posted_at: "2026-11-05T03:00:00Z", amount: -928_000, name: "Huỷ đơn hàng #", order_display_id: "37382" },
      ],
    );
    expect(events.map((e) => [e.date, e.amount, e.channel])).toEqual([
      ["2026-11-04", 928_000, "Chuyển khoản trước"],
      ["2026-11-05", -928_000, "Chuyển khoản trước"],
    ]);
  });
});

describe("cashByDay", () => {
  it("cộng theo ngày và theo kênh, ngày trống = 0", () => {
    const events = cashEvents(
      [
        order({}), // Shopee nhận 04/11 → về 08/11
        order({ source: "Tiktok", carrier_id: 15, cod: 100, delivered_at: "2026-11-01T03:00:00Z" }), // nhận 01/11 → về 08/11
      ],
      [{ posted_at: "2026-11-08T03:00:00Z", amount: 50, name: "Trả trước cho đơn hàng #", order_display_id: null }],
    );
    expect(cashByDay(events, "2026-11-07", "2026-11-09")).toEqual([
      { date: "2026-11-07", total: 0, byChannel: {} },
      {
        date: "2026-11-08",
        total: 253_455 + 100 + 50,
        byChannel: { Shopee: 253_455, TikTok: 100, "Chuyển khoản trước": 50 },
      },
      { date: "2026-11-09", total: 0, byChannel: {} },
    ]);
    expect(channelsOf(cashByDay(events, "2026-11-07", "2026-11-09"))).toEqual(["Shopee", "TikTok", "Chuyển khoản trước"]);
  });
});

describe("cashEvents – phiếu chi có thẻ, ngoại tệ", () => {
  it("phiếu chi có thẻ (Sản xuất −30 triệu) KHÔNG trừ vào tiền về", () => {
    const events = cashEvents(
      [],
      [{ posted_at: "2026-11-04T18:05:11Z", amount: -30_000_000, name: "Sản xuất", order_display_id: null, tag_ids: ["45f7"] }],
    );
    expect(events).toEqual([]);
  });

  it("trả trước bằng USD (Shopify, $82.00 = 8200 cent) đổi theo tỷ giá VCB của ngày đó", () => {
    const events = cashEvents(
      [],
      [
        { posted_at: "2026-11-04T08:00:00Z", amount: 8_200, name: "Trả trước", order_display_id: "42116", currency: "USD" },
        { posted_at: "2026-11-05T08:00:00Z", amount: -1_000, name: "Hoàn", order_display_id: "42116", currency: "USD" },
      ],
      new Map([["2026-11-04", 25_500]]),
    );
    // $82 × 25.500 = 2.091.000 ₫; ngày 05/11 chưa có tỷ giá thì dùng ngày gần nhất trước đó
    expect(events.map((e) => [e.date, e.amount, e.channel])).toEqual([
      ["2026-11-04", 2_091_000, "Shopify (USD)"],
      ["2026-11-05", -255_000, "Shopify (USD)"],
    ]);
  });

  it("không có tỷ giá nào thì bỏ khoản USD (không cộng sai thành vài nghìn đồng)", () => {
    const events = cashEvents([], [{ posted_at: "2026-11-04T08:00:00Z", amount: 8_200, name: "x", order_display_id: null, currency: "USD" }]);
    expect(events).toEqual([]);
  });
});

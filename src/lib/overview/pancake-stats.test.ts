import { describe, expect, it } from "vitest";
import { parseOrderSources, parseSaleResponse, type SaleRow } from "@/lib/pancake/analytics";
import { buildPancakeOverview } from "./pancake-stats";

// Số thật của Sugar Crush ngày 04/11/2026, đã đối chiếu với màn hình Thống kê của Pancake.
const totalBody = {
  data: [
    {
      result: {
        sales: 64_804_900,
        revenue: 47_796_644,
        net_revenue: 50_167_664,
        profit: 29_066_044,
        success_order_count: 96,
        avg_order: 522_579.83,
        fee_marketplace: 14_076_656,
        product_count: 122,
      },
      success: { price: 66_552_200, product_count: 129, order_count: 96 },
      returned: { price: 3_344_000, product_count: 7, is_returned: true },
    },
  ],
};

const row = (key: string, result: SaleRow["result"]): SaleRow => ({ key, result, success: {}, returned: {} });

describe("parseSaleResponse", () => {
  it("đọc tổng, hàng chốt, hàng hoàn; bỏ trường không phải số", () => {
    const [t] = parseSaleResponse(totalBody);
    expect(t.key).toBeNull();
    expect(t.result.revenue).toBe(47_796_644);
    expect(t.success).toEqual({ price: 66_552_200, product_count: 129, order_count: 96 });
    expect(t.returned).toEqual({ price: 3_344_000, product_count: 7 });
  });

  it("đọc khóa nhóm và tên sản phẩm", () => {
    const rows = parseSaleResponse(
      { data: [{ "Variation.product_id": "p1", product: { name: "Juliet Top" }, result: { revenue: 1 } }] },
      "Variation.product_id",
    );
    expect(rows[0]).toMatchObject({ key: "p1", productName: "Juliet Top" });
  });

  it("dữ liệu rỗng hoặc hỏng không làm sập trang", () => {
    expect(parseSaleResponse(null)).toEqual([]);
    expect(parseSaleResponse({ data: [{}] })[0].result).toEqual({});
  });
});

describe("parseOrderSources", () => {
  it("lấy tên nguồn của shop, thiếu thì dùng tên mặc định (Instagram -11)", () => {
    const m = parseOrderSources({ data: [{ id: -3, name: "Shopee" }, { id: 307034836, name: "KOL" }] });
    expect(m.get("307034836")).toBe("KOL");
    expect(m.get("-11")).toBe("Instagram");
  });
});

describe("buildPancakeOverview", () => {
  const today = { from: "2026-11-04", to: "2026-11-04" };
  const r = buildPancakeOverview({
    range: today,
    previousRange: { from: "2026-11-03", to: "2026-11-03" },
    total: parseSaleResponse(totalBody)[0],
    previousTotal: row("", { revenue: 46_000_000, success_order_count: 107 }),
    series: [row("07", { revenue: 1_000 }), row("12", { revenue: 2_920_599 })],
    previousSeries: [row("12", { revenue: 5 })],
    bySource: [
      row("-9", { revenue: 2_216_949, net_revenue: 2_216_949, profit: 1_493_949, success_order_count: 4 }),
      row("-3", { revenue: 32_219_695, net_revenue: 34_191_715, profit: 16_730_695, success_order_count: 81 }),
      row("999", { revenue: 0, success_order_count: 0 }),
    ],
    previousBySource: [row("-3", { revenue: 33_000_000 }), row("1536014106", { revenue: 1_000_000 })],
    sourceNames: parseOrderSources({ data: [{ id: -9, name: "TikTok" }, { id: 1536014106, name: "Sỉ" }] }),
    byProduct: [
      { ...row("a", { revenue: 100, product_count: 2 }), productName: "Vanis Skirt" },
      { ...row("b", { revenue: 300, product_count: 1 }), productName: "Juliet Top" },
      { ...row("c", { revenue: 999, product_count: 0 }), productName: "Không bán" },
    ],
  });
  const metric = (k: string) => r.metrics.find((m) => m.key === k)!;

  it("số tiền lấy nguyên của Pancake, khớp màn hình Thống kê", () => {
    expect(metric("grossSales").value).toBe(64_804_900);
    expect(metric("revenue")).toMatchObject({ value: 47_796_644, previous: 46_000_000 });
    expect(metric("profit").value).toBe(29_066_044);
    expect(metric("orders")).toMatchObject({ value: 96, previous: 107 });
    expect(metric("aov").value).toBeCloseTo(522_579.83);
  });

  it("thẻ Hàng chốt / Hàng hoàn: tổng tiền và SỐ LƯỢNG SẢN PHẨM như Pancake", () => {
    expect(r.closedOrders).toEqual({
      amount: { value: 66_552_200, previous: 0 },
      count: { value: 129, previous: 0 },
    });
    expect(r.returnedOrders.amount.value).toBe(3_344_000);
    expect(r.returnedOrders.count.value).toBe(7);
  });

  it("biểu đồ theo giờ: giờ '07' của Pancake vào ô 7h", () => {
    const s = metric("revenue").series;
    expect(s).toHaveLength(24);
    expect(s[7]).toEqual({ label: "7h", current: 1_000, previous: 0 });
    expect(s[12]).toEqual({ label: "12h", current: 2_920_599, previous: 5 });
  });

  it("nguồn đơn: tên đúng, xếp theo doanh thu, bỏ nguồn không có gì, GTTB như Pancake", () => {
    expect(r.sources.map((x) => [x.source, x.orders])).toEqual([
      ["Shopee", 81],
      ["TikTok", 4],
      ["Sỉ", 0], // hôm nay không có đơn nhưng hôm qua có: vẫn hiện để tổng "so kỳ trước" đúng
    ]);
    const prevTotal = r.sources.reduce((s, x) => s + (x.revenue.previous ?? 0), 0);
    expect(prevTotal).toBe(34_000_000);
    expect(r.sources[0].revenue).toEqual({ value: 32_219_695, previous: 33_000_000 });
    expect(Math.round(r.sources[0].gross / r.sources[0].orders)).toBe(422_120); // GTTB Shopee trên Pancake
  });

  it("top sản phẩm theo doanh thu, bỏ sản phẩm không bán được", () => {
    expect(r.topProducts.map((p) => p.name)).toEqual(["Juliet Top", "Vanis Skirt"]);
  });

  it("nhiều ngày: biểu đồ theo ngày", () => {
    const w = buildPancakeOverview({
      range: { from: "2026-11-01", to: "2026-11-03" },
      previousRange: null,
      total: undefined,
      previousTotal: undefined,
      series: [row("2026-11-02", { sales: 10 })],
      previousSeries: [],
      bySource: [],
      previousBySource: [],
      sourceNames: new Map(),
      byProduct: [],
    });
    expect(w.metrics[0].series.map((p) => [p.label, p.current, p.previous])).toEqual([
      ["01/11", 0, null],
      ["02/11", 10, null],
      ["03/11", 0, null],
    ]);
    expect(w.metrics[0].value).toBe(0);
  });
});

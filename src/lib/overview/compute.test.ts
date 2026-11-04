import { describe, expect, it } from "vitest";
import {
  buildOverviewNumbers,
  buildTopProducts,
  orderMoney,
  rangeToInstants,
  unlinkedQuantity,
  type OrderFacts,
} from "./compute";

const order = (o: Partial<OrderFacts>): OrderFacts => ({
  order_id: "X",
  inserted_at: "2026-11-04T03:00:00Z", // 10h sáng giờ VN
  status: 3,
  source: "Instagram",
  total_price: 0,
  total_discount: 0,
  fee_marketplace: 0,
  returned_value: 0,
  kept_cost: 0,
  kept_qty_without_cost: 0,
  ...o,
});

// Đơn Shopee thật (đã nhận): 369.000 ₫, sàn trừ 115.545 ₫, Pancake ghi còn 253.455 ₫.
const shopeeOk = order({ source: "Shopee", total_price: 369_000, fee_marketplace: 115_545, kept_cost: 130_000 });
// Đơn Instagram thật: 1.100.000 ₫, chiết khấu 280.000 ₫.
const igDiscount = order({ total_price: 1_100_000, total_discount: 280_000, kept_cost: 300_000 });
// Đơn Shopee hoàn hết: 469.000 ₫, Pancake vẫn ghi phí 151.090 ₫.
const shopeeReturned = order({ source: "Shopee", status: 5, total_price: 469_000, fee_marketplace: 151_090, returned_value: 469_000 });

describe("orderMoney – công thức tiền một đơn", () => {
  it("đơn Shopee thành công: doanh thu đã trừ phí sàn, khớp số Pancake", () => {
    const m = orderMoney(shopeeOk);
    expect(m.revenue).toBe(253_455);
    expect(m.fee).toBe(115_545);
    expect(m.profit).toBe(123_455); // 253.455 − 130.000 giá vốn
  });

  it("chiết khấu được trừ khỏi doanh thu", () => {
    expect(orderMoney(igDiscount).revenue).toBe(820_000);
  });

  it("đơn hoàn hết: không doanh thu, không phí sàn theo %, chỉ mất phí PiShip 2.700 ₫ của Shopee", () => {
    const m = orderMoney(shopeeReturned);
    expect(m.isReturn).toBe(true);
    expect(m.returnedValue).toBe(469_000);
    expect(m.fee).toBe(2_700);
    expect(m.revenue).toBe(-2_700);
    expect(m.profit).toBe(-2_700);
  });

  it("đơn hoàn một phần: phí và chiết khấu tính theo phần khách giữ", () => {
    // Khách mua 2 món 500k, chiết khấu 100k, hoàn 1 món; sàn TikTok ghi phí 50k.
    const m = orderMoney(
      order({ source: "Tiktok", status: 15, total_price: 1_000_000, total_discount: 100_000, fee_marketplace: 50_000, returned_value: 500_000 }),
    );
    expect(m.fee).toBe(25_000); // TikTok không có phí cố định cho đơn hoàn
    expect(m.revenue).toBe(450_000 - 25_000);
  });

  it("đơn hoàn của nguồn không phải sàn (Instagram) không bị phí", () => {
    expect(orderMoney(order({ status: 5, total_price: 500_000, returned_value: 500_000 })).fee).toBe(0);
  });

  it("dữ liệu lạ: giá trị hoàn lớn hơn đơn, đơn 0 đồng → không ra số âm vô lý", () => {
    expect(orderMoney(order({ total_price: 100, returned_value: 999 })).returnedValue).toBe(100);
    expect(orderMoney(order({ total_price: 0 })).revenue).toBe(0);
  });
});

describe("rangeToInstants – ngày giờ Việt Nam", () => {
  it("ngày 04/11 giờ VN = 03/11 17:00 → 04/11 17:00 giờ quốc tế", () => {
    expect(rangeToInstants({ from: "2026-11-04", to: "2026-11-04" })).toEqual({
      start: "2026-11-03T17:00:00.000Z",
      end: "2026-11-04T17:00:00.000Z",
    });
  });
});

describe("buildOverviewNumbers", () => {
  const today = { from: "2026-11-04", to: "2026-11-04" };
  const yesterday = { from: "2026-11-03", to: "2026-11-03" };
  const r = buildOverviewNumbers(
    [shopeeOk, igDiscount, shopeeReturned],
    [order({ inserted_at: "2026-11-03T03:00:00Z", total_price: 500_000, kept_cost: 100_000 })],
    today,
    yesterday,
  );
  const metric = (k: string) => r.metrics.find((m) => m.key === k)!;

  it("hàng chốt, hàng hoàn có so sánh kỳ trước", () => {
    expect(r.closedOrders.count).toEqual({ value: 3, previous: 1 });
    expect(r.closedOrders.amount).toEqual({ value: 1_938_000, previous: 500_000 });
    expect(r.returnedOrders.count).toEqual({ value: 1, previous: 0 });
    expect(r.returnedOrders.amount.value).toBe(469_000);
  });

  it("các chỉ số: doanh số, doanh thu, lợi nhuận, GTTB, phí sàn", () => {
    expect(metric("grossSales").value).toBe(1_938_000);
    expect(metric("revenue").value).toBe(253_455 + 820_000 - 2_700);
    expect(metric("profit").value).toBe(123_455 + 520_000 - 2_700);
    expect(metric("aov").value).toBe(646_000);
    expect(metric("platformFees").value).toBe(115_545 + 2_700);
    expect(metric("revenue").previous).toBe(500_000);
  });

  it("biểu đồ 1 ngày chia theo giờ Việt Nam", () => {
    const s = metric("orders").series;
    expect(s).toHaveLength(24);
    expect(s[10]).toEqual({ label: "10h", current: 3, previous: 1 });
  });

  it("nguồn đơn xếp theo doanh thu", () => {
    expect(r.sources.map((s) => [s.source, s.orders])).toEqual([
      ["Instagram", 1],
      ["Shopee", 2],
    ]);
    expect(r.sources[1].revenue).toEqual({ value: 253_455 - 2_700, previous: 0 });
  });

  it("nhiều ngày: chia theo ngày, nhãn dd/mm", () => {
    const w = buildOverviewNumbers([shopeeOk], null, { from: "2026-11-01", to: "2026-11-04" }, null);
    expect(w.metrics[0].series.map((p) => p.label)).toEqual(["01/11", "02/11", "03/11", "04/11"]);
    expect(w.metrics[0].series[3].current).toBe(369_000);
    expect(w.metrics[0].previous).toBeNull();
  });
});

describe("Top sản phẩm theo mẫu", () => {
  const products = [
    { variation_id: "a-s", product_id: "A", name: "Vanis Skirt", sku: "SC135S" },
    { variation_id: "a-m", product_id: "A", name: "Vanis Skirt", sku: "SC135M" },
    { variation_id: "b-s", product_id: "B", name: "Birdie Top", sku: "SC181S" },
  ];
  const rows = [
    { variation_id: "a-s", quantity: 3, returned: 1, gross: 900_000 },
    { variation_id: "a-m", quantity: 2, returned: 0, gross: 900_000 },
    { variation_id: "b-s", quantity: 2, returned: 0, gross: 1_000_000 },
    { variation_id: null, quantity: 4, returned: 0, gross: 400_000 },
    { variation_id: "da-xoa", quantity: 1, returned: 0, gross: 100_000 },
  ];

  it("cộng mọi size của một mẫu, trừ hàng hoàn; hàng chưa liên kết gom riêng", () => {
    expect(buildTopProducts(rows, products)).toEqual([
      { productId: "A", name: "Vanis Skirt", sku: null, quantity: 4, revenue: 1_800_000, linked: true },
      { productId: "B", name: "Birdie Top", sku: null, quantity: 2, revenue: 1_000_000, linked: true },
      { productId: undefined, name: "Sản phẩm chưa liên kết", sku: null, quantity: 5, revenue: 500_000, linked: false },
    ]);
  });

  it("đếm số lượng hàng chưa liên kết (không mã hoặc mã đã xóa)", () => {
    expect(unlinkedQuantity(rows, products)).toBe(5);
  });
});

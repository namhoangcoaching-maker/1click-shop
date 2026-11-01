import { describe, expect, it } from "vitest";
import { analyzeInventory, type StockItem } from "@/lib/inventory/stock";
import { buildRecommendations, type RecommendationInput } from "./recommendations";

const TODAY = "2026-11-02";

function stock(overrides: Partial<StockItem>): StockItem {
  return {
    sku: "SP",
    name: "Sản phẩm",
    stock: 40,
    soldInWindow: 30,
    leadTimeDays: 7,
    costPrice: 100_000,
    price: 200_000,
    ...overrides,
  };
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    totalRevenue: 100_000_000,
    topProducts: [],
    adCosts: [],
    stock: [],
    inventoryHref: "/ton-kho",
    ...overrides,
  };
}

describe("buildRecommendations", () => {
  it("không có vấn đề gì thì không có đề xuất", () => {
    expect(buildRecommendations(input({ stock: analyzeInventory([stock({})], TODAY) }))).toEqual([]);
  });

  it("báo cần sản xuất ngay, kèm số lượng và lý do bằng con số, xếp đầu tiên", () => {
    const recs = buildRecommendations(
      input({
        stock: analyzeInventory(
          [
            stock({ sku: "SLOW", name: "Kệ ít bán", stock: 500 }),
            stock({ sku: "KG2T", name: "Kệ góc 2 tầng", stock: 60, soldInWindow: 210, leadTimeDays: 8 }),
          ],
          TODAY,
        ),
      }),
    );
    expect(recs[0].id).toBe("restock-urgent");
    expect(recs[0].reasons[0]).toContain("đủ bán 8,6 ngày, ít hơn 11 ngày");
    expect(recs[0].actions[0]).toContain("164 cái Kệ góc 2 tầng");
    expect(recs.map((r) => r.id)).toContain("clearance");
  });

  it("đề xuất tập trung content cho sản phẩm bán chạy và nhắc nếu nó sắp hết hàng", () => {
    const recs = buildRecommendations(
      input({
        topProducts: [
          { name: "—", sku: null, quantity: 99, revenue: 50_000_000, linked: false },
          { name: "Kệ góc 2 tầng", sku: "KG2T", quantity: 63, revenue: 18_000_000, linked: true },
        ],
        stock: analyzeInventory([stock({ sku: "KG2T", stock: 0, soldInWindow: 90 })], TODAY),
      }),
    );
    const content = recs.find((r) => r.id === "content-top-product");
    // Bỏ qua dòng sàn chưa liên kết, lấy sản phẩm thật đầu tiên
    expect(content?.title).toContain("Kệ góc 2 tầng");
    expect(content?.reasons[0]).toContain("18% doanh thu");
    expect(content?.reasons[1]).toContain("sắp hết hàng");
  });

  it("không đề xuất content khi sản phẩm bán chạy nhất chiếm quá ít doanh thu", () => {
    const recs = buildRecommendations(
      input({ topProducts: [{ name: "A", sku: "A", quantity: 1, revenue: 5_000_000, linked: true }] }),
    );
    expect(recs.find((r) => r.id === "content-top-product")).toBeUndefined();
  });

  it("cảnh báo chi phí quảng cáo khi vượt ngưỡng tổng hoặc ngưỡng từng kênh", () => {
    const highTotal = buildRecommendations(
      input({
        adCosts: [{ channel: "TikTok Ads", cost: { value: 15_000_000, previous: null }, channelRevenue: 90_000_000 }],
      }),
    );
    expect(highTotal.find((r) => r.id === "ads")?.reasons[0]).toContain("15% doanh thu");

    const highChannel = buildRecommendations(
      input({
        adCosts: [{ channel: "Facebook Ads", cost: { value: 3_000_000, previous: null }, channelRevenue: 10_000_000 }],
      }),
    );
    expect(highChannel.find((r) => r.id === "ads")?.reasons[1]).toContain("Facebook Ads: 30%");

    const fine = buildRecommendations(
      input({
        adCosts: [{ channel: "Shopee Ads", cost: { value: 2_000_000, previous: null }, channelRevenue: 40_000_000 }],
      }),
    );
    expect(fine.find((r) => r.id === "ads")).toBeUndefined();
  });

  it("đề xuất xả kho tính tiền vốn đang giữ và nhắc mã thiếu giá vốn", () => {
    const recs = buildRecommendations(
      input({
        stock: analyzeInventory(
          [
            stock({ sku: "A", stock: 300, costPrice: 50_000 }),
            stock({ sku: "B", stock: 200, soldInWindow: 0, costPrice: null }),
          ],
          TODAY,
        ),
      }),
    );
    const clearance = recs.find((r) => r.id === "clearance");
    expect(clearance?.reasons[0]).toBe("Đang giữ 15.000.000 ₫ tiền vốn trong kho (chưa tính 1 mã thiếu giá vốn)");
    expect(clearance?.reasons).toContain("Sản phẩm: còn 200, 30 ngày qua không bán được cái nào");
  });
});

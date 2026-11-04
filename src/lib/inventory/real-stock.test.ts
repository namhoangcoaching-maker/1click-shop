import { describe, expect, it } from "vitest";
import { buildStockItems, netSalesByVariation, type ProductRecord } from "./real-stock";
import { analyzeStock, STOCK_RULES } from "./stock";

const base: ProductRecord = {
  variation_id: "v1",
  product_id: "p1",
  sku: "SC181M",
  name: "Birdie Top",
  variant: "Xám / M",
  retail_price: 500_000,
  cost_price: 130_000,
  stock: 40,
  internal_note: null,
  is_hidden: false,
};

describe("netSalesByVariation", () => {
  it("số bán thực = bán − hoàn, không âm", () => {
    const m = netSalesByVariation([
      { variation_id: "v1", sold: 160, returned: 10 },
      { variation_id: "v2", sold: 2, returned: 5 },
    ]);
    expect(m.get("v1")).toBe(150);
    expect(m.get("v2")).toBe(0);
  });

  it("chịu được số dạng chữ (database trả bigint)", () => {
    const m = netSalesByVariation([{ variation_id: "v1", sold: "7" as unknown as number, returned: "2" as unknown as number }]);
    expect(m.get("v1")).toBe(5);
  });
});

describe("buildStockItems", () => {
  it("ghép tồn, số bán, giá vốn, đọc SX từ Ghi chú nội bộ", () => {
    const [item] = buildStockItems(
      [{ ...base, internal_note: "Xưởng Q12\nSX: 10" }],
      new Map([["v1", 150]]),
      new Map([["v1", 400]]),
    );
    expect(item).toMatchObject({
      id: "v1",
      productId: "p1",
      sku: "SC181M",
      name: "Birdie Top",
      variant: "Xám / M",
      stock: 40,
      soldInWindow: 150,
      leadTimeDays: 10,
      costPrice: 130_000,
      price: 500_000,
      sold90: 400,
      inactive: false,
    });
    // Váy/áo bán 5 cái/ngày, còn 40 → đủ bán 8 ngày < 10 + 3 → sản xuất ngay, đặt 130 cái.
    const a = analyzeStock(item, "2026-11-04", STOCK_RULES);
    expect(a.status).toBe("urgent");
    expect(a.suggestedQuantity).toBe(130);
  });

  it("chưa ghi SX → dùng thời gian mặc định; chưa bán → 0", () => {
    const [item] = buildStockItems([base], new Map(), new Map());
    expect(item.leadTimeDays).toBeNull();
    expect(item.soldInWindow).toBe(0);
  });

  it("ngừng kinh doanh: hết hàng và 90 ngày không bán, hoặc bị ẩn trên Pancake", () => {
    const items = buildStockItems(
      [
        { ...base, variation_id: "het-khong-ban", stock: 0 },
        { ...base, variation_id: "het-van-ban", stock: 0 },
        { ...base, variation_id: "con-hang-khong-ban", stock: 12 },
        { ...base, variation_id: "an", is_hidden: true },
      ],
      new Map(),
      new Map([["het-van-ban", 3]]),
    );
    expect(items.map((i) => [i.id, i.inactive])).toEqual([
      ["het-khong-ban", true],
      ["het-van-ban", false], // vẫn có khách mua → cần báo hết hàng
      ["con-hang-khong-ban", false], // còn tồn mà không bán → phải hiện là bán chậm
      ["an", true],
    ]);
  });

  it("mã thiếu SKU dùng 8 ký tự đầu của mã Pancake", () => {
    const [item] = buildStockItems([{ ...base, sku: null, variation_id: "abcdef123456" }], new Map(), new Map());
    expect(item.sku).toBe("abcdef12");
  });
});

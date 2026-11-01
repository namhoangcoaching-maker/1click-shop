import { describe, expect, it } from "vitest";
import { analyzeInventory, analyzeStock, summarizeInventory, type StockItem } from "./stock";

const TODAY = "2026-11-02";

function item(overrides: Partial<StockItem>): StockItem {
  return {
    sku: "SP",
    name: "Sản phẩm",
    stock: 100,
    soldInWindow: 30, // 1 cái/ngày
    leadTimeDays: 7,
    costPrice: 100_000,
    price: 200_000,
    ...overrides,
  };
}

describe("analyzeStock – ví dụ của chủ shop", () => {
  // Bán 7 cái/ngày (210 cái/30 ngày), còn 60 cái, sản xuất mất 8 ngày.
  const result = analyzeStock(item({ stock: 60, soldInWindow: 210, leadTimeDays: 8 }), TODAY);

  it("tính đúng tốc độ bán và số ngày còn đủ bán", () => {
    expect(result.velocity).toBe(7);
    expect(result.daysOfStock).toBeCloseTo(8.57, 2);
  });

  it("báo động vì 8,6 ngày < 8 ngày sản xuất + 3 ngày dự phòng", () => {
    expect(result.requiredDays).toBe(11);
    expect(result.status).toBe("urgent");
  });

  it("đã trễ hạn đặt nên ngày đặt là hôm nay", () => {
    expect(result.daysUntilOrder).toBe(-3);
    expect(result.orderBy).toBe(TODAY);
  });

  it("đề xuất số lượng sản xuất đủ bán 30 ngày sau khi hàng về", () => {
    // 7 × (11 + 30) − 60 = 227
    expect(result.suggestedQuantity).toBe(227);
  });
});

describe("analyzeStock – các trạng thái", () => {
  it("hết hàng nhưng vẫn đang bán được", () => {
    expect(analyzeStock(item({ stock: 0, soldInWindow: 45 }), TODAY).status).toBe("out");
  });

  it("sắp đến hạn đặt: còn trong 7 ngày nữa phải đặt", () => {
    // 1 cái/ngày, còn 15 cái, cần 7 + 3 = 10 ngày → còn 5 ngày nữa phải đặt
    const r = analyzeStock(item({ stock: 15 }), TODAY);
    expect(r.status).toBe("soon");
    expect(r.daysUntilOrder).toBe(5);
    expect(r.orderBy).toBe("2026-11-07");
  });

  it("đủ hàng", () => {
    const r = analyzeStock(item({ stock: 40 }), TODAY);
    expect(r.status).toBe("ok");
    expect(r.suggestedQuantity).toBe(0);
  });

  it("bán chậm: đủ bán hơn 90 ngày", () => {
    expect(analyzeStock(item({ stock: 200 }), TODAY).status).toBe("slow");
  });

  it("không bán được cái nào nhưng còn tồn là bán chậm, không cần đặt", () => {
    const r = analyzeStock(item({ stock: 50, soldInWindow: 0 }), TODAY);
    expect(r.status).toBe("slow");
    expect(r.daysOfStock).toBe(Infinity);
    expect(r.daysUntilOrder).toBeNull();
    expect(r.orderBy).toBeNull();
  });

  it("giá trị tồn là null khi thiếu giá vốn, không tự coi là 0", () => {
    expect(analyzeStock(item({ costPrice: null }), TODAY).costValue).toBeNull();
    expect(analyzeStock(item({ stock: 10 }), TODAY).costValue).toBe(1_000_000);
  });
});

describe("analyzeInventory", () => {
  it("sắp xếp việc gấp nhất lên đầu", () => {
    const list = analyzeInventory(
      [
        item({ sku: "OK", stock: 40 }),
        item({ sku: "SLOW", stock: 500 }),
        item({ sku: "OUT", stock: 0 }),
        item({ sku: "URGENT", stock: 5 }),
      ],
      TODAY,
    );
    expect(list.map((a) => a.item.sku)).toEqual(["OUT", "URGENT", "SLOW", "OK"]);
  });
});

describe("summarizeInventory", () => {
  it("cộng giá trị tồn, bỏ qua sản phẩm thiếu giá vốn và liệt kê chúng", () => {
    const totals = summarizeInventory([
      item({ sku: "A", stock: 10, costPrice: 100_000, price: 150_000 }),
      item({ sku: "B", stock: 5, costPrice: null, price: 300_000 }),
      item({ sku: "C", stock: 0, costPrice: null }),
    ]);
    expect(totals.quantity).toBe(15);
    expect(totals.costValue).toBe(1_000_000);
    expect(totals.retailValue).toBe(3_000_000);
    expect(totals.missingCost.map((i) => i.sku)).toEqual(["B"]);
  });
});

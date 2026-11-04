import { describe, expect, it } from "vitest";
import { compareVariants, groupStockAlarms, splitVariant } from "./alarms";
import { analyzeInventory, type StockItem } from "./stock";

const TODAY = "2026-11-04";
const item = (o: Partial<StockItem> & Pick<StockItem, "id" | "productId" | "variant" | "stock" | "soldInWindow">): StockItem => ({
  sku: o.id!,
  name: o.productId === "A" ? "Mẫu A" : "Mẫu B",
  leadTimeDays: 10,
  costPrice: 100_000,
  price: 300_000,
  ...o,
});

// Mẫu A: size S âm kho, M và L còn đủ. Mẫu B: mọi size đều đủ.
const stock = analyzeInventory(
  [
    item({ id: "A-L", productId: "A", variant: "Đen / L", stock: 60, soldInWindow: 30 }),
    item({ id: "A-S", productId: "A", variant: "Đen / S", stock: -3, soldInWindow: 60 }),
    item({ id: "A-M", productId: "A", variant: "Đen / M", stock: 150, soldInWindow: 90 }),
    item({ id: "B-S", productId: "B", variant: "S", stock: 300, soldInWindow: 30 }),
    item({ id: "B-M", productId: "B", variant: "M", stock: 300, soldInWindow: 30 }),
  ],
  TODAY,
);

describe("groupStockAlarms", () => {
  const groups = groupStockAlarms(stock);

  it("một size thiếu là báo cả mẫu; mẫu đủ hết thì không báo", () => {
    expect(groups.map((g) => g.productId)).toEqual(["A"]);
  });

  it("xổ ra thấy MỌI size của mẫu, xếp S, M, L, kể cả size âm kho", () => {
    const a = groups[0];
    expect(a.variants.map((v) => [v.item.variant, v.item.stock, v.status])).toEqual([
      ["Đen / S", -3, "out"],
      ["Đen / M", 150, "ok"],
      ["Đen / L", 60, "ok"],
    ]);
    expect(a.alarmCount).toBe(1);
    expect(a.worstStatus).toBe("out");
  });

  it("tổng số nên đặt của cả mẫu = cộng các size cần đặt", () => {
    // Size S: 2 cái/ngày × (10 + 3 + 21) = 68 (tồn âm coi như 0)
    expect(groups[0].totalSuggested).toBe(68);
  });

  it("mẫu hết hàng xếp trước mẫu chỉ 'sản xuất ngay'", () => {
    const two = groupStockAlarms(
      analyzeInventory(
        [
          item({ id: "B-S", productId: "B", variant: "S", stock: 10, soldInWindow: 30 }), // urgent
          item({ id: "A-S", productId: "A", variant: "S", stock: 0, soldInWindow: 3 }), // out
        ],
        TODAY,
      ),
    );
    expect(two.map((g) => [g.productId, g.worstStatus])).toEqual([
      ["A", "out"],
      ["B", "urgent"],
    ]);
  });
});

describe("thứ tự size", () => {
  it("tách màu và size từ 'Xám / M'", () => {
    expect(splitVariant("Xám / M")).toEqual({ color: "Xám", size: "M" });
    expect(splitVariant("M")).toEqual({ color: "", size: "M" });
    expect(splitVariant(null)).toEqual({ color: "", size: "" });
  });

  it("theo màu, rồi XS < S < M < L < XL; size lạ xếp sau", () => {
    const v = (variant: string) => ({ item: { variant } }) as Parameters<typeof compareVariants>[0];
    const sorted = ["Trắng / L", "Đen / XL", "Đen / S", "Đen / Free", "Đen / M", "Trắng / S", "Đen / 38"]
      .map(v)
      .sort(compareVariants)
      .map((x) => x.item.variant);
    expect(sorted).toEqual(["Đen / S", "Đen / M", "Đen / XL", "Đen / Free", "Đen / 38", "Trắng / S", "Trắng / L"]);
  });
});

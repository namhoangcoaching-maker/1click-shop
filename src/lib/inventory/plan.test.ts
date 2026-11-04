import { describe, expect, it } from "vitest";
import {
  buildOrderPlan,
  coverUntil,
  isSlowItem,
  lastDayOfMonth,
  leadTimeFor,
  nextMainAfter,
  projectedStock,
  stockoutDate,
  suggestForDay,
  upcomingOrderDays,
  urgentNow,
  type PlanItem,
} from "./plan";

const item = (o: Partial<PlanItem> & Pick<PlanItem, "id" | "stock" | "velocity">): PlanItem => ({
  sku: o.id ?? "",
  productId: "A",
  name: "Mẫu A",
  variant: o.id,
  soldInWindow: 0,
  leadTimeDays: null,
  costPrice: 100_000,
  price: 300_000,
  incoming: [],
  ...o,
});

describe("lịch đặt hàng", () => {
  it("ngày cuối tháng, kể cả tháng 2", () => {
    expect(lastDayOfMonth("2026-11-05")).toBe("2026-11-30");
    expect(lastDayOfMonth("2027-02-10")).toBe("2027-02-28");
    expect(lastDayOfMonth("2026-12-01")).toBe("2026-12-31");
  });

  it("4 ngày đặt sắp tới, đúng loại chính/bổ sung", () => {
    expect(upcomingOrderDays("2026-11-05").map((d) => [d.date, d.kind, d.label])).toEqual([
      ["2026-11-10", "extra", "Ngày 10"],
      ["2026-11-16", "main", "Ngày 16"],
      ["2026-11-20", "extra", "Ngày 20"],
      ["2026-11-30", "main", "Cuối tháng"],
    ]);
    // Hôm nay là ngày 16 → tính luôn hôm nay; sang tháng sau đúng thứ tự
    expect(upcomingOrderDays("2026-11-16").map((d) => d.date)).toEqual([
      "2026-11-16",
      "2026-11-20",
      "2026-11-30",
      "2026-12-10",
    ]);
  });

  it("đặt ngày 16 → đủ bán tới mùng 7 tháng sau; đặt cuối tháng → ngày 23 tháng sau", () => {
    expect(nextMainAfter("2026-11-16")).toBe("2026-11-30");
    expect(coverUntil("2026-11-16")).toBe("2026-12-07");
    expect(nextMainAfter("2026-11-30")).toBe("2026-12-16");
    expect(coverUntil("2026-11-30")).toBe("2026-12-23");
    // Ngày bổ sung: đủ tới lần đặt chính kế tiếp + 7
    expect(coverUntil("2026-11-10")).toBe("2026-11-23");
    expect(coverUntil("2026-11-20")).toBe("2026-12-07");
  });

  it("thời gian sản xuất theo số lượng cả mẫu: ≤50 → 7, 51–150 → 10, >150 → 14 ngày", () => {
    expect(leadTimeFor(20)).toBe(7);
    expect(leadTimeFor(50)).toBe(7);
    expect(leadTimeFor(51)).toBe(10);
    expect(leadTimeFor(150)).toBe(10);
    expect(leadTimeFor(151)).toBe(14);
  });
});

describe("dự báo tồn từng size", () => {
  const s = item({ id: "S", stock: 10, velocity: 2, incoming: [{ quantity: 30, eta: "2026-11-10" }] });

  it("tồn dự kiến = tồn + hàng về − bán", () => {
    expect(projectedStock(s, "2026-11-05", "2026-11-09")).toBe(2); // 10 − 4×2
    expect(projectedStock(s, "2026-11-05", "2026-11-10")).toBe(30); // 10 + 30 − 5×2
  });

  it("ngày hết hàng tính cả hàng sắp về", () => {
    expect(stockoutDate(s, "2026-11-05")).toBe("2026-11-26"); // 40 cái, 2/ngày → âm từ ngày thứ 21
    expect(stockoutDate(item({ id: "X", stock: -2, velocity: 1 }), "2026-11-05")).toBe("2026-11-05");
    expect(stockoutDate(item({ id: "Y", stock: 5, velocity: 0 }), "2026-11-05")).toBeNull();
  });

  it("mã bán chậm: đặt tối thiểu 20 cái mà hơn 60 ngày mới bán hết", () => {
    expect(isSlowItem(item({ id: "a", stock: 0, velocity: 0.3 }))).toBe(true); // 20 / 0,3 = 67 ngày
    expect(isSlowItem(item({ id: "b", stock: 0, velocity: 0.5 }))).toBe(false); // 40 ngày
    expect(isSlowItem(item({ id: "c", stock: 0, velocity: 0 }))).toBe(true);
  });
});

describe("gợi ý đặt cho một ngày", () => {
  // Mẫu A: S bán chạy sắp hết, M còn nhiều, L bán vừa.
  const items = [
    item({ id: "S", variant: "S", stock: 5, velocity: 3 }),
    item({ id: "M", variant: "M", stock: 200, velocity: 2 }),
    item({ id: "L", variant: "L", stock: 30, velocity: 1 }),
  ];

  it("đặt ngày 16: đủ bán tới 07/12; size thiếu ít vẫn đặt tối thiểu 20; size đủ không đặt", () => {
    const [p] = suggestForDay(items, "2026-11-05", "2026-11-16");
    expect(p.coverUntil).toBe("2026-12-07");
    const byVariant = Object.fromEntries(p.variants.map((v) => [v.item.variant, v.suggested]));
    // S: cần 3 × 32 ngày = 96, có 5 → thiếu 91. L: cần 32, có 30 → thiếu 2 → tối thiểu 20. M: đủ.
    expect(byVariant).toEqual({ S: 91, M: 0, L: 20 });
    expect(p.total).toBe(111);
    expect(p.leadTimeDays).toBe(10);
    expect(p.arrival).toBe("2026-11-26");
    // S: 5 cái, 3/ngày → âm từ 07/11; đếm từ ngày đặt 16/11 tới khi hàng về 26/11 → 10 ngày
    expect(p.negativeDays).toBe(10);
    expect(p.variants.map((v) => v.item.variant)).toEqual(["S", "M", "L"]);
  });

  it("hàng sắp về được trừ khỏi gợi ý", () => {
    const withIncoming = items.map((i) =>
      i.id === "S" ? { ...i, incoming: [{ quantity: 100, eta: "2026-11-12" }] } : i,
    );
    const [p] = suggestForDay(withIncoming, "2026-11-05", "2026-11-16");
    expect(p.variants.find((v) => v.item.id === "S")!.suggested).toBe(0);
  });

  it("mẫu đủ hàng thì không hiện", () => {
    expect(suggestForDay([item({ id: "M", stock: 500, velocity: 1 })], "2026-11-05", "2026-11-16")).toEqual([]);
  });
});

describe("cần sản xuất ngay", () => {
  it("đợi tới ngày đặt kế tiếp sẽ âm kho quá 7 ngày → báo ngay", () => {
    // Hết ngay hôm nay, bán 3/ngày. Ngày đặt kế tiếp 10/11 + 7 ngày SX = 17/11 → âm 12 ngày.
    const urgent = urgentNow([item({ id: "S", stock: 0, velocity: 3 })], "2026-11-05");
    expect(urgent).toHaveLength(1);
    expect(urgent[0].orderDate).toBe("2026-11-05");
  });

  it("âm kho trong mức cho phép (≤7 ngày) thì chờ tới ngày đặt, không báo ngay", () => {
    // Còn 20, bán 2/ngày → hết 15/11. Đặt 16/11 (về 23/11) → âm ~8 ngày; đặt 10/11 (về 17/11) → âm 2 ngày.
    expect(urgentNow([item({ id: "S", stock: 20, velocity: 2 })], "2026-11-05")).toEqual([]);
  });
});

describe("kế hoạch cả tháng", () => {
  it("ngày 20 không lặp gợi ý của ngày 16 (coi như ngày 16 đã đặt đúng gợi ý)", () => {
    const plan = buildOrderPlan([item({ id: "S", stock: 60, velocity: 2 })], "2026-11-05");
    const totals = Object.fromEntries(plan.days.map((d) => [d.day.label, d.products[0]?.total ?? 0]));
    expect(totals["Ngày 16"]).toBeGreaterThan(0);
    expect(totals["Ngày 20"]).toBe(0);
    expect(totals["Cuối tháng"]).toBeGreaterThan(0); // đặt lần 2 trong tháng, đủ tới 23/12
  });

  it("số ngày âm ở lần đặt sau đếm từ ngày đặt, đã tính lô đặt trước về", () => {
    const plan = buildOrderPlan([item({ id: "S", stock: 0, velocity: 3 })], "2026-11-05");
    // Lô 'ngay' về 12/11 (SX 7 ngày) đủ tới 23/11; lần đặt 16/11 về 26/11 → âm 23–25/11 = 3 ngày, không phải 21.
    const d16 = plan.days.find((d) => d.day.label === "Ngày 16")!.products[0];
    expect(d16.negativeDays).toBeLessThanOrEqual(3);
  });

  it("mẫu đã 'sản xuất ngay' thì các ngày sau tính như đã đặt", () => {
    const plan = buildOrderPlan([item({ id: "S", stock: 0, velocity: 3 })], "2026-11-05");
    expect(plan.urgent).toHaveLength(1);
    expect(plan.days[0].products).toEqual([]); // ngày 10 không lặp lại
  });
});

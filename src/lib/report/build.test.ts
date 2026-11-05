import { describe, expect, it } from "vitest";
import { buildOrderPlan, type PlanItem } from "@/lib/inventory/plan";
import { buildDailyReport, reportDateToShow, withFreshYesterday } from "./build";
import type { PancakeOverview } from "@/lib/overview/pancake-stats";

const stats: PancakeOverview = {
  metrics: [
    { key: "grossSales", label: "Doanh số", format: "vnd", positiveIsGood: true, value: 64_804_900, previous: 60_000_000, series: [] },
    { key: "revenue", label: "Doanh thu", format: "vnd", positiveIsGood: true, value: 47_796_644, previous: 46_000_000, series: [] },
    { key: "profit", label: "Lợi nhuận", format: "vnd", positiveIsGood: true, value: 29_066_044, previous: 27_000_000, series: [] },
    { key: "orders", label: "Đơn chốt", format: "number", positiveIsGood: true, value: 96, previous: 107, series: [] },
  ],
  closedOrders: { amount: { value: 66_552_200, previous: 0 }, count: { value: 129, previous: 0 } },
  returnedOrders: { amount: { value: 3_344_000, previous: 10_000_000 }, count: { value: 7, previous: 20 } },
  sources: [
    { source: "Shopee", gross: 1, revenue: { value: 32_219_695, previous: 1 }, fee: { value: 0, previous: 0 }, profit: 1, orders: 81 },
    { source: "Shopify", gross: 1, revenue: { value: 7_332_000, previous: 1 }, fee: { value: 0, previous: 0 }, profit: 1, orders: 2 },
    { source: "Instagram", gross: 1, revenue: { value: 4_629_000, previous: 1 }, fee: { value: 0, previous: 0 }, profit: 1, orders: 5 },
    { source: "Sỉ", gross: 0, revenue: { value: 0, previous: 5 }, fee: { value: 0, previous: 0 }, profit: 0, orders: 0 },
  ],
  topProducts: [
    { productId: "a", name: "Hannie Top", sku: "SC129", imageUrl: "https://content.pancake.vn/a.jpg", quantity: 10, revenue: 5_000_000, linked: true },
  ],
};

const item = (o: Partial<PlanItem> & Pick<PlanItem, "id" | "stock" | "velocity">): PlanItem => ({
  sku: o.id ?? "",
  productId: o.id,
  name: `Mẫu ${o.id}`,
  variant: "M",
  soldInWindow: 0,
  leadTimeDays: null,
  costPrice: 1,
  price: 2,
  incoming: [],
  ...o,
});

describe("buildDailyReport", () => {
  const today = "2026-11-05"; // mùng 5 = ngày đặt
  const report = buildDailyReport({
    today,
    now: new Date("2026-11-05T01:00:00Z"),
    stats,
    statsError: null,
    cashDays: [
      { date: "2026-11-05", total: 32_768_085, byChannel: { TikTok: 10_386_761, Shopee: 21_102_324, "SPX Express": 1_279_000 } },
      { date: "2026-11-06", total: 33_110_049, byChannel: {} },
      { date: "2026-11-12", total: 1_000, byChannel: {} },
      { date: "2026-11-13", total: 999_999, byChannel: {} }, // ngoài 7 ngày tới
    ],
    plan: buildOrderPlan([item({ id: "A", stock: 0, velocity: 3 }), item({ id: "B", stock: 500, velocity: 1 })], today),
    missingCost: 2,
    incomingToday: [{ product: "Vanis Skirt", variant: "Kem / S", quantity: 40 }],
  });

  it("kết quả hôm qua: số Pancake, so với hôm kia; 3 nguồn có đơn; sản phẩm có ảnh", () => {
    expect(report.yesterday).toMatchObject({
      date: "2026-11-04",
      revenue: { value: 47_796_644, previous: 46_000_000 },
      orders: { value: 96, previous: 107 },
      returnedQty: { value: 7, previous: 20 },
    });
    expect(report.yesterday!.topSources.map((s) => s.name)).toEqual(["Shopee", "Shopify", "Instagram"]);
    expect(report.yesterday!.topProducts[0]).toMatchObject({ name: "Hannie Top", code: "SC129", imageUrl: "https://content.pancake.vn/a.jpg" });
  });

  it("tiền về hôm nay theo kênh (nhiều nhất trước) và 7 ngày tới", () => {
    expect(report.cash.today).toBe(32_768_085);
    expect(report.cash.byChannel.map((c) => c.channel)).toEqual(["Shopee", "TikTok", "SPX Express"]);
    expect(report.cash.next7).toBe(33_110_049 + 1_000);
  });

  it("đặt hàng: hôm nay là ngày đặt → ghi rõ, không tách 'cần sản xuất ngay'", () => {
    expect(report.order).toMatchObject({ label: "Mùng 5", date: "2026-11-05", isToday: true, products: 1, urgent: 0 });
    expect(report.order.top[0].name).toBe("Mẫu A");
    expect(report.order.quantity).toBe(report.order.top[0].quantity);
  });

  it("việc cần làm", () => {
    expect(report.todo).toEqual({ missingCost: 2, incomingToday: [{ product: "Vanis Skirt", variant: "Kem / S", quantity: 40 }] });
  });

  it("không lấy được số Pancake thì phần hôm qua để trống, ghi lý do", () => {
    const r = buildDailyReport({ ...{ today, now: new Date(), cashDays: [], plan: buildOrderPlan([], today), missingCost: 0, incomingToday: [] }, stats: null, statsError: "Pancake lỗi" });
    expect(r.yesterday).toBeNull();
    expect(r.statsError).toBe("Pancake lỗi");
  });
});

describe("reportDateToShow", () => {
  it("từ 8:00 xem báo cáo hôm nay; trước 8:00 xem báo cáo hôm qua", () => {
    expect(reportDateToShow("2026-11-05", 8)).toBe("2026-11-05");
    expect(reportDateToShow("2026-11-05", 23)).toBe("2026-11-05");
    expect(reportDateToShow("2026-11-05", 7)).toBe("2026-11-04");
    expect(reportDateToShow("2026-11-05", 0)).toBe("2026-11-04");
  });
});

describe("withFreshYesterday – phần Hôm qua lấy số mới khi xem (cách b)", () => {
  const today = "2026-11-05";
  const base = buildDailyReport({
    today, now: new Date("2026-11-05T01:00:00Z"), stats, statsError: null,
    cashDays: [{ date: today, total: 500, byChannel: { Shopee: 500 } }],
    plan: buildOrderPlan([], today), missingCost: 1, incomingToday: [],
  });
  // Pancake sau 8:00: 2 đơn Shopee bị hủy (1.069.000 + 1.400.000) → Doanh số hôm qua giảm 2.469.000
  const later: PancakeOverview = {
    ...stats,
    metrics: stats.metrics.map((m) => (m.key === "grossSales" ? { ...m, value: m.value - 2_469_000 } : m)),
  };
  const now = new Date("2026-11-05T04:00:00Z");

  it("thay số Hôm qua bằng số mới, giữ nguyên Tiền về / đặt hàng / việc cần làm của lúc 8:00", () => {
    const r = withFreshYesterday(base, later, now);
    expect(r.yesterday?.date).toBe("2026-11-04");
    expect(r.yesterday?.sales.value).toBe(64_804_900 - 2_469_000);
    expect(r.cash).toEqual(base.cash);
    expect(r.order).toEqual(base.order);
    expect(r.todo).toEqual(base.todo);
    expect(r.createdAt).toBe(base.createdAt);
    expect(r.refreshedAt).toBe(now.toISOString());
  });

  it("lúc 8:00 Pancake lỗi mà giờ lấy được thì có số, bỏ lỗi cũ", () => {
    const failed = { ...base, yesterday: null, statsError: "Pancake lỗi" };
    const r = withFreshYesterday(failed, later, now);
    expect(r.statsError).toBeNull();
    expect(r.yesterday?.orders.value).toBe(96);
  });

  it("Pancake lỗi lúc xem: giữ số lúc 8:00 kèm ghi chú", () => {
    const r = withFreshYesterday(base, null, now);
    expect(r.yesterday).toEqual(base.yesterday);
    expect(r.refreshError).toMatch(/số lúc lập báo cáo/);
    expect(r.refreshedAt).toBeUndefined();
  });
});

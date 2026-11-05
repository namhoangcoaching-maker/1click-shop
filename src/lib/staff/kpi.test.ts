import { describe, expect, it } from "vitest";
import { assignmentsFor, checkTemplate, describeFormula, kpiActual, kpiOutcome, parseTiers, type KpiAssignment, type KpiTemplate } from "./kpi";

const t = (o: Partial<KpiTemplate>): KpiTemplate => ({
  id: "t",
  name: "KPI",
  kind: "percent",
  source: "manual",
  channels: [],
  unitLabel: null,
  rate: 0,
  tiers: [],
  cap: null,
  archived: false,
  ...o,
});

describe("tiền KPI theo 5 kiểu", () => {
  it("% doanh thu: 1,5% × 40.000.000 = 600.000; doanh thu âm thì 0", () => {
    expect(kpiOutcome(t({ kind: "percent", rate: 1.5 }), null, 40_000_000).amount).toBe(600_000);
    expect(kpiOutcome(t({ kind: "percent", rate: 1.5 }), null, -740_000).amount).toBe(0);
  });

  it("theo số lượng: 20.000 ₫/video × 12 = 240.000; có trần", () => {
    expect(kpiOutcome(t({ kind: "per_unit", rate: 20_000 }), null, 12).amount).toBe(240_000);
    expect(kpiOutcome(t({ kind: "per_unit", rate: 20_000, cap: 200_000 }), null, 12).amount).toBe(200_000);
  });

  it("bậc thang: lấy bậc cao nhất đã đạt; chưa đạt bậc nào = 0", () => {
    const k = t({ kind: "tiers", tiers: [{ pct: 80, amount: 500_000 }, { pct: 100, amount: 1_000_000 }, { pct: 120, amount: 1_500_000 }] });
    expect(kpiOutcome(k, 100_000_000, 105_000_000)).toMatchObject({ amount: 1_000_000, completion: 105, tier: { pct: 100 } });
    expect(kpiOutcome(k, 100_000_000, 79_990_000)).toMatchObject({ amount: 0, tier: null });
    expect(kpiOutcome(k, 100_000_000, 130_000_000).amount).toBe(1_500_000);
  });

  it("tỷ lệ hoàn thành: mức thưởng × %, tối đa 100%", () => {
    const k = t({ kind: "completion", rate: 2_000_000 });
    expect(kpiOutcome(k, 50, 40)).toMatchObject({ amount: 1_600_000, completion: 80 });
    expect(kpiOutcome(k, 50, 70).amount).toBe(2_000_000);
  });

  it("trừ phạt: số âm, không bị trần thưởng chặn", () => {
    expect(kpiOutcome(t({ kind: "penalty", rate: 30_000, cap: 10_000 }), null, 3).amount).toBe(-90_000);
  });

  it("chưa có kết quả thì 0 đồng; thiếu chỉ tiêu thì bậc thang = 0", () => {
    expect(kpiOutcome(t({ kind: "per_unit", rate: 1 }), null, null)).toMatchObject({ amount: 0, actual: null });
    expect(kpiOutcome(t({ kind: "tiers", tiers: [{ pct: 1, amount: 9 }] }), null, 100).amount).toBe(0);
  });
});

describe("kết quả thực tế theo nguồn", () => {
  const ctx = {
    shop: 196_824_360,
    bySource: new Map([["-1", 100], ["-3", 50], ["1", 7]]),
    bySeller: new Map([["s1", 37_267_000]]),
  };
  it("lấy đúng nguồn", () => {
    expect(kpiActual(t({ source: "shop_revenue" }), ctx, { sellerId: null, manual: null })).toBe(196_824_360);
    expect(kpiActual(t({ source: "channel_revenue", channels: ["-1", "1", "9"] }), ctx, { sellerId: null, manual: null })).toBe(107);
    expect(kpiActual(t({ source: "seller_revenue" }), ctx, { sellerId: "s1", manual: null })).toBe(37_267_000);
    expect(kpiActual(t({ source: "seller_revenue" }), ctx, { sellerId: "s9", manual: null })).toBe(0);
    expect(kpiActual(t({ source: "manual" }), ctx, { sellerId: null, manual: 12 })).toBe(12);
  });
  it("chưa nối nhân viên Pancake, hoặc Pancake lỗi → chưa có kết quả", () => {
    expect(kpiActual(t({ source: "seller_revenue" }), ctx, { sellerId: null, manual: null })).toBeNull();
    expect(kpiActual(t({ source: "shop_revenue" }), { shop: null, bySource: null, bySeller: null }, { sellerId: null, manual: null })).toBeNull();
  });
});

describe("KPI áp cho người", () => {
  const all: KpiAssignment[] = [
    { id: "a1", templateId: "T1", userId: "u1", department: null, target: 10 },
    { id: "a2", templateId: "T1", userId: null, department: "Bán hàng", target: 99 },
    { id: "a3", templateId: "T2", userId: null, department: "Bán hàng", target: null },
    { id: "a4", templateId: "T3", userId: null, department: "Kho", target: null },
  ];
  it("gắn đích danh + bộ phận mình; gắn đích danh thắng khi trùng mẫu", () => {
    expect(assignmentsFor(all, "u1", "Bán hàng").map((a) => a.id)).toEqual(["a1", "a3"]);
    expect(assignmentsFor(all, "u2", "Bán hàng").map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(assignmentsFor(all, "u3", null).map((a) => a.id)).toEqual([]);
  });
});

describe("form mẫu KPI", () => {
  const form = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
    return f;
  };
  it("% doanh thu theo kênh, tỷ lệ có dấu phẩy", () => {
    const r = checkTemplate(form({ name: "Trực page", kind: "percent", source: "channel_revenue", channels: ["-1", "-11"], rate: "1,5", cap: "3.000.000" }));
    expect(r).toEqual({ ok: true, value: { name: "Trực page", kind: "percent", source: "channel_revenue", channels: ["-1", "-11"], unitLabel: null, rate: 1.5, tiers: [], cap: 3_000_000 } });
  });
  it("theo số lượng luôn là nhập tay", () => {
    const r = checkTemplate(form({ name: "Video", kind: "per_unit", source: "shop_revenue", rate: "20.000", unitLabel: "video" }));
    expect(r.ok && r.value).toMatchObject({ source: "manual", rate: 20_000, unitLabel: "video" });
  });
  it("báo lỗi dễ hiểu", () => {
    expect(checkTemplate(form({ name: "", kind: "percent", source: "shop_revenue", rate: "1" })).ok).toBe(false);
    expect(checkTemplate(form({ name: "X", kind: "percent", source: "manual", rate: "1" })).ok).toBe(false);
    expect(checkTemplate(form({ name: "X", kind: "percent", source: "channel_revenue", rate: "1" })).ok).toBe(false);
    expect(checkTemplate(form({ name: "X", kind: "tiers", source: "shop_revenue", tiers: "abc" })).ok).toBe(false);
    expect(checkTemplate(form({ name: "X", kind: "per_unit", source: "manual", rate: "" })).ok).toBe(false);
  });
});

describe("nhập bậc thang", () => {
  it("đọc được nhiều cách viết, sắp xếp tăng dần", () => {
    expect(parseTiers("100:1.000.000, 80: 500.000")).toEqual([{ pct: 80, amount: 500_000 }, { pct: 100, amount: 1_000_000 }]);
    expect(parseTiers("80% → 500000\n120%=1500000")).toEqual([{ pct: 80, amount: 500_000 }, { pct: 120, amount: 1_500_000 }]);
  });
  it("từ chối viết sai, trùng mức", () => {
    expect(parseTiers("")).toBeNull();
    expect(parseTiers("tám mươi: 5")).toBeNull();
    expect(parseTiers("80:1, 80:2")).toBeNull();
  });
  it("mô tả công thức", () => {
    expect(describeFormula(t({ kind: "per_unit", rate: 20000, unitLabel: "video" }))).toBe("20.000 ₫/video");
    expect(describeFormula(t({ kind: "percent", rate: 1.5 }))).toBe("1,5% doanh thu");
  });
});

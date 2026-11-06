import { describe, expect, it } from "vitest";
import { daysUntil, periodOf, pickRule, upcomingPeriods, type TaxRule } from "./rules";

const rule = (o: Partial<TaxRule>): TaxRule => ({
  id: "r",
  businessType: "household",
  revenueMin: 0,
  revenueMax: null,
  vatPeriod: "quarter",
  einvoiceRequired: true,
  annualRevenueNotice: false,
  summary: "",
  legalRef: null,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  ...o,
});

// Bảng khởi tạo giống migration 0018
const RULES = [
  rule({ id: "hkd-1ty", revenueMin: 0, revenueMax: 1_000_000_000, vatPeriod: "none", einvoiceRequired: false, annualRevenueNotice: true }),
  rule({ id: "hkd-50ty", revenueMin: 1_000_000_000, revenueMax: 50_000_000_000, vatPeriod: "quarter" }),
  rule({ id: "hkd-lon", revenueMin: 50_000_000_000, revenueMax: null, vatPeriod: "month" }),
  rule({ id: "cty", businessType: "company", revenueMin: 0, revenueMax: 50_000_000_000, vatPeriod: "quarter" }),
  rule({ id: "cty-lon", businessType: "company", revenueMin: 50_000_000_000, revenueMax: null, vatPeriod: "month" }),
];

describe("chọn quy định theo loại hình + doanh thu năm trước", () => {
  const on = "2026-11-06";
  it("hộ kinh doanh: ≤ 1 tỷ / > 1 tỷ / > 50 tỷ (đúng ranh giới)", () => {
    expect(pickRule(RULES, { businessType: "household", priorYearRevenue: 0 }, on)!.id).toBe("hkd-1ty");
    expect(pickRule(RULES, { businessType: "household", priorYearRevenue: 1_000_000_000 }, on)!.id).toBe("hkd-1ty");
    expect(pickRule(RULES, { businessType: "household", priorYearRevenue: 1_000_000_001 }, on)!.id).toBe("hkd-50ty");
    expect(pickRule(RULES, { businessType: "household", priorYearRevenue: 50_000_000_000 }, on)!.id).toBe("hkd-50ty");
    expect(pickRule(RULES, { businessType: "household", priorYearRevenue: 60_000_000_000 }, on)!.id).toBe("hkd-lon");
  });
  it("công ty mới thành lập (doanh thu 0) khai theo quý", () => {
    expect(pickRule(RULES, { businessType: "company", priorYearRevenue: 0 }, on)!.id).toBe("cty");
    expect(pickRule(RULES, { businessType: "company", priorYearRevenue: 80_000_000_000 }, on)!.id).toBe("cty-lon");
  });
  it("luật đổi: dòng mới có hiệu lực từ ngày đổi thắng, dòng cũ hết hiệu lực", () => {
    const changed = [
      rule({ id: "cu", revenueMin: 0, revenueMax: 500_000_000, vatPeriod: "none", effectiveTo: "2026-06-30" }),
      rule({ id: "moi", revenueMin: 0, revenueMax: 1_000_000_000, vatPeriod: "none", effectiveFrom: "2026-07-01" }),
    ];
    const s = { businessType: "household" as const, priorYearRevenue: 800_000_000 };
    expect(pickRule(changed, s, "2026-05-01")).toBeNull();
    expect(pickRule(changed, s, "2026-07-01")!.id).toBe("moi");
  });
});

describe("kỳ khai và hạn nộp", () => {
  it("theo quý: hạn là ngày cuối tháng đầu quý sau", () => {
    expect(periodOf("2026-11-06", "quarter")).toEqual({ label: "Quý 4/2026", start: "2026-10-01", end: "2026-12-31", deadline: "2027-01-31" });
    expect(periodOf("2026-08-15", "quarter").deadline).toBe("2026-10-31");
    expect(periodOf("2026-02-10", "quarter").deadline).toBe("2026-04-30");
  });
  it("theo tháng: ngày 20 tháng sau (tháng 12 → 20/1 năm sau)", () => {
    expect(periodOf("2026-11-06", "month")).toEqual({ label: "Tháng 11/2026", start: "2026-11-01", end: "2026-11-30", deadline: "2026-12-20" });
    expect(periodOf("2026-12-31", "month").deadline).toBe("2027-01-20");
    expect(periodOf("2028-02-03", "month").end).toBe("2028-02-29");
  });
  it("không khai định kỳ: thông báo doanh thu 31/1 năm sau", () => {
    expect(periodOf("2026-11-06", "none").deadline).toBe("2027-01-31");
  });
  it("lịch: gồm kỳ vừa xong nhưng chưa tới hạn", () => {
    expect(upcomingPeriods("2026-10-10", "quarter", 2).map((p) => p.label)).toEqual(["Quý 3/2026", "Quý 4/2026"]);
    expect(upcomingPeriods("2026-11-06", "quarter", 2).map((p) => p.label)).toEqual(["Quý 4/2026", "Quý 1/2027"]);
    expect(upcomingPeriods("2026-12-05", "month", 2).map((p) => p.label)).toEqual(["Tháng 11/2026", "Tháng 12/2026"]);
  });
  it("đếm ngày tới hạn", () => {
    expect(daysUntil("2026-11-06", "2026-11-13")).toBe(7);
    expect(daysUntil("2026-11-06", "2026-10-31")).toBe(-6);
  });
});

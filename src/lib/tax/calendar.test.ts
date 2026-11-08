import { describe, expect, it } from "vitest";
import { dueLabel, isDueSoon, taxCalendar, taxReportPart, thresholdWarning } from "./calendar";
import type { TaxRule } from "./rules";

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
const SMALL = rule({ id: "nho", revenueMin: 0, revenueMax: 1_000_000_000, vatPeriod: "none", einvoiceRequired: false, annualRevenueNotice: true });
const MID = rule({ id: "vua", revenueMin: 1_000_000_000, revenueMax: 50_000_000_000, vatPeriod: "quarter" });
const BIG = rule({ id: "lon", revenueMin: 50_000_000_000, revenueMax: null, vatPeriod: "month" });
const RULES = [SMALL, MID, BIG];

describe("lịch thuế", () => {
  it("khai theo quý: 3 kỳ tới + hạn điều chỉnh hóa đơn gom theo kỳ (kể cả quá hạn), sắp theo ngày", () => {
    const ev = taxCalendar({
      today: "2026-11-08",
      rule: MID,
      adjust: [
        { deadline: "2026-10-31", periodLabel: "Quý 3/2026" },
        { deadline: "2026-10-31", periodLabel: "Quý 3/2026" },
        { deadline: "2027-01-31", periodLabel: "Quý 4/2026" },
      ],
    });
    expect(ev.map((e) => [e.date, e.kind, e.daysLeft])).toEqual([
      ["2026-10-31", "invoice_adjust", -8],
      ["2027-01-31", "vat_filing", 84],
      ["2027-01-31", "invoice_adjust", 84],
      ["2027-04-30", "vat_filing", 173],
      ["2027-07-31", "vat_filing", 265],
    ]);
    expect(ev[0].title).toBe("Điều chỉnh 2 hóa đơn (Quý 3/2026)");
    expect(ev[1].title).toBe("Nộp tờ khai thuế GTGT Quý 4/2026");
  });

  it("hộ kinh doanh dưới ngưỡng: chỉ có thông báo doanh thu 31/1 năm sau", () => {
    const ev = taxCalendar({ today: "2026-11-08", rule: SMALL, adjust: [] });
    expect(ev).toEqual([expect.objectContaining({ date: "2027-01-31", kind: "annual_notice", title: "Thông báo doanh thu năm 2026" })]);
  });

  it("nhắc: còn ≤ 7 ngày (gồm hạn hôm nay) và quá hạn", () => {
    expect([8, 7, 1, 0, -2].map((d) => isDueSoon({ daysLeft: d }))).toEqual([false, true, true, true, true]);
    expect([7, 1, 0, -3].map(dueLabel)).toEqual(["còn 7 ngày", "còn 1 ngày", "hạn hôm nay", "quá hạn 3 ngày"]);
  });

  it("theo tháng: kỳ vừa xong chưa tới hạn ngày 20 vẫn còn trong lịch", () => {
    const ev = taxCalendar({ today: "2026-12-13", rule: BIG, adjust: [], periods: 2 });
    expect(ev.map((e) => [e.title, e.daysLeft])).toEqual([
      ["Nộp tờ khai thuế GTGT Tháng 11/2026", 7],
      ["Nộp tờ khai thuế GTGT Tháng 12/2026", 38],
    ]);
  });
});

describe("phần Thuế trong báo cáo 8:00", () => {
  it("gồm việc sắp tới hạn / quá hạn, hạn kế tiếp, số hóa đơn", () => {
    const events = taxCalendar({ today: "2026-11-08", rule: MID, adjust: [{ deadline: "2026-10-31", periodLabel: "Quý 3/2026" }] });
    const part = taxReportPart({ events, adjust: [{ daysLeft: -8 }, { daysLeft: 84 }], missing: 2, rate: 100, warning: null });
    expect(part.due.map((d) => d.title)).toEqual(["Điều chỉnh 1 hóa đơn (Quý 3/2026)"]);
    expect(part.next).toMatchObject({ title: "Nộp tờ khai thuế GTGT Quý 4/2026", daysLeft: 84 });
    expect(part).toMatchObject({ adjust: 2, adjustOverdue: 1, missing: 2, rate: 100, warning: null });
  });
});

describe("cảnh báo vượt ngưỡng", () => {
  const hkd = { businessType: "household" as const, priorYearRevenue: 600_000_000 };

  it("lũy kế ≥ 80% ngưỡng → sắp vượt", () => {
    // 850tr tới 08/11 → dự báo ≈ 994tr: sắp vượt nhưng dự báo vẫn trong ngưỡng
    const w = thresholdWarning({ today: "2026-11-08", ytd: 850_000_000, settings: hkd, rules: RULES, rule: SMALL });
    expect(w).toMatchObject({ level: "near", threshold: 1_000_000_000, pct: 85 });
    expect(w!.nextRule!.id).toBe("nho");
    // 900tr → dự báo ≈ 1,05 tỷ → năm sau khai theo quý
    expect(thresholdWarning({ today: "2026-11-08", ytd: 900_000_000, settings: hkd, rules: RULES, rule: SMALL })!.nextRule!.id).toBe("vua");
  });

  it("chưa tới 80% nhưng dự báo cả năm vượt → báo theo dự báo", () => {
    // 01/07 (ngày 182/365), lũy kế 600tr → dự báo ≈ 1,2 tỷ
    const w = thresholdWarning({ today: "2026-07-01", ytd: 600_000_000, settings: hkd, rules: RULES, rule: SMALL });
    expect(w).toMatchObject({ level: "projected", pct: 60 });
    expect(w!.projected).toBe(Math.round((600_000_000 / 182) * 365));
  });

  it("đã vượt; không vượt thì không báo; quy định không có ngưỡng trên thì không báo", () => {
    expect(thresholdWarning({ today: "2026-11-08", ytd: 1_200_000_000, settings: hkd, rules: RULES, rule: SMALL })!.level).toBe("exceeded");
    expect(thresholdWarning({ today: "2026-11-08", ytd: 300_000_000, settings: hkd, rules: RULES, rule: SMALL })).toBeNull();
    expect(thresholdWarning({ today: "2026-11-08", ytd: 90_000_000_000, settings: hkd, rules: RULES, rule: BIG })).toBeNull();
  });
});

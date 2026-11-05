import { describe, expect, it } from "vitest";
import {
  buildMonthFinance,
  adsChannel,
  adsAlerts,
  cashOutByDay,
  isAdsCategory,
  expenseLines,
  groupExpenses,
  monthRange,
  recentMonths,
  resolveMonth,
  shippingFeeLines,
  UNNAMED_TAG,
  type ExpenseTransaction,
} from "./month";

// 3 phiếu chi thật chủ shop tạo trên Pancake ngày 05/11/2026 (giờ VN 01:03–01:05).
const tx = (o: Partial<ExpenseTransaction>): ExpenseTransaction => ({
  display_id: "X",
  name: "x",
  amount: -1,
  tag_ids: [],
  time_incurred: null,
  posted_at: "2026-11-04T18:05:00Z",
  status: 1,
  is_canceled: false,
  ...o,
});
const real = [
  tx({ display_id: "IHE24776", name: "Sản xuất", amount: -30_000_000, tag_ids: ["45f7"], time_incurred: "2026-11-04T18:04:53Z" }),
  tx({ display_id: "NNQ24777", name: "Quay chụp ngày 05/11", amount: -5_600_000, tag_ids: ["f754"], time_incurred: "2026-11-04T18:05:16Z" }),
  tx({ display_id: "IFP24775", name: "Lương", amount: -5_000_000, tag_ids: ["bd1f"], time_incurred: "2026-11-04T18:03:45Z" }),
  // Phiếu Pancake tự sinh theo đơn (không có thẻ) – KHÔNG phải chi phí
  tx({ display_id: "LSB24762", name: "Hoàn cho đơn hàng #32609", amount: -740_000 }),
];
const names = new Map([
  ["45f7", "Sản xuất"],
  ["f754", "Quay chụp"],
  ["bd1f", "Lương"],
]);

describe("tháng", () => {
  it("khoảng ngày của tháng, kể cả tháng 2", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
  });

  it("tháng từ thanh địa chỉ: sai hoặc ở tương lai thì về tháng hiện tại", () => {
    expect(resolveMonth("2026-10", "2026-11-05")).toBe("2026-10");
    expect(resolveMonth("2026-13", "2026-11-05")).toBe("2026-11");
    expect(resolveMonth("2026-12", "2026-11-05")).toBe("2026-11");
    expect(resolveMonth(undefined, "2026-11-05")).toBe("2026-11");
  });

  it("6 tháng gần nhất, qua năm", () => {
    expect(recentMonths("2026-02-10", 4)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
});

describe("expenseLines / groupExpenses", () => {
  const lines = expenseLines(real, names, "2026-11-01", "2026-11-30");

  it("chỉ lấy phiếu chi CÓ THẺ, theo ngày phát sinh giờ VN; phiếu tự sinh theo đơn bị bỏ", () => {
    expect(lines.map((l) => [l.date, l.category, l.amount, l.displayId])).toEqual([
      ["2026-11-05", "Lương", 5_000_000, "IFP24775"],
      ["2026-11-05", "Sản xuất", 30_000_000, "IHE24776"],
      ["2026-11-05", "Quay chụp", 5_600_000, "NNQ24777"],
    ]);
  });

  it("bỏ phiếu hủy, phiếu chưa hiệu lực, phiếu thu; thẻ chưa đặt tên ghi rõ", () => {
    const l = expenseLines(
      [
        tx({ amount: -1, tag_ids: ["a"], is_canceled: true }),
        tx({ amount: -1, tag_ids: ["a"], status: 0 }),
        tx({ amount: 500, tag_ids: ["a"] }),
        tx({ amount: -9, tag_ids: ["moi"] }),
      ],
      names,
      "2026-11-01",
      "2026-11-30",
    );
    expect(l.map((x) => [x.category, x.amount])).toEqual([[UNNAMED_TAG, 9]]);
  });

  it("ngoài tháng thì không tính", () => {
    expect(expenseLines(real, names, "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("gộp theo loại: Sản xuất (trả xưởng) lên đầu", () => {
    expect(groupExpenses(lines).map((g) => [g.category, g.total])).toEqual([
      ["Sản xuất", 30_000_000],
      ["Quay chụp", 5_600_000],
      ["Lương", 5_000_000],
    ]);
  });
});

describe("buildMonthFinance – hai phần tách bạch", () => {
  const f = buildMonthFinance({
    month: "2026-11",
    today: "2026-11-05",
    pancake: { sales: 120_000_000, revenue: 90_000_000, fee: 25_000_000, partnerFee: 240_600 },
    cashDays: [
      { date: "2026-11-04", total: 53_369_775 },
      { date: "2026-11-05", total: 32_768_085 },
      { date: "2026-11-06", total: 33_110_049 }, // dự kiến
    ],
    expenses: expenseLines(real, names, "2026-11-01", "2026-11-30"),
    shippingFeePaid: 1_530_066,
    ads: null,
  });

  it("Lợi nhuận kinh doanh = Doanh thu (đã trừ phí sàn) − phí vận chuyển ngoại sàn − chi phí theo thẻ; KHÔNG trừ phí sàn lần nữa", () => {
    expect(f.expenseTotal).toBe(40_600_000);
    expect(f.profit).toEqual({
      sales: 120_000_000, fee: 25_000_000, revenue: 90_000_000, partnerFee: 240_600, ads: null,
      result: 90_000_000 - 240_600 - 40_600_000,
    });
  });
  it("phí ship ngoại sàn chỉ trừ ở Lợi nhuận; Dòng tiền trừ phí ship trả riêng (không trừ trùng)", () => {
    expect(f.cash.net).toBe(86_137_860 - 40_600_000 - 1_530_066);
  });

  it("Dòng tiền = Tiền về đã tới hạn − chi phí − phí ship trả riêng; tách phần dự kiến", () => {
    expect(f.cash.received).toBe(86_137_860);
    expect(f.cash.expected).toBe(33_110_049);
    expect(f.cash.net).toBe(86_137_860 - 40_600_000 - 1_530_066);
    expect(f.cash.netWithExpected).toBe(f.cash.net + 33_110_049);
  });

  it("có quảng cáo thì trừ ở cả hai phần", () => {
    const g = buildMonthFinance({
      month: "2026-11", today: "2026-11-05", pancake: { sales: 1, revenue: 100, fee: 0, partnerFee: 0 },
      cashDays: [{ date: "2026-11-01", total: 100 }], expenses: [], shippingFeePaid: 0, ads: 30,
    });
    expect(g.profit.result).toBe(70);
    expect(g.cash.net).toBe(70);
  });

  it("không lấy được số Pancake thì Lợi nhuận để trống (không đoán)", () => {
    const g = buildMonthFinance({
      month: "2026-11", today: "2026-11-05", pancake: null, cashDays: [], expenses: [], shippingFeePaid: 0, ads: null,
    });
    expect(g.profit.result).toBeNull();
  });
});

describe("tiền chi theo ngày (bảng Tiền về)", () => {
  const txs = [
    ...real,
    // Phí ship trả riêng 2 phiếu cùng ngày 05/11 (giờ VN), 1 phiếu hủy, 1 ngoài khoảng
    tx({ name: "Thanh toán phí vận chuyển cho đơn hàng #41000", amount: -30_000, posted_at: "2026-11-05T02:00:00Z" }),
    tx({ name: "Thanh toán phí vận chuyển cho đơn hàng #41001", amount: -14_000, posted_at: "2026-11-04T17:30:00Z" }),
    tx({ name: "Thanh toán phí vận chuyển cho đơn hàng #41002", amount: -99_000, posted_at: "2026-11-05T02:00:00Z", is_canceled: true }),
    tx({ name: "Thanh toán phí vận chuyển cho đơn hàng #40000", amount: -20_000, posted_at: "2026-10-20T02:00:00Z" }),
  ];
  const ship = shippingFeeLines(txs, "2026-11-04", "2026-11-06");

  it("phí ship trả riêng theo ngày tạo phiếu giờ VN, bỏ phiếu hủy và ngoài khoảng", () => {
    expect(ship).toEqual([
      { date: "2026-11-05", amount: 30_000 },
      { date: "2026-11-05", amount: 14_000 },
    ]);
  });

  it("mỗi ngày: chi theo thẻ + phí ship, ngày không chi = 0; loại Sản xuất trước", () => {
    const { days, categories } = cashOutByDay(expenseLines(txs, names, "2026-11-04", "2026-11-06"), ship, "2026-11-04", "2026-11-06");
    expect(categories).toEqual(["Sản xuất", "Quay chụp", "Lương", "Khác"]);
    expect(days.map((d) => [d.date, d.total, d.shippingFee])).toEqual([
      ["2026-11-04", 0, 0],
      ["2026-11-05", 40_600_000 + 44_000, 44_000],
      ["2026-11-06", 0, 0],
    ]);
    expect(days[1].byCategory).toEqual({ "Sản xuất": 30_000_000, "Quay chụp": 5_600_000, Lương: 5_000_000 });
  });

  it("không có phiếu chi nào: vẫn có sẵn cột Khác", () => {
    expect(cashOutByDay(expenseLines(txs, names, "2026-11-06", "2026-11-08"), [], "2026-11-06", "2026-11-08").categories).toEqual(["Khác"]);
  });
});

describe("cột chi phí luôn có sẵn", () => {
  it("mọi thẻ đã đặt tên đều có cột dù chưa chi; thẻ tên Khác dùng đúng tên đó, xếp cuối", () => {
    const lines = expenseLines(real, names, "2026-11-05", "2026-11-05");
    const { categories } = cashOutByDay(lines, [], "2026-11-05", "2026-11-05", ["Mặt bằng", "khác", "Lương", "Phần mềm"]);
    expect(categories).toEqual(["Sản xuất", "Quay chụp", "Lương", "Mặt bằng", "Phần mềm", "khác"]);
  });
});

describe("quảng cáo nhập tay qua thẻ “Quảng cáo …” (cách b)", () => {
  const adNames = new Map([...names, ["qs", "Quảng cáo Shopee"], ["qt", "quảng cáo TikTok"]]);
  const txs = [
    ...real,
    tx({ display_id: "QC1", name: "Nạp QC Shopee", amount: -4_000_000, tag_ids: ["qs"], time_incurred: "2026-11-02T03:00:00Z" }),
    tx({ display_id: "QC2", name: "GMV Max", amount: -3_000_000, tag_ids: ["qt"], time_incurred: "2026-11-03T03:00:00Z" }),
  ];
  const base = {
    month: "2026-11", today: "2026-11-05",
    pancake: { sales: 120_000_000, revenue: 50_000_000, fee: 0, partnerFee: 0 },
    revenueBySource: { Shopee: 30_000_000, Tiktok: 10_000_000 },
    cashDays: [{ date: "2026-11-05", total: 100_000_000 }],
    expenses: expenseLines(txs, adNames, "2026-11-01", "2026-11-30"),
    shippingFeePaid: 0, ads: null,
  };
  const f = buildMonthFinance(base);

  it("nhận ra thẻ quảng cáo, tách kênh theo tên thẻ", () => {
    expect(isAdsCategory("Quảng cáo Shopee")).toBe(true);
    expect(isAdsCategory("quảng cáo TikTok")).toBe(true);
    expect(isAdsCategory("Quay chụp")).toBe(false);
    expect(adsChannel("Quảng cáo Shopee")).toBe("Shopee");
    expect(adsChannel("Quảng cáo: TikTok")).toBe("TikTok");
    expect(adsChannel("Quảng cáo")).toBeNull();
  });

  it("quảng cáo KHÔNG nằm trong chi phí thường; trừ ở cả Lợi nhuận và Dòng tiền, không trừ hai lần", () => {
    expect(f.expenseTotal).toBe(40_600_000);
    expect(f.adsGroups.map((g) => [g.category, g.total])).toEqual([["Quảng cáo Shopee", 4_000_000], ["quảng cáo TikTok", 3_000_000]]);
    expect(f.profit.ads).toBe(7_000_000);
    expect(f.profit.result).toBe(50_000_000 - 40_600_000 - 7_000_000);
    expect(f.cash.net).toBe(100_000_000 - 40_600_000 - 7_000_000);
  });

  it("cảnh báo: toàn shop > 12% doanh thu, kênh TikTok > 25% (tên nguồn khác hoa/thường vẫn khớp); Shopee 13,3% thì không", () => {
    expect(f.adsAlerts.map((a) => [a.channel, Math.round(a.ratio * 1000) / 1000])).toEqual([
      [null, 0.14],
      ["TikTok", 0.3],
    ]);
  });

  it("chưa có thẻ quảng cáo: để trống (chưa có số); có thẻ mà tháng này chưa chi: 0", () => {
    const none = buildMonthFinance({ ...base, expenses: expenseLines(real, names, "2026-11-01", "2026-11-30") });
    expect(none.profit.ads).toBeNull();
    expect(buildMonthFinance({ ...base, expenses: [], hasAdsTags: true }).profit.ads).toBe(0);
  });

  it("đúng ngưỡng thì chưa cảnh báo", () => {
    expect(adsAlerts([{ category: "Quảng cáo Shopee", total: 25, lines: [] }], 1_000, { Shopee: 100 })).toEqual([]);
  });
});

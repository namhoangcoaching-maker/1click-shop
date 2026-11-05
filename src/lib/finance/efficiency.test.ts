import { describe, expect, it } from "vitest";
import { adsByChannel, buildEfficiency, buildSourceGroups, type SourceInput } from "./efficiency";
import { buildMonthFinance, type ExpenseLine } from "./month";

const line = (category: string, amount: number, date = "2026-11-05"): ExpenseLine => ({
  date,
  amount,
  tagId: category,
  category,
  displayId: null,
  name: null,
});

// Số thật Sugar Crush tháng 11/2026 (tới 05/11), đã thấy trên trang Dòng tiền.
const expenses = [
  line("Sản xuất", 30_000_000),
  line("Quay chụp", 5_600_000),
  line("Lương", 5_000_000),
  line("Quảng cáo Tiktok", 6_000_000),
  line("Quảng cáo Facebook", 5_000_000),
  line("Quảng cáo Shopee", 5_000_000),
];

describe("buildEfficiency – Hiệu quả kinh doanh theo tháng", () => {
  const e = buildEfficiency({ pancakeRevenue: 181_080_576, fee: 54_350_388, partnerFee: 240_600, expenses });

  it("Doanh thu = Doanh thu Pancake + phí sàn (chưa trừ phí sàn)", () => {
    expect(e.revenue).toBe(235_430_964);
  });

  it("đủ các loại chi phí theo thứ tự, quảng cáo 3 kênh gộp một dòng", () => {
    expect(e.costs.map((c) => [c.label, c.amount])).toEqual([
      ["Phí sàn", 54_350_388],
      ["Phí vận chuyển", 240_600],
      ["Sản xuất", 30_000_000],
      ["Lương nhân sự", 5_000_000],
      ["Quay chụp", 5_600_000],
      ["Quảng cáo", 16_000_000],
      ["Chi phí khác", 0],
    ]);
  });

  it("Lợi nhuận bằng đúng Lợi nhuận kinh doanh của trang Dòng tiền", () => {
    expect(e.profit).toBe(124_239_976);
    const month = buildMonthFinance({
      month: "2026-11",
      today: "2026-11-05",
      pancake: { sales: 0, revenue: 181_080_576, fee: 54_350_388, partnerFee: 240_600 },
      cashDays: [],
      expenses,
      shippingFeePaid: 0,
      ads: null,
    });
    expect(e.profit).toBe(month.profit.result);
  });

  it("% từng khoản so với doanh thu", () => {
    expect(e.costs[0].percent).toBeCloseTo(23.09, 2);
    expect(e.costs.find((c) => c.label === "Quảng cáo")!.percent).toBeCloseTo(6.8, 2);
    expect(e.profitPercent).toBeCloseTo(52.77, 2);
  });

  it("thẻ khác (Phần mềm, thẻ chưa đặt tên…) gộp vào Chi phí khác; doanh thu 0 thì không chia %", () => {
    const x = buildEfficiency({
      pancakeRevenue: 0,
      fee: 0,
      partnerFee: 0,
      expenses: [line("Phần mềm", 300_000), line("Thẻ chưa đặt tên", 200_000), line("lương", 1)],
    });
    expect(x.costs.find((c) => c.label === "Chi phí khác")!.amount).toBe(500_000);
    expect(x.costs.find((c) => c.label === "Lương nhân sự")!.amount).toBe(1);
    expect(x.profitPercent).toBeNull();
  });
});

const src = (source: string, revenue: number, fee: number, previous: number | null = null): SourceInput => ({
  source,
  revenue: { value: revenue, previous },
  fee: { value: fee, previous: previous === null ? null : 0 },
  profit: 0,
  orders: 1,
  gross: revenue + fee,
});

describe("buildSourceGroups – Nguồn đơn kèm phí sàn, ads, ME/RE", () => {
  const ads = adsByChannel(expenses, "2026-11-01", "2026-11-30");

  it("chỉ lấy thẻ quảng cáo trong khoảng ngày, theo kênh", () => {
    expect([...ads]).toEqual([["Tiktok", 6_000_000], ["Facebook", 5_000_000], ["Shopee", 5_000_000]]);
    expect(adsByChannel(expenses, "2026-11-06", "2026-11-06").size).toBe(0);
  });

  const groups = buildSourceGroups(
    [src("Shopee", 100_000_000, 30_000_000), src("TikTok", 10_000_000, 5_000_000), src("Facebook", 4_000_000, 0), src("Instagram", 16_000_000, 0)],
    ads,
  );

  it("doanh thu chưa trừ phí sàn; Shopee: (phí sàn + ads) ÷ doanh thu", () => {
    const shopee = groups[0];
    expect(shopee.rows.map((r) => [r.source, r.revenue, r.fee])).toEqual([["Shopee", 130_000_000, 30_000_000]]);
    expect(shopee.ads).toBe(5_000_000);
    expect(shopee.meRe).toBeCloseTo(3.85, 2);
    expect(shopee.costPercent).toBeCloseTo(26.92, 2);
  });

  it("Facebook + Instagram: doanh thu tách 2 dòng, ads và ME/RE chung một ô trên doanh thu gộp", () => {
    const meta = groups.find((g) => g.rows.some((r) => r.source === "Facebook"))!;
    expect(meta.rows.map((r) => [r.source, r.revenue])).toEqual([["Instagram", 16_000_000], ["Facebook", 4_000_000]]);
    expect(meta.ads).toBe(5_000_000);
    expect(meta.meRe).toBe(25);
    expect(meta.costPercent).toBe(25);
  });

  it("thẻ 'Quảng cáo Tiktok' khớp nguồn 'TikTok' (không phân biệt hoa thường)", () => {
    const tt = groups.find((g) => g.rows[0].source === "TikTok")!;
    expect(tt.ads).toBe(6_000_000);
    expect(tt.meRe).toBe(40);
    expect(tt.costPercent).toBeCloseTo(73.33, 2);
  });

  it("nguồn không có ads: ME/RE trống, % chi phí = phí sàn; kênh có ads mà chưa có đơn vẫn hiện", () => {
    const g = buildSourceGroups([src("Shopify", 7_000_000, 0)], new Map([["Facebook", 1_000_000]]));
    const shopify = g.find((x) => x.rows[0].source === "Shopify")!;
    expect(shopify.meRe).toBeNull();
    expect(shopify.costPercent).toBe(0);
    const meta = g.find((x) => x.ads > 0)!;
    expect(meta.rows.map((r) => r.source)).toEqual(["Facebook", "Instagram"]);
    expect(meta.meRe).toBeNull();
  });

  it("kỳ trước cũng cộng lại phí sàn để so cùng loại doanh thu", () => {
    const [g] = buildSourceGroups([{ ...src("Shopee", 10, 5, 8), fee: { value: 5, previous: 4 } }], new Map());
    expect(g.rows[0].previous).toBe(12);
  });
});

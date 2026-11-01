/**
 * SỐ LIỆU GIẢ cho bản mẫu trang Tổng quan (/design).
 * Chỉ để duyệt giao diện. Giai đoạn 1 sẽ thay bằng dữ liệu đồng bộ từ Pancake POS.
 */
import {
  addDays,
  listDays,
  rangeLength,
  type DateRange,
  type DateString,
} from "@/lib/date-range";
import type { StockItem } from "@/lib/inventory/stock";
import type {
  Compared,
  Metric,
  OverviewData,
  SeriesPoint,
} from "./types";

/** Số "ngẫu nhiên" cố định theo hạt giống, để mỗi lần tải trang ra cùng một số. */
function noise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Mức độ đơn hàng theo giờ trong ngày: đêm ít, trưa và tối nhiều. */
const HOURLY_PROFILE = [
  0.2, 0.1, 0.05, 0.05, 0.05, 0.1, 0.3, 0.6, 0.9, 1.1, 1.2, 1.3, 1.4, 1.2, 1.0, 1.0, 1.1, 1.2, 1.3,
  1.5, 1.7, 1.6, 1.1, 0.6,
];

/** Chia một tổng thành các điểm trên biểu đồ (theo giờ nếu 1 ngày, theo ngày nếu nhiều ngày). */
function distribute(total: number, points: number, seed: number, hourly: boolean): number[] {
  const weights = Array.from({ length: points }, (_, i) => {
    const base = hourly ? HOURLY_PROFILE[i] : 1;
    return base * (0.7 + 0.6 * noise(i, seed));
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total * w) / sum);
}

function compared(value: number, previous: number | null): Compared {
  return { value, previous };
}

function dayLabel(date: DateString): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const SOURCES = [
  { source: "Shopee", share: 0.44, prevShare: 0.41, margin: 0.31, orderShare: 0.47 },
  { source: "TikTok Shop", share: 0.31, prevShare: 0.33, margin: 0.29, orderShare: 0.3 },
  { source: "Facebook", share: 0.14, prevShare: 0.15, margin: 0.45, orderShare: 0.12 },
  { source: "Website", share: 0.07, prevShare: 0.07, margin: 0.48, orderShare: 0.07 },
  { source: "Khác (Zalo, tại cửa hàng)", share: 0.04, prevShare: 0.04, margin: 0.5, orderShare: 0.04 },
];

/**
 * Tồn kho giả theo từng mã. soldInWindow = số bán 30 ngày gần nhất.
 * Dòng đầu là đúng ví dụ của chủ shop: bán 7 cái/ngày, còn 60 cái, sản xuất 8 ngày → báo động.
 */
const DEMO_STOCK: StockItem[] = [
  { sku: "EB-KG2T", name: "Kệ góc nhà tắm inox SUS304 2 tầng", stock: 60, soldInWindow: 210, leadTimeDays: 8, costPrice: 165_000, price: 290_000 },
  { sku: "EB-MD6", name: "Móc dán tường inox (bộ 6 cái)", stock: 40, soldInWindow: 330, leadTimeDays: 5, costPrice: 32_000, price: 65_000 },
  { sku: "EB-KKG", name: "Kệ để khăn gấp gọn", stock: 0, soldInWindow: 45, leadTimeDays: 10, costPrice: 120_000, price: 210_000 },
  { sku: "EB-GTK60", name: "Giá treo khăn inox SUS304 60cm", stock: 95, soldInWindow: 165, leadTimeDays: 10, costPrice: 118_000, price: 220_000 },
  { sku: "EB-MTA", name: "Móc treo áo choàng 2 nhánh", stock: 24, soldInWindow: 54, leadTimeDays: 9, costPrice: 45_000, price: 89_000 },
  { sku: "EB-KDG", name: "Kệ để dầu gội gắn tường", stock: 320, soldInWindow: 180, leadTimeDays: 7, costPrice: 88_000, price: 160_000 },
  { sku: "EB-KBC", name: "Kệ trên bồn cầu 2 tầng", stock: 130, soldInWindow: 120, leadTimeDays: 10, costPrice: 210_000, price: 390_000 },
  { sku: "EB-HGVS", name: "Hộp đựng giấy vệ sinh inox", stock: 85, soldInWindow: 60, leadTimeDays: 12, costPrice: null, price: 145_000 },
  { sku: "EB-KG3T", name: "Kệ góc nhà tắm inox SUS304 3 tầng", stock: 140, soldInWindow: 36, leadTimeDays: 10, costPrice: null, price: 420_000 },
  { sku: "EB-GPD", name: "Giá phơi đồ mini gấp gọn", stock: 410, soldInWindow: 75, leadTimeDays: 14, costPrice: 58_000, price: 115_000 },
  { sku: "EB-TTR", name: "Thanh treo rèm nhà tắm", stock: 210, soldInWindow: 12, leadTimeDays: 10, costPrice: null, price: 175_000 },
  { sku: "EB-KXP", name: "Kệ xà phòng đôi", stock: 180, soldInWindow: 0, leadTimeDays: 7, costPrice: 36_000, price: 79_000 },
];

export function getDemoOverview(
  range: DateRange,
  previousRange: DateRange | null,
  today: DateString,
): OverviewData {
  const days = rangeLength(range);
  const hasPrev = previousRange !== null;
  const hourly = days === 1;
  const labels = hourly
    ? HOURLY_PROFILE.map((_, h) => `${h}h`)
    : listDays(range).map(dayLabel);
  const points = labels.length;

  // --- Tổng các chỉ số chính ---
  const grossSales = 7_580_160 * days;
  const prevGrossSales = grossSales * 0.87;
  const revenue = grossSales * 0.918;
  const prevRevenue = prevGrossSales * 0.925;

  const sources = SOURCES.map((s) => ({
    source: s.source,
    revenue: compared(revenue * s.share, hasPrev ? prevRevenue * s.prevShare : null),
    profit: revenue * s.share * s.margin,
    orders: Math.round(20 * days * s.orderShare),
  }));
  const profit = sources.reduce((sum, s) => sum + s.profit, 0);
  const prevProfit = prevRevenue * 0.33;
  const orders = sources.reduce((sum, s) => sum + s.orders, 0);
  const prevOrders = Math.round(orders * 0.9);
  const adSpend = revenue * 0.14;
  const prevAdSpend = prevRevenue * 0.12;
  const platformFees = revenue * 0.06;
  const prevPlatformFees = prevRevenue * 0.058;

  function series(total: number, prevTotal: number, seed: number): SeriesPoint[] {
    const cur = distribute(total, points, seed, hourly);
    const prev = distribute(prevTotal, points, seed + 50, hourly);
    return labels.map((label, i) => ({
      label,
      current: cur[i],
      previous: hasPrev ? prev[i] : null,
    }));
  }

  const revenueSeries = series(revenue, prevRevenue, 2);
  const orderSeries = series(orders, prevOrders, 4);

  const metrics: Metric[] = [
    {
      key: "grossSales",
      label: "Doanh số",
      format: "vnd",
      positiveIsGood: true,
      hint: "Tổng tiền hàng của đơn chốt, trước chiết khấu",
      ...compared(grossSales, hasPrev ? prevGrossSales : null),
      series: series(grossSales, prevGrossSales, 1),
    },
    {
      key: "revenue",
      label: "Doanh thu",
      format: "vnd",
      positiveIsGood: true,
      hint: "Doanh số trừ chiết khấu",
      ...compared(revenue, hasPrev ? prevRevenue : null),
      series: revenueSeries,
    },
    {
      key: "profit",
      label: "Lợi nhuận",
      format: "vnd",
      positiveIsGood: true,
      hint: "Doanh thu trừ giá vốn",
      ...compared(profit, hasPrev ? prevProfit : null),
      series: series(profit, prevProfit, 3),
    },
    {
      key: "orders",
      label: "Đơn chốt",
      format: "number",
      positiveIsGood: true,
      ...compared(orders, hasPrev ? prevOrders : null),
      series: orderSeries,
    },
    {
      key: "aov",
      label: "GTTB",
      format: "vnd",
      positiveIsGood: true,
      hint: "Giá trị trung bình mỗi đơn = Doanh thu / Đơn chốt",
      ...compared(revenue / orders, hasPrev ? prevRevenue / prevOrders : null),
      series: revenueSeries.map((p, i) => {
        const o = orderSeries[i];
        return {
          label: p.label,
          current: o.current > 0 ? p.current / o.current : 0,
          previous: o.previous ? (p.previous ?? 0) / o.previous : hasPrev ? 0 : null,
        };
      }),
    },
    {
      key: "adSpend",
      label: "Chi phí quảng cáo",
      format: "vnd",
      positiveIsGood: false,
      ...compared(adSpend, hasPrev ? prevAdSpend : null),
      series: series(adSpend, prevAdSpend, 6),
    },
    {
      key: "platformFees",
      label: "Phí sàn",
      format: "vnd",
      positiveIsGood: false,
      hint: "Phí cố định, phí thanh toán, phí dịch vụ của Shopee, TikTok Shop…",
      ...compared(platformFees, hasPrev ? prevPlatformFees : null),
      series: series(platformFees, prevPlatformFees, 7),
    },
  ];

  // --- Các khối khác ---
  const payrollPerDay = 1_400_000;
  const income = revenue * 0.96;
  const expenseBreakdown = [
    { label: "Nhập hàng", amount: revenue * 0.38 },
    { label: "Quảng cáo", amount: adSpend },
    { label: "Lương nhân sự", amount: payrollPerDay * days },
    { label: "Phí sàn", amount: platformFees },
    { label: "Chi khác (phiếu chi)", amount: 350_000 * days },
  ];
  const expense = expenseBreakdown.reduce((sum, e) => sum + e.amount, 0);
  const invoicedOrders = Math.round(orders * 0.8);
  const shopee = sources[0];
  const tiktok = sources[1];
  const facebook = sources[2];

  return {
    metrics,
    closedOrders: {
      amount: compared(grossSales, hasPrev ? prevGrossSales : null),
      count: compared(orders, hasPrev ? prevOrders : null),
    },
    returnedOrders: {
      amount: compared(grossSales * 0.05, hasPrev ? prevGrossSales * 0.07 : null),
      count: compared(Math.max(1, Math.round(orders * 0.04)), hasPrev ? Math.max(1, Math.round(prevOrders * 0.06)) : null),
    },
    stock: DEMO_STOCK,
    sources,
    topProducts: [
      { name: "Kệ góc nhà tắm inox SUS304 2 tầng", sku: "EB-KG2T", quantity: 7 * days, revenue: 2_030_000 * days, linked: true },
      { name: "Giá treo khăn inox SUS304 60cm", sku: "EB-GTK60", quantity: Math.round(5.5 * days), revenue: 1_210_000 * days, linked: true },
      { name: "—", sku: null, quantity: 5 * days, revenue: 1_120_000 * days, linked: false },
      { name: "Kệ để dầu gội gắn tường", sku: "EB-KDG", quantity: 6 * days, revenue: 960_000 * days, linked: true },
      { name: "Móc dán tường inox (bộ 6 cái)", sku: "EB-MD6", quantity: 11 * days, revenue: 715_000 * days, linked: true },
    ],
    adCosts: [
      {
        channel: "TikTok Ads (gồm GMV Max)",
        cost: compared(adSpend * 0.47, hasPrev ? prevAdSpend * 0.42 : null),
        channelRevenue: tiktok.revenue.value,
      },
      {
        channel: "Facebook Ads",
        cost: compared(adSpend * 0.38, hasPrev ? prevAdSpend * 0.43 : null),
        channelRevenue: facebook.revenue.value,
      },
      {
        channel: "Shopee Ads",
        cost: compared(adSpend * 0.15, hasPrev ? prevAdSpend * 0.15 : null),
        channelRevenue: shopee.revenue.value,
      },
    ],
    topContent: [
      { title: "Lắp kệ góc không cần khoan trong 30 giây", platform: "tiktok", kind: "video", views: 184_200, likes: 9_310, url: "#" },
      { title: "Inox 304 thật hay giả? Thử bằng nam châm", platform: "youtube", kind: "video", views: 62_480, likes: 2_105, url: "#" },
      { title: "Before/after nhà tắm 3m² gọn gàng", platform: "facebook", kind: "video", views: 41_900, likes: 1_288, url: "#" },
      { title: "Bộ sưu tập kệ nhà tắm tông bạc", platform: "instagram", kind: "image", views: 12_740, likes: 865, url: "#" },
      { title: "Bảng so sánh inox 201 và 304", platform: "facebook", kind: "image", views: 9_820, likes: 412, url: "#" },
      { title: "Feedback khách: 2 năm không gỉ", platform: "tiktok", kind: "image", views: 7_365, likes: 530, url: "#" },
    ],
    tax: {
      profile: "Hộ kinh doanh · doanh thu năm trước 1–50 tỷ · khai thuế GTGT theo quý",
      totalOrders: orders,
      invoicedOrders,
      invoicesToAdjust: 3,
      deadlines: [
        { title: "Điều chỉnh 3 hóa đơn sai thông tin người mua", date: addDays(today, 3) },
        { title: "Nộp tờ khai thuế GTGT quý 4/2026", date: "2027-01-31" },
      ],
    },
    cashflow: {
      income: compared(income, hasPrev ? prevRevenue * 0.95 : null),
      expense: compared(expense, hasPrev ? expense * 0.93 : null),
      expenseBreakdown,
      unreconciledCod: revenue * 0.12,
    },
    staff: {
      attendance: [
        { name: "Nguyễn Thu Hà", status: "on_time", checkIn: "07:52" },
        { name: "Trần Minh Đức", status: "on_time", checkIn: "07:58" },
        { name: "Lê Hoài An", status: "late", checkIn: "08:17", lateMinutes: 17 },
        { name: "Phạm Quỳnh", status: "on_time", checkIn: "07:45" },
        { name: "Võ Tấn Lộc", status: "absent", checkIn: null },
      ],
      kpi: [
        { name: "Nguyễn Thu Hà", progress: 86, gapToNextTier: 4_200_000 },
        { name: "Võ Tấn Lộc", progress: 64, gapToNextTier: 11_500_000 },
        { name: "Lê Hoài An", progress: 102, gapToNextTier: null },
      ],
      payrollToDate: 31_850_000,
      performance: [
        { name: "Nguyễn Thu Hà", orders: Math.round(orders * 0.38), revenue: revenue * 0.4, closeRate: 41.2 },
        { name: "Võ Tấn Lộc", orders: Math.round(orders * 0.27), revenue: revenue * 0.25, closeRate: 33.8 },
        { name: "Lê Hoài An", orders: Math.round(orders * 0.15), revenue: revenue * 0.14, closeRate: 28.5 },
      ],
      unassignedOrders: orders - Math.round(orders * 0.38) - Math.round(orders * 0.27) - Math.round(orders * 0.15),
    },
  };
}

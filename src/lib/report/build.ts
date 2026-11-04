/**
 * Báo cáo hằng ngày 8:00 – ghép từ các phần đã có (thuần, có unit test).
 * Số tiền hôm qua lấy từ thống kê Pancake (giống Tổng quan); tiền về, đặt hàng do 1Click tính.
 */
import type { CashDay } from "@/lib/cash/compute";
import { addDays, type DateString } from "@/lib/date-range";
import type { OrderPlan } from "@/lib/inventory/plan";
import type { PancakeOverview } from "@/lib/overview/pancake-stats";

export const REPORT_HOUR_VN = 8;

export interface ReportMetric {
  value: number;
  previous: number | null;
}

export interface DailyReport {
  /** Ngày báo cáo (giờ VN). */
  date: DateString;
  /** Lúc lập (ISO). */
  createdAt: string;
  yesterday: {
    date: DateString;
    sales: ReportMetric;
    revenue: ReportMetric;
    profit: ReportMetric;
    orders: ReportMetric;
    returnedAmount: ReportMetric;
    returnedQty: ReportMetric;
    topSources: { name: string; revenue: number; orders: number }[];
    topProducts: { name: string; code: string | null; imageUrl: string | null; quantity: number; revenue: number }[];
  } | null;
  /** Không lấy được số Pancake (ghi lý do). */
  statsError: string | null;
  cash: {
    today: number;
    byChannel: { channel: string; amount: number }[];
    next7: number;
  };
  order: {
    label: string;
    date: DateString;
    isToday: boolean;
    products: number;
    quantity: number;
    top: { name: string; quantity: number }[];
    /** Mẫu cần sản xuất ngay (chỉ khi hôm nay không phải ngày đặt). */
    urgent: number;
  };
  todo: {
    missingCost: number;
    incomingToday: { product: string; variant: string; quantity: number }[];
  };
}

export interface ReportInputs {
  today: DateString;
  now: Date;
  stats: PancakeOverview | null;
  statsError: string | null;
  cashDays: CashDay[];
  plan: OrderPlan;
  missingCost: number;
  incomingToday: { product: string; variant: string; quantity: number }[];
}

const metric = (stats: PancakeOverview, key: string): ReportMetric => {
  const m = stats.metrics.find((x) => x.key === key);
  return { value: m?.value ?? 0, previous: m?.previous ?? null };
};

export function buildDailyReport(i: ReportInputs): DailyReport {
  const todayCash = i.cashDays.find((d) => d.date === i.today);
  const next7 = i.cashDays
    .filter((d) => d.date > i.today && d.date <= addDays(i.today, 7))
    .reduce((s, d) => s + d.total, 0);

  const nextDay = i.plan.days[0];
  const products = nextDay.products.filter((p) => !p.slow);
  const isToday = nextDay.day.date === i.today;

  return {
    date: i.today,
    createdAt: i.now.toISOString(),
    yesterday: i.stats
      ? {
          date: addDays(i.today, -1),
          sales: metric(i.stats, "grossSales"),
          revenue: metric(i.stats, "revenue"),
          profit: metric(i.stats, "profit"),
          orders: metric(i.stats, "orders"),
          returnedAmount: i.stats.returnedOrders.amount,
          returnedQty: i.stats.returnedOrders.count,
          topSources: i.stats.sources
            .filter((s) => s.orders > 0)
            .slice(0, 3)
            .map((s) => ({ name: s.source, revenue: s.revenue.value, orders: s.orders })),
          topProducts: i.stats.topProducts.slice(0, 3).map((p) => ({
            name: p.name,
            code: p.sku,
            imageUrl: p.imageUrl ?? null,
            quantity: p.quantity,
            revenue: p.revenue,
          })),
        }
      : null,
    statsError: i.statsError,
    cash: {
      today: todayCash?.total ?? 0,
      byChannel: Object.entries(todayCash?.byChannel ?? {})
        .map(([channel, amount]) => ({ channel, amount }))
        .sort((a, b) => b.amount - a.amount),
      next7,
    },
    order: {
      label: nextDay.day.label,
      date: nextDay.day.date,
      isToday,
      products: products.length,
      quantity: products.reduce((s, p) => s + p.total, 0),
      top: products
        .slice()
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((p) => ({ name: p.name, quantity: p.total })),
      urgent: isToday ? 0 : i.plan.urgent.filter((p) => !p.slow).length,
    },
    todo: { missingCost: i.missingCost, incomingToday: i.incomingToday },
  };
}

/**
 * Báo cáo nào hiện trên web: từ 8:00 là báo cáo hôm nay; trước 8:00 là báo cáo hôm qua.
 * `vnHour` là giờ hiện tại theo giờ Việt Nam.
 */
export function reportDateToShow(today: DateString, vnHour: number): DateString {
  return vnHour >= REPORT_HOUR_VN ? today : addDays(today, -1);
}

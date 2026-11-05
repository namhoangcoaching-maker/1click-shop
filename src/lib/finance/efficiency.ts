/**
 * "Hiệu quả kinh doanh" (khối Tổng quan) và hiệu quả theo nguồn đơn – chủ dự án chốt 05/11/2026. Thuần tính toán.
 *
 *  DOANH THU (đơn chốt, CHƯA trừ phí sàn) = Doanh thu Pancake + Phí sàn
 *    (Doanh thu Pancake đã trừ chiết khấu, hàng hoàn VÀ phí sàn; cộng lại phí sàn để thấy phí sàn là một khoản chi.)
 *  − Phí sàn − Phí vận chuyển ngoại sàn − Sản xuất − Lương − Quay chụp − Quảng cáo (gộp mọi kênh) − Chi phí khác
 *  = LỢI NHUẬN (bằng đúng "Lợi nhuận kinh doanh" ở trang Dòng tiền). Mỗi dòng có % so với Doanh thu.
 *
 *  Nguồn đơn: Doanh thu chưa trừ phí sàn, Phí sàn, Chi phí ads, ME/RE = ads ÷ doanh thu,
 *  Phí sàn + ads (% doanh thu). Quảng cáo Facebook gộp Facebook + Instagram: doanh thu vẫn tách 2 dòng,
 *  ô ads / ME/RE / % chi phí là MỘT ô chung tính trên doanh thu gộp.
 */
import type { DateString } from "@/lib/date-range";
import { adsChannel, isAdsCategory, sourcesForAdsChannel, type ExpenseLine } from "./month";

const fold = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi").trim();

/** Các loại chi phí hiện riêng (theo tên thẻ); còn lại gộp vào "Chi phí khác". */
const NAMED_COSTS = ["Sản xuất", "Lương", "Quay chụp"] as const;

export interface EfficiencyLine {
  label: string;
  amount: number;
  /** % so với Doanh thu (0–100); null khi Doanh thu = 0. */
  percent: number | null;
}

export interface Efficiency {
  revenue: number;
  costs: EfficiencyLine[];
  costTotal: number;
  profit: number;
  profitPercent: number | null;
}

export function buildEfficiency(i: {
  /** Doanh thu Pancake (đã trừ phí sàn). */
  pancakeRevenue: number;
  fee: number;
  partnerFee: number;
  /** Phiếu chi có thẻ trong tháng (gồm cả thẻ "Quảng cáo …"). */
  expenses: ExpenseLine[];
  /** Quảng cáo lấy tự động (API); null = chưa có. */
  autoAds?: number | null;
}): Efficiency {
  const revenue = i.pancakeRevenue + i.fee;
  const pct = (v: number) => (revenue ? (v / revenue) * 100 : null);
  const sum = (pred: (l: ExpenseLine) => boolean) => i.expenses.filter(pred).reduce((s, l) => s + l.amount, 0);
  const isNamed = (l: ExpenseLine, name: string) => fold(l.category) === fold(name);

  const ads = sum((l) => isAdsCategory(l.category)) + (i.autoAds ?? 0);
  const named = NAMED_COSTS.map((name) => ({ name, amount: sum((l) => isNamed(l, name)) }));
  const other = sum((l) => !isAdsCategory(l.category) && !NAMED_COSTS.some((n) => isNamed(l, n)));

  const raw: [string, number][] = [
    ["Phí sàn", i.fee],
    ["Phí vận chuyển", i.partnerFee],
    ...named.map((n): [string, number] => [n.name === "Lương" ? "Lương nhân sự" : n.name, n.amount]),
    ["Quảng cáo", ads],
    ["Chi phí khác", other],
  ];
  const costs = raw.map(([label, amount]) => ({ label, amount, percent: pct(amount) }));
  const costTotal = costs.reduce((s, c) => s + c.amount, 0);
  const profit = revenue - costTotal;
  return { revenue, costs, costTotal, profit, profitPercent: pct(profit) };
}

/** Một dòng nguồn đơn đầu vào (từ thống kê Pancake). */
export interface SourceInput {
  source: string;
  /** Doanh thu Pancake (đã trừ phí sàn) kỳ này / kỳ trước. */
  revenue: { value: number; previous: number | null };
  fee: { value: number; previous: number | null };
  profit: number;
  orders: number;
  /** Doanh số (để tính GTTB). */
  gross: number;
}

export interface SourceRowView {
  source: string;
  /** Doanh thu chưa trừ phí sàn. */
  revenue: number;
  previous: number | null;
  fee: number;
  profit: number;
  orders: number;
  gross: number;
}

/** Nhóm dòng dùng chung một ô quảng cáo (Facebook + Instagram), hoặc một dòng lẻ. */
export interface SourceGroupView {
  rows: SourceRowView[];
  /** Chi phí ads của cả nhóm. */
  ads: number;
  /** Doanh thu (chưa trừ phí sàn) cộng cả nhóm. */
  revenue: number;
  fee: number;
  /** ads ÷ doanh thu × 100; null khi chưa có ads hoặc doanh thu = 0. */
  meRe: number | null;
  /** (phí sàn + ads) ÷ doanh thu × 100; null khi doanh thu = 0. */
  costPercent: number | null;
}

/** Quảng cáo theo kênh trong [from, to] (thẻ "Quảng cáo …", theo ngày phát sinh). */
export function adsByChannel(expenses: ExpenseLine[], from: DateString, to: DateString): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of expenses) {
    if (!isAdsCategory(l.category) || l.date < from || l.date > to) continue;
    const ch = adsChannel(l.category) ?? "Khác";
    m.set(ch, (m.get(ch) ?? 0) + l.amount);
  }
  return m;
}

/**
 * Bảng nguồn đơn kèm hiệu quả quảng cáo. Nguồn cùng một kênh quảng cáo (Facebook + Instagram) đứng cạnh nhau,
 * chung một ô ads. Kênh có ads mà kỳ này chưa có đơn vẫn hiện (doanh thu 0) để thấy tiền đã chi.
 */
export function buildSourceGroups(sources: SourceInput[], ads: Map<string, number>): SourceGroupView[] {
  const view = (s: SourceInput): SourceRowView => ({
    source: s.source,
    revenue: s.revenue.value + s.fee.value,
    previous: s.revenue.previous === null ? null : s.revenue.previous + (s.fee.previous ?? 0),
    fee: s.fee.value,
    profit: s.profit,
    orders: s.orders,
    gross: s.gross,
  });
  const rows = new Map(sources.map((s) => [fold(s.source), view(s)]));
  const empty = (source: string): SourceRowView => ({ source, revenue: 0, previous: null, fee: 0, profit: 0, orders: 0, gross: 0 });

  const groups: { keys: string[]; rows: SourceRowView[]; ads: number }[] = [];
  const used = new Set<string>();
  // Mỗi kênh quảng cáo → nhóm các nguồn của nó (gộp các kênh chung nguồn, ví dụ "Facebook" và "fb").
  for (const [channel, amount] of ads) {
    const names = sourcesForAdsChannel(channel);
    const keys = names.map(fold);
    const existing = groups.find((g) => g.keys.some((k) => keys.includes(k)));
    if (existing) {
      existing.ads += amount;
      continue;
    }
    groups.push({ keys, rows: names.map((n) => rows.get(fold(n)) ?? empty(n)), ads: amount });
    keys.forEach((k) => used.add(k));
  }
  for (const [key, row] of rows) if (!used.has(key)) groups.push({ keys: [key], rows: [row], ads: 0 });

  return groups
    .map((g) => {
      // Trong nhóm: dòng có doanh thu lớn đứng trước; bỏ dòng trống nếu nhóm còn dòng khác có số.
      const sorted = [...g.rows].sort((a, b) => b.revenue - a.revenue);
      const kept = sorted.filter((r) => r.revenue !== 0 || r.orders !== 0 || (r.previous ?? 0) !== 0);
      // Nhóm có ads: hiện đủ các nguồn (kể cả 0) để thấy tiền ads chia cho những nguồn nào.
      const groupRows = g.ads > 0 ? sorted : kept.length > 0 ? kept : sorted.slice(0, 1);
      const revenue = groupRows.reduce((s, r) => s + r.revenue, 0);
      const fee = groupRows.reduce((s, r) => s + r.fee, 0);
      return {
        rows: groupRows,
        ads: g.ads,
        revenue,
        fee,
        meRe: g.ads > 0 && revenue > 0 ? (g.ads / revenue) * 100 : null,
        costPercent: revenue > 0 ? ((fee + g.ads) / revenue) * 100 : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.ads - a.ads);
}

/**
 * Lịch thuế, nhắc hạn, cảnh báo vượt ngưỡng (Giai đoạn 7.2, thuần, có unit test). Chủ dự án chốt 08/11/2026:
 *  - Nhắc trước 7 ngày và 1 ngày: việc có hạn trong 7 ngày tới (kể cả hôm nay) hiện nhắc; quá hạn hiện đỏ.
 *  - Doanh thu xét ngưỡng = Doanh thu Pancake + phí sàn (đã trừ chiết khấu, hàng hoàn; chưa trừ phí sàn).
 *  - Cảnh báo khi lũy kế năm ≥ 80% ngưỡng trên của quy định đang áp, HOẶC dự báo cả năm vượt ngưỡng
 *    (dự báo = lũy kế ÷ số ngày đã qua × số ngày của năm).
 */
import type { DateString } from "@/lib/date-range";
import { daysUntil, periodOf, pickRule, upcomingPeriods, type TaxRule, type TaxSettings } from "./rules";

export type EventKind = "vat_filing" | "annual_notice" | "invoice_adjust";

export interface TaxEvent {
  date: DateString;
  kind: EventKind;
  title: string;
  detail: string;
  daysLeft: number;
}

/** Nhắc: còn ≤ 7 ngày (kể cả hôm nay) hoặc đã quá hạn. */
export const REMIND_DAYS = 7;
export const isDueSoon = (e: Pick<TaxEvent, "daysLeft">) => e.daysLeft <= REMIND_DAYS;

/** "còn 7 ngày" / "còn 1 ngày" / "hôm nay" / "quá hạn 3 ngày". */
export function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `quá hạn ${-daysLeft} ngày`;
  if (daysLeft === 0) return "hạn hôm nay";
  return `còn ${daysLeft} ngày`;
}

/**
 * Lịch thuế: hạn nộp tờ khai các kỳ tới (kể cả kỳ vừa xong chưa tới hạn), thông báo doanh thu năm (nếu quy định
 * yêu cầu), hạn điều chỉnh hóa đơn gom theo kỳ (kể cả kỳ đã quá hạn). Sắp xếp theo ngày.
 */
export function taxCalendar(input: {
  today: DateString;
  rule: TaxRule | null;
  /** Hóa đơn cần điều chỉnh: hạn + nhãn kỳ (từ analyzeInvoices). */
  adjust: { deadline: DateString; periodLabel: string }[];
  periods?: number;
}): TaxEvent[] {
  const { today, rule, adjust } = input;
  const events: TaxEvent[] = [];
  if (rule && rule.vatPeriod !== "none") {
    for (const p of upcomingPeriods(today, rule.vatPeriod, input.periods ?? 3)) {
      events.push({
        date: p.deadline,
        kind: "vat_filing",
        title: `Nộp tờ khai thuế GTGT ${p.label}`,
        detail: `Kỳ ${p.label} (${p.start.slice(8)}/${p.start.slice(5, 7)} – ${p.end.slice(8)}/${p.end.slice(5, 7)}/${p.end.slice(0, 4)})`,
        daysLeft: daysUntil(today, p.deadline),
      });
    }
  }
  if (rule?.annualRevenueNotice) {
    const p = periodOf(today, "none");
    events.push({
      date: p.deadline,
      kind: "annual_notice",
      title: `Thông báo doanh thu năm ${today.slice(0, 4)}`,
      detail: "Hộ kinh doanh dưới ngưỡng: thông báo doanh thu năm cho cơ quan thuế.",
      daysLeft: daysUntil(today, p.deadline),
    });
  }
  const byDeadline = new Map<string, { deadline: DateString; periodLabel: string; n: number }>();
  for (const a of adjust) {
    const g = byDeadline.get(a.deadline) ?? { deadline: a.deadline, periodLabel: a.periodLabel, n: 0 };
    g.n++;
    byDeadline.set(a.deadline, g);
  }
  for (const g of byDeadline.values()) {
    events.push({
      date: g.deadline,
      kind: "invoice_adjust",
      title: `Điều chỉnh ${g.n.toLocaleString("vi-VN")} hóa đơn (${g.periodLabel})`,
      detail: "Hóa đơn của đơn đã hoàn / hủy / lệch tiền chưa được điều chỉnh – trước hạn nộp tờ khai của kỳ.",
      daysLeft: daysUntil(today, g.deadline),
    });
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Phần Thuế lưu trong báo cáo 8:00 (gọn, đủ để hiện ở Tổng quan và trang Báo cáo). */
export interface TaxReportPart {
  /** Việc thuế có hạn trong 7 ngày tới hoặc đã quá hạn. */
  due: { date: DateString; title: string; daysLeft: number }[];
  /** Hạn kế tiếp chưa tới (dù xa). */
  next: { date: DateString; title: string; daysLeft: number } | null;
  adjust: number;
  adjustOverdue: number;
  missing: number;
  /** % đã xuất hóa đơn tháng gần nhất. */
  rate: number | null;
  warning: { level: ThresholdWarning["level"]; pct: number; threshold: number; projected: number } | null;
}

export function taxReportPart(input: {
  events: TaxEvent[];
  adjust: { daysLeft: number }[];
  missing: number;
  rate: number | null;
  warning: ThresholdWarning | null;
}): TaxReportPart {
  const pick = (e: TaxEvent) => ({ date: e.date, title: e.title, daysLeft: e.daysLeft });
  const upcoming = input.events.find((e) => e.daysLeft >= 0);
  return {
    due: input.events.filter(isDueSoon).map(pick),
    next: upcoming ? pick(upcoming) : null,
    adjust: input.adjust.length,
    adjustOverdue: input.adjust.filter((a) => a.daysLeft < 0).length,
    missing: input.missing,
    rate: input.rate,
    warning: input.warning
      ? { level: input.warning.level, pct: input.warning.pct, threshold: input.warning.threshold, projected: input.warning.projected }
      : null,
  };
}

export const WARN_RATIO = 0.8;

export interface ThresholdWarning {
  /** Ngưỡng trên của quy định đang áp (đồng). */
  threshold: number;
  ytd: number;
  projected: number;
  /** % lũy kế so với ngưỡng (2 số lẻ). */
  pct: number;
  level: "exceeded" | "near" | "projected";
  /** Quy định sẽ áp nếu vượt (theo doanh thu dự báo). */
  nextRule: TaxRule | null;
}

/** Ngày thứ mấy trong năm (1 = 01/01) và số ngày của năm. */
function dayOfYear(d: DateString): { day: number; total: number } {
  const y = Number(d.slice(0, 4));
  const day = daysUntil(`${y}-01-01`, d) + 1;
  const total = daysUntil(`${y}-01-01`, `${y + 1}-01-01`);
  return { day, total };
}

/** Cảnh báo doanh thu năm nay sắp / đã vượt ngưỡng trên của quy định đang áp. null = không cần báo. */
export function thresholdWarning(input: { today: DateString; ytd: number; settings: TaxSettings; rules: TaxRule[]; rule: TaxRule | null }): ThresholdWarning | null {
  const { today, ytd, settings, rules, rule } = input;
  if (!rule || rule.revenueMax === null) return null;
  const { day, total } = dayOfYear(today);
  const projected = Math.round((ytd / day) * total);
  const threshold = rule.revenueMax;
  const level = ytd > threshold ? "exceeded" : ytd >= threshold * WARN_RATIO ? "near" : projected > threshold ? "projected" : null;
  if (!level) return null;
  return {
    threshold,
    ytd,
    projected,
    pct: Math.round((ytd / threshold) * 10000) / 100,
    level,
    nextRule: pickRule(rules, { ...settings, priorYearRevenue: Math.max(ytd, projected) }, today),
  };
}

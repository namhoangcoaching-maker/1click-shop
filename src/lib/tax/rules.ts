/**
 * Quy định thuế (Giai đoạn 7, thuần, có unit test). Bản thân quy định nằm trong bảng `tax_rules`
 * (có ngày hiệu lực) – code chỉ CHỌN dòng đúng và tính kỳ khai / hạn nộp:
 *  - Theo tháng: hạn ngày 20 tháng sau.
 *  - Theo quý: hạn ngày cuối cùng của tháng đầu quý sau.
 *  - Không khai định kỳ (hộ kinh doanh ≤ ngưỡng): thông báo doanh thu chậm nhất 31/1 năm sau.
 * Thông tin tham khảo – phải xác nhận với kế toán / cơ quan thuế.
 */
import { addDays, type DateString } from "@/lib/date-range";

export type BusinessType = "household" | "company";
export type VatPeriod = "none" | "month" | "quarter";

export const BUSINESS_LABELS: Record<BusinessType, string> = { household: "Hộ kinh doanh", company: "Công ty" };
export const PERIOD_LABELS: Record<VatPeriod, string> = { none: "Không khai định kỳ", month: "Theo tháng", quarter: "Theo quý" };
export const DISCLAIMER = "Thông tin tham khảo, vui lòng xác nhận với kế toán hoặc cơ quan thuế.";

export interface TaxRule {
  id: string;
  businessType: BusinessType;
  revenueMin: number;
  revenueMax: number | null;
  vatPeriod: VatPeriod;
  einvoiceRequired: boolean;
  annualRevenueNotice: boolean;
  summary: string;
  legalRef: string | null;
  effectiveFrom: DateString;
  effectiveTo: DateString | null;
}

export interface TaxSettings {
  businessType: BusinessType;
  priorYearRevenue: number;
}

/** Quy định áp cho loại hình + doanh thu (revenueMin < doanh thu ≤ revenueMax) tại ngày `on`. */
export function pickRule(rules: TaxRule[], s: TaxSettings, on: DateString): TaxRule | null {
  const live = rules.filter(
    (r) =>
      r.businessType === s.businessType &&
      r.effectiveFrom <= on &&
      (r.effectiveTo === null || on <= r.effectiveTo) &&
      (s.priorYearRevenue > r.revenueMin || (r.revenueMin === 0 && s.priorYearRevenue === 0)) &&
      (r.revenueMax === null || s.priorYearRevenue <= r.revenueMax),
  );
  // Nhiều dòng cùng hiệu lực: lấy dòng có hiệu lực mới nhất.
  return live.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

export interface TaxPeriod {
  /** "Tháng 11/2026", "Quý 4/2026", "Năm 2026". */
  label: string;
  start: DateString;
  end: DateString;
  /** Hạn nộp tờ khai / thông báo. */
  deadline: DateString;
}

/** Kỳ khai chứa ngày `date` và hạn nộp của kỳ đó. */
export function periodOf(date: DateString, period: VatPeriod): TaxPeriod {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  if (period === "month") {
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return { label: `Tháng ${pad(m)}/${y}`, start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, deadline: `${ny}-${pad(nm)}-20` };
  }
  if (period === "quarter") {
    const q = Math.ceil(m / 3);
    const first = (q - 1) * 3 + 1;
    const ny = q === 4 ? y + 1 : y;
    const nm = q === 4 ? 1 : first + 3; // tháng đầu quý sau
    return {
      label: `Quý ${q}/${y}`,
      start: `${y}-${pad(first)}-01`,
      end: `${y}-${pad(first + 2)}-${pad(lastDay(y, first + 2))}`,
      deadline: `${ny}-${pad(nm)}-${pad(lastDay(ny, nm))}`,
    };
  }
  return { label: `Năm ${y}`, start: `${y}-01-01`, end: `${y}-12-31`, deadline: `${y + 1}-01-31` };
}

/** Số ngày từ `from` tới `to` (âm nếu `to` đã qua). */
export function daysUntil(from: DateString, to: DateString): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Các kỳ khai sắp tới (kể cả kỳ đang chạy) – để làm lịch thuế. */
export function upcomingPeriods(today: DateString, period: VatPeriod, count = 3): TaxPeriod[] {
  const out: TaxPeriod[] = [];
  // Kỳ vừa kết thúc có thể chưa tới hạn nộp → bắt đầu từ kỳ trước.
  let p = periodOf(addDays(periodOf(today, period).start, -1), period);
  while (out.length < count) {
    if (p.deadline >= today) out.push(p);
    p = periodOf(addDays(p.end, 1), period);
  }
  return out;
}

export function ruleFromDb(r: Record<string, unknown>): TaxRule {
  return {
    id: r.id as string,
    businessType: r.business_type as BusinessType,
    revenueMin: Number(r.revenue_min),
    revenueMax: r.revenue_max === null || r.revenue_max === undefined ? null : Number(r.revenue_max),
    vatPeriod: r.vat_period as VatPeriod,
    einvoiceRequired: !!r.einvoice_required,
    annualRevenueNotice: !!r.annual_revenue_notice,
    summary: r.summary as string,
    legalRef: (r.legal_ref as string | null) ?? null,
    effectiveFrom: r.effective_from as string,
    effectiveTo: (r.effective_to as string | null) ?? null,
  };
}

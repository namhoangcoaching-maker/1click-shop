/**
 * Lương dự kiến (Giai đoạn 6.4, thuần, có unit test). Chủ dự án chốt 05/11/2026:
 *  • Lương tháng theo ngày công = lương ÷ ngày công chuẩn × số công; làm VƯỢT chuẩn thì trả thêm theo công.
 *  • Lương theo ngày = đơn giá × số công; theo giờ = đơn giá × số giờ làm trong ca.
 *  • Phụ cấp theo tỷ lệ công: phụ cấp × min(1, công ÷ ngày công chuẩn).
 *  • Phạt đi muộn = số lần muộn × tiền phạt mỗi lần.
 *  • Chỉ để XEM: Lợi nhuận / Dòng tiền vẫn trừ theo phiếu chi thẻ Lương (tiền thật đã trả), không trừ trùng.
 */
import type { PersonMonth } from "./attendance";
import { shiftHours, type StaffSettings } from "./settings";

export interface Pay {
  /** Lương cứng theo công / giờ. */
  base: number;
  allowance: number;
  latePenalty: number;
  /** = base + allowance − latePenalty (không âm). */
  total: number;
  units: number;
  hours: number;
  lateCount: number;
}

type PaySettings = Pick<StaffSettings, "payType" | "baseSalary" | "standardDays" | "allowance" | "latePenalty">;

/** Lương cho một số công / giờ / lần muộn cho trước. */
export function payFor(s: PaySettings, units: number, workedMin: number, lateCount: number): Pay {
  const hours = workedMin / 60;
  const base = Math.round(
    s.payType === "monthly" ? (s.baseSalary / s.standardDays) * units : s.payType === "daily" ? s.baseSalary * units : s.baseSalary * hours,
  );
  const allowance = Math.round(s.allowance * Math.min(1, units / s.standardDays));
  const latePenalty = lateCount * s.latePenalty;
  return { base, allowance, latePenalty, total: Math.max(0, base + allowance - latePenalty), units, hours, lateCount };
}

export interface PayEstimate {
  /** Tới hôm nay, theo công đã chấm. */
  sofar: Pay;
  /** Ước cả tháng: các ngày làm còn lại (kể cả hôm nay chưa xong) tính đủ ca. */
  month: Pay;
}

/** Lương dự kiến từ bảng công tháng của một người. */
export function estimatePay(s: StaffSettings, pm: PersonMonth): PayEstimate {
  const sofar = payFor(s, pm.summary.units, pm.summary.workedMin, pm.summary.lateCount);
  // Ngày còn lại sẽ làm: ngày làm chưa tới + hôm nay chưa vào / đang làm → tính đủ 1 công, đủ giờ ca.
  const remaining = pm.days.filter((d) => d.status === "pending" || d.status === "working" || (d.status === "future" && isWorkDay(s, d.date))).length;
  const fullShiftMin = Math.round(shiftHours(s) * 60);
  const month = payFor(s, pm.summary.units + remaining, pm.summary.workedMin + remaining * fullShiftMin, pm.summary.lateCount);
  return { sofar, month };
}

function isWorkDay(s: Pick<StaffSettings, "workDays">, date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return s.workDays.includes(d === 0 ? 7 : d);
}

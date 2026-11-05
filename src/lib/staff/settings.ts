/**
 * Cấu hình nhân sự từng người (Giai đoạn 6.2, thuần, có unit test): chấm công, ca làm, lương cứng.
 * Giới hạn khớp ràng buộc database (migration 0014).
 */
import type { Checked } from "./validate";

export type AttendanceMode = "online" | "gps";
export type PayType = "monthly" | "daily" | "hourly";

export interface StaffSettings {
  attendanceMode: AttendanceMode;
  /** Địa điểm GPS (khi attendanceMode = "gps"). */
  locationId: string | null;
  /** 1 = Thứ 2 … 7 = Chủ nhật. */
  workDays: number[];
  shiftStart: string; // "HH:MM"
  shiftEnd: string;
  lateGraceMin: number;
  payType: PayType;
  /** monthly: lương tháng; daily: đơn giá/ngày; hourly: đơn giá/giờ (đồng). */
  baseSalary: number;
  /** Ngày công chuẩn của tháng (dùng cho monthly). */
  standardDays: number;
  /** Phụ cấp cố định mỗi tháng (đồng). */
  allowance: number;
  /** Phạt mỗi lần đi muộn quá số phút cho phép (đồng). */
  latePenalty: number;
}

export const DEFAULT_SETTINGS: StaffSettings = {
  attendanceMode: "gps",
  locationId: null,
  workDays: [1, 2, 3, 4, 5, 6],
  shiftStart: "08:00",
  shiftEnd: "17:30",
  lateGraceMin: 10,
  payType: "monthly",
  baseSalary: 0,
  standardDays: 26,
  allowance: 0,
  latePenalty: 0,
};

export const ATTENDANCE_LABELS: Record<AttendanceMode, string> = {
  online: "Online tại nhà (không kiểm tra vị trí)",
  gps: "GPS tại shop (phải ở gần địa điểm)",
};
export const PAY_LABELS: Record<PayType, string> = {
  monthly: "Lương tháng theo ngày công",
  daily: "Lương theo ngày",
  hourly: "Lương theo giờ",
};
export const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** "7.000.000" / "7 000 000" / "7000000" → 7000000; trống → 0; sai → null. */
export function parseMoney(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.replace(/[.\s,₫đ]/g, "") : "";
  if (s === "") return 0;
  return /^\d{1,11}$/.test(s) ? Number(s) : null;
}

/** Đọc và kiểm tra form cấu hình. */
export function checkSettings(form: FormData): Checked<StaffSettings> {
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");
  const attendanceMode = str("attendanceMode") as AttendanceMode;
  if (!(attendanceMode in ATTENDANCE_LABELS)) return { ok: false, message: "Chọn hình thức chấm công." };
  const locationId = str("locationId") || null;
  if (attendanceMode === "gps" && !locationId) return { ok: false, message: "Chấm công GPS: chọn địa điểm (thêm địa điểm ở trang Cấu hình nhân sự)." };

  const workDays = [...new Set(form.getAll("workDays").map(Number))].filter((d) => d >= 1 && d <= 7).sort();
  if (workDays.length === 0) return { ok: false, message: "Chọn ít nhất một ngày làm trong tuần." };

  const shiftStart = str("shiftStart");
  const shiftEnd = str("shiftEnd");
  if (!TIME.test(shiftStart) || !TIME.test(shiftEnd)) return { ok: false, message: "Giờ ca dạng HH:MM, ví dụ 08:00." };
  if (minutes(shiftEnd) <= minutes(shiftStart)) return { ok: false, message: "Giờ ra ca phải sau giờ vào ca." };

  const lateGraceMin = Number(str("lateGraceMin") || "0");
  if (!Number.isInteger(lateGraceMin) || lateGraceMin < 0 || lateGraceMin > 240) {
    return { ok: false, message: "Số phút cho phép trễ từ 0 đến 240." };
  }

  const payType = str("payType") as PayType;
  if (!(payType in PAY_LABELS)) return { ok: false, message: "Chọn cách tính lương." };
  const baseSalary = parseMoney(form.get("baseSalary"));
  const allowance = parseMoney(form.get("allowance"));
  const latePenalty = parseMoney(form.get("latePenalty"));
  if (baseSalary === null || allowance === null || latePenalty === null) {
    return { ok: false, message: "Số tiền chỉ gồm chữ số, ví dụ 7.000.000." };
  }
  if (allowance > 1_000_000_000 || latePenalty > 100_000_000) return { ok: false, message: "Số tiền quá lớn." };
  const standardDays = Number((str("standardDays") || "26").replace(",", "."));
  if (!(standardDays >= 1 && standardDays <= 31)) return { ok: false, message: "Ngày công chuẩn từ 1 đến 31." };

  return {
    ok: true,
    value: {
      attendanceMode,
      locationId: attendanceMode === "gps" ? locationId : null,
      workDays,
      shiftStart,
      shiftEnd,
      lateGraceMin,
      payType,
      baseSalary,
      standardDays: Math.round(standardDays * 10) / 10,
      allowance,
      latePenalty,
    },
  };
}

/** Số giờ một ca (để quy đổi lương giờ ↔ ngày). */
export function shiftHours(s: Pick<StaffSettings, "shiftStart" | "shiftEnd">): number {
  return (minutes(s.shiftEnd) - minutes(s.shiftStart)) / 60;
}

/** Tiền lương cứng cho MỘT ngày công đủ (để hiện "≈ … đ/ngày"). */
export function dailyRate(s: StaffSettings): number {
  if (s.payType === "monthly") return Math.round(s.baseSalary / s.standardDays);
  if (s.payType === "daily") return s.baseSalary;
  return Math.round(s.baseSalary * shiftHours(s));
}

/** "T2–T7 · 08:00–17:30" ; ngày rời rạc: "T2, T4, T6 · …". */
export function describeShift(s: Pick<StaffSettings, "workDays" | "shiftStart" | "shiftEnd">): string {
  const d = [...s.workDays].sort();
  const consecutive = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const days =
    d.length === 7 ? "Cả tuần" : consecutive && d.length > 2 ? `${DAY_LABELS[d[0] - 1]}–${DAY_LABELS[d.at(-1)! - 1]}` : d.map((x) => DAY_LABELS[x - 1]).join(", ");
  return `${days} · ${s.shiftStart}–${s.shiftEnd}`;
}

/** Hàng database → cấu hình (thiếu hàng thì dùng mặc định). */
export function fromRow(r: Record<string, unknown> | null | undefined): StaffSettings {
  if (!r) return { ...DEFAULT_SETTINGS };
  return {
    attendanceMode: r.attendance_mode as AttendanceMode,
    locationId: (r.location_id as string | null) ?? null,
    workDays: (r.work_days as number[]) ?? DEFAULT_SETTINGS.workDays,
    shiftStart: r.shift_start as string,
    shiftEnd: r.shift_end as string,
    lateGraceMin: Number(r.late_grace_min),
    payType: r.pay_type as PayType,
    baseSalary: Number(r.base_salary),
    standardDays: Number(r.standard_days),
    allowance: Number(r.allowance),
    latePenalty: Number(r.late_penalty),
  };
}

/** Cấu hình → cột database. */
export function toRow(s: StaffSettings) {
  return {
    attendance_mode: s.attendanceMode,
    location_id: s.locationId,
    work_days: s.workDays,
    shift_start: s.shiftStart,
    shift_end: s.shiftEnd,
    late_grace_min: s.lateGraceMin,
    pay_type: s.payType,
    base_salary: s.baseSalary,
    standard_days: s.standardDays,
    allowance: s.allowance,
    late_penalty: s.latePenalty,
  };
}

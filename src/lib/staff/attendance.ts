/**
 * Chấm công (Giai đoạn 6.3, thuần, có unit test). Chủ dự án chốt 05/11/2026:
 *  • Công một ngày = số phút làm NẰM TRONG ca ÷ độ dài ca, tối đa 1, làm tròn 2 số lẻ
 *    (đến sớm / về muộn hơn ca không tính thêm – làm thêm giờ để sau).
 *  • Đi muộn = vào ca sau giờ vào ca + số phút cho phép; số phút muộn tính từ giờ vào ca.
 *  • Quên Ra ca: ngày đó CHƯA có công, chờ Chủ / Quản lý điền giờ ra.
 * Giờ Việt Nam = UTC+7 cố định (không đổi giờ mùa hè).
 */
import { addDays, type DateString } from "@/lib/date-range";

const VN_OFFSET_MIN = 7 * 60;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Ngày (giờ VN) của một thời điểm ISO. */
export function vnDateOf(iso: string): DateString {
  return new Date(Date.parse(iso) + VN_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Phút trong ngày (giờ VN) của một thời điểm ISO, 0…1439. */
export function vnMinuteOf(iso: string): number {
  const d = new Date(Date.parse(iso) + VN_OFFSET_MIN * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "HH:MM" giờ VN của một thời điểm ISO. */
export const vnTimeOf = (iso: string) => fromMinutes(vnMinuteOf(iso));

/** Ngày + "HH:MM" giờ VN → thời điểm ISO (UTC). Giờ sai → null. */
export function vnToIso(date: DateString, hhmm: string): string | null {
  if (!TIME.test(hhmm) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T${hhmm}:00Z`) - VN_OFFSET_MIN * 60_000;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Thứ trong tuần theo cấu hình ca: 1 = Thứ 2 … 7 = Chủ nhật. */
export function weekday(date: DateString): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Khoảng cách (mét) giữa 2 tọa độ (công thức haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Position {
  lat: number;
  lng: number;
  /** Độ chính xác điện thoại báo (mét). */
  accuracy: number;
}

/** Tọa độ trình duyệt gửi lên có hợp lệ không. */
export function validPosition(p: Partial<Position>): p is Position {
  return (
    typeof p.lat === "number" && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 &&
    typeof p.accuracy === "number" && Number.isFinite(p.accuracy) && p.accuracy >= 0
  );
}

export type PositionCheck =
  | { ok: true; distance: number }
  | { ok: false; distance: number; message: string };

/** Chấm GPS: phải ở trong bán kính địa điểm (tính theo tọa độ điện thoại báo, không cộng thêm sai số). */
export function checkPosition(loc: { name: string; lat: number; lng: number; radiusM: number }, pos: Position): PositionCheck {
  const distance = Math.round(distanceM(loc.lat, loc.lng, pos.lat, pos.lng));
  if (distance <= loc.radiusM) return { ok: true, distance };
  const far = distance >= 1000 ? `${(distance / 1000).toFixed(1).replace(".", ",")} km` : `${distance} m`;
  const hint =
    pos.accuracy > loc.radiusM
      ? ` Vị trí điện thoại đang kém chính xác (±${Math.round(pos.accuracy)} m): bật "Vị trí chính xác", ra gần cửa sổ rồi thử lại.`
      : "";
  return {
    ok: false,
    distance,
    message: `Bạn đang cách ${loc.name} khoảng ${far} (cho phép ${loc.radiusM} m).${hint}`,
  };
}

/** Một dòng chấm công (đã đổi tên cột). */
export interface AttendanceRow {
  userId: string;
  workDate: DateString;
  checkInAt: string | null;
  checkOutAt: string | null;
  mode: "online" | "gps" | "manual";
  shiftStart: string;
  shiftEnd: string;
  lateGraceMin: number;
  editNote: string | null;
  editedAt: string | null;
}

export type DayStatus =
  | "done" // đủ vào + ra
  | "working" // hôm nay đã vào, chưa ra
  | "missing_out" // ngày đã qua, quên ra ca
  | "absent" // ngày làm đã qua, không chấm
  | "pending" // hôm nay có ca, chưa vào
  | "off" // không phải ngày làm, không chấm
  | "future";

export interface DayResult {
  date: DateString;
  status: DayStatus;
  /** Công của ngày (0…1). */
  units: number;
  /** Số phút làm trong ca. */
  workedMin: number;
  /** Số phút muộn tính từ giờ vào ca (0 nếu không muộn). */
  lateMin: number;
  /** Muộn quá số phút cho phép. */
  late: boolean;
  row: AttendanceRow | null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Kết quả một ngày có dòng chấm công. */
export function dayFromRow(row: AttendanceRow, today: DateString): DayResult {
  const start = toMinutes(row.shiftStart);
  const end = toMinutes(row.shiftEnd);
  const base = { date: row.workDate, row };
  if (!row.checkInAt) {
    // Dòng sửa tay xóa giờ vào: coi như không chấm.
    return { ...base, status: row.workDate < today ? "absent" : "pending", units: 0, workedMin: 0, lateMin: 0, late: false };
  }
  // Giờ tính theo phút trong ngày VN; giờ vào thuộc ngày khác (sửa tay lệch) vẫn tính theo giờ trong ngày.
  const inMin = vnMinuteOf(row.checkInAt);
  const lateMin = Math.max(0, inMin - start);
  const late = lateMin > row.lateGraceMin;
  if (!row.checkOutAt) {
    return { ...base, status: row.workDate < today ? "missing_out" : "working", units: 0, workedMin: 0, lateMin, late };
  }
  const sameDay = vnDateOf(row.checkOutAt) === vnDateOf(row.checkInAt);
  const outMin = sameDay ? vnMinuteOf(row.checkOutAt) : 24 * 60;
  const workedMin = Math.max(0, Math.min(outMin, end) - Math.max(inMin, start));
  return { ...base, status: "done", units: Math.min(1, round2(workedMin / (end - start))), workedMin, lateMin, late };
}

/** Kết quả một ngày không có dòng chấm công, theo ca cố định của người đó. */
export function dayWithoutRow(date: DateString, workDays: number[], today: DateString): DayResult {
  const empty = { date, units: 0, workedMin: 0, lateMin: 0, late: false, row: null };
  if (date > today) return { ...empty, status: "future" };
  if (!workDays.includes(weekday(date))) return { ...empty, status: "off" };
  return { ...empty, status: date === today ? "pending" : "absent" };
}

export interface MonthSummary {
  /** Tổng công (cộng công từng ngày). */
  units: number;
  workedMin: number;
  lateCount: number;
  missingOut: number;
  absent: number;
}

export interface PersonMonth {
  days: DayResult[];
  summary: MonthSummary;
}

/** Bảng công một người trong khoảng ngày [from, to]. */
export function personMonth(rows: AttendanceRow[], workDays: number[], from: DateString, to: DateString, today: DateString): PersonMonth {
  const byDate = new Map(rows.map((r) => [r.workDate, r]));
  const days: DayResult[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d);
    days.push(r ? dayFromRow(r, today) : dayWithoutRow(d, workDays, today));
  }
  const summary: MonthSummary = { units: 0, workedMin: 0, lateCount: 0, missingOut: 0, absent: 0 };
  for (const d of days) {
    summary.units += d.units;
    summary.workedMin += d.workedMin;
    if (d.late) summary.lateCount++;
    if (d.status === "missing_out") summary.missingOut++;
    if (d.status === "absent") summary.absent++;
  }
  summary.units = round2(summary.units);
  return { days, summary };
}

/** Tháng chứa ngày `date` còn sửa được không (khớp attendance_day_open trong database). */
export function monthEditable(date: DateString, today: DateString, unlocked: boolean): boolean {
  if (date > today) return false;
  const [y, m] = date.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return unlocked || today <= `${next}-05`;
}

/** "7,5 giờ" / "45 phút". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${String(h).replace(".", ",")} giờ`;
}

/** Công dạng "1" / "0,75". */
export const formatUnits = (u: number) => String(round2(u)).replace(".", ",");

/** Hàng database → AttendanceRow. */
export function rowFromDb(r: Record<string, unknown>): AttendanceRow {
  return {
    userId: r.user_id as string,
    workDate: r.work_date as string,
    checkInAt: (r.check_in_at as string | null) ?? null,
    checkOutAt: (r.check_out_at as string | null) ?? null,
    mode: r.attendance_mode as AttendanceRow["mode"],
    shiftStart: r.shift_start as string,
    shiftEnd: r.shift_end as string,
    lateGraceMin: Number(r.late_grace_min),
    editNote: (r.edit_note as string | null) ?? null,
    editedAt: (r.edited_at as string | null) ?? null,
  };
}

export const ATTENDANCE_COLUMNS =
  "user_id, work_date, check_in_at, check_out_at, attendance_mode, shift_start, shift_end, late_grace_min, edit_note, edited_at";

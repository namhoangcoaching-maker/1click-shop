/**
 * Bộ lọc thời gian kiểu Pancake: "Hôm nay", "So sánh với: Trước đó 1 ngày".
 *
 * Ngày được biểu diễn bằng chuỗi "YYYY-MM-DD" theo giờ Việt Nam
 * (Asia/Ho_Chi_Minh), để không bị lệch ngày do múi giờ của server.
 * Khoảng ngày luôn tính cả ngày đầu và ngày cuối.
 */

export const TIMEZONE = "Asia/Ho_Chi_Minh";

export type DateString = string; // "YYYY-MM-DD"

export interface DateRange {
  from: DateString;
  to: DateString;
}

export const RANGE_PRESETS = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  last7: "7 ngày qua",
  last30: "30 ngày qua",
  thisMonth: "Tháng này",
  lastMonth: "Tháng trước",
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

export const COMPARE_MODES = {
  previous: "Kỳ liền trước",
  previousMonth: "Cùng kỳ tháng trước",
  none: "Không so sánh",
} as const;

export type CompareMode = keyof typeof COMPARE_MODES;

export const DEFAULT_PRESET: RangePreset = "today";
export const DEFAULT_COMPARE: CompareMode = "previous";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày hôm nay theo giờ Việt Nam, dạng "YYYY-MM-DD". */
export function todayInVN(now: Date = new Date()): DateString {
  return dateFormat.format(now);
}

function parse(date: DateString): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toDateString(date: Date): DateString {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: DateString, days: number): DateString {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Lùi n tháng, giữ ngày; nếu tháng đích ngắn hơn thì lấy ngày cuối tháng (31/3 → 28/2). */
export function addMonths(date: DateString, months: number): DateString {
  const d = parse(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const day = Math.min(
    d.getUTCDate(),
    daysInMonth(target.getUTCFullYear(), target.getUTCMonth()),
  );
  target.setUTCDate(day);
  return toDateString(target);
}

function startOfMonth(date: DateString): DateString {
  return `${date.slice(0, 8)}01`;
}

/** Số ngày trong khoảng, tính cả hai đầu. */
export function rangeLength(range: DateRange): number {
  return Math.round((parse(range.to).getTime() - parse(range.from).getTime()) / 86_400_000) + 1;
}

/** Liệt kê từng ngày trong khoảng (dùng làm trục ngang của biểu đồ). */
export function listDays(range: DateRange): DateString[] {
  return Array.from({ length: rangeLength(range) }, (_, i) => addDays(range.from, i));
}

/** Số ngày từ hôm nay đến hạn: 0 là hôm nay, số âm là đã quá hạn. */
export function daysUntil(date: DateString, today: DateString): number {
  return Math.round((parse(date).getTime() - parse(today).getTime()) / 86_400_000);
}

export function presetRange(preset: RangePreset, today: DateString): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "thisMonth":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const lastDayPrevMonth = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(lastDayPrevMonth), to: lastDayPrevMonth };
    }
  }
}

export function compareRange(range: DateRange, mode: CompareMode): DateRange | null {
  switch (mode) {
    case "previous": {
      const length = rangeLength(range);
      return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
    }
    case "previousMonth":
      return { from: addMonths(range.from, -1), to: addMonths(range.to, -1) };
    case "none":
      return null;
  }
}

/** Nhãn so sánh giống Pancake: "Trước đó 1 ngày", "Trước đó 7 ngày". */
export function compareLabel(range: DateRange, mode: CompareMode): string {
  if (mode === "previous") return `Trước đó ${rangeLength(range)} ngày`;
  return COMPARE_MODES[mode];
}

/** "2026-11-01" → "01/11/2026" */
export function formatDateVN(date: DateString): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Một ngày: "01/11/2026"; nhiều ngày: "26/10/2026 – 01/11/2026". */
export function formatRangeVN(range: DateRange): string {
  if (range.from === range.to) return formatDateVN(range.from);
  return `${formatDateVN(range.from)} – ${formatDateVN(range.to)}`;
}

function isPreset(value: unknown): value is RangePreset {
  return typeof value === "string" && Object.hasOwn(RANGE_PRESETS, value);
}

function isCompareMode(value: unknown): value is CompareMode {
  return typeof value === "string" && Object.hasOwn(COMPARE_MODES, value);
}

export interface ResolvedFilter {
  preset: RangePreset;
  compare: CompareMode;
  range: DateRange;
  previousRange: DateRange | null;
  compareLabel: string;
}

/**
 * Đọc bộ lọc từ thanh địa chỉ (?range=last7&compare=previous).
 * Giá trị không hợp lệ thì dùng mặc định: Hôm nay, so với kỳ liền trước.
 */
export function resolveFilter(
  params: { range?: string | string[]; compare?: string | string[] },
  today: DateString = todayInVN(),
): ResolvedFilter {
  const preset = isPreset(params.range) ? params.range : DEFAULT_PRESET;
  const compare = isCompareMode(params.compare) ? params.compare : DEFAULT_COMPARE;
  const range = presetRange(preset, today);
  return {
    preset,
    compare,
    range,
    previousRange: compareRange(range, compare),
    compareLabel: compareLabel(range, compare),
  };
}

const dateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Mốc thời gian (từ database, giờ quốc tế) → giờ Việt Nam "04/11/2026 19:44". */
export function formatDateTimeVN(value: string | Date): string {
  const p = Object.fromEntries(
    dateTimeParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

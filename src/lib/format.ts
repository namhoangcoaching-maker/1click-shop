/**
 * Định dạng số, tiền và phần trăm theo kiểu Việt Nam, giống Pancake POS.
 * Dấu chấm ngăn hàng nghìn, dấu phẩy thập phân: 1.250.000 ₫, 42,37%.
 */

const integerFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const percentFormats = new Map<number, Intl.NumberFormat>();

function percentFormat(fractionDigits: number): Intl.NumberFormat {
  let format = percentFormats.get(fractionDigits);
  if (!format) {
    format = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
    percentFormats.set(fractionDigits, format);
  }
  return format;
}

const compactFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
});

/** Tránh hiển thị "-0" khi làm tròn số âm rất nhỏ. */
function roundSafe(value: number): number {
  return Math.round(value) || 0;
}

/** 1250000 → "1.250.000 ₫" (tiền VND không có phần lẻ). */
export function formatVND(amount: number): string {
  return `${integerFormat.format(roundSafe(amount))} ₫`;
}

/** 1250 → "1.250" */
export function formatNumber(value: number): string {
  return integerFormat.format(roundSafe(value));
}

const decimalFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** 8.5714 → "8,6" (số ngày, tốc độ bán…). */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

/** Kiểu hiển thị của một chỉ số: tiền hoặc số lượng. */
export type ValueFormat = "vnd" | "number";

export function formatValue(value: number, format: ValueFormat): string {
  return format === "vnd" ? formatVND(value) : formatNumber(value);
}

/** 42.3712 → "42,37%" (mặc định 2 số lẻ như Pancake). */
export function formatPercent(value: number, fractionDigits = 2): string {
  return `${percentFormat(fractionDigits).format(value)}%`;
}

/** Số gọn cho trục biểu đồ: 35000000 → "35 tr", 1200000000 → "1,2 tỷ", 350000 → "350 k". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${compactFormat.format(value / 1e9)} tỷ`;
  if (abs >= 1e6) return `${compactFormat.format(value / 1e6)} tr`;
  if (abs >= 1e3) return `${compactFormat.format(value / 1e3)} k`;
  return formatNumber(value);
}

/**
 * Phần trăm thay đổi so với kỳ trước.
 * Trả về null khi kỳ trước bằng 0 (không chia được), giao diện sẽ hiện "—".
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Tỷ lệ phần trăm a/b, trả về 0 khi b = 0. */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

/** Tốc độ bán mỗi ngày: rất chậm (dưới 0,1) hiện "<0,1" thay vì làm tròn thành 0. */
export function formatVelocity(perDay: number): string {
  if (perDay <= 0) return "0";
  if (perDay < 0.1) return "<0,1";
  return formatDecimal(perDay);
}

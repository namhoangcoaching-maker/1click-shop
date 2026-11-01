/**
 * Định dạng số, tiền và phần trăm theo kiểu Việt Nam.
 * Dấu chấm ngăn hàng nghìn, dấu phẩy thập phân: 1.250.000 đ, 12,5%.
 */

const integerFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const percentFormat = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Tránh hiển thị "-0" khi làm tròn số âm rất nhỏ. */
function roundSafe(value: number): number {
  return Math.round(value) || 0;
}

/** 1250000 → "1.250.000 đ" (tiền VND không có phần lẻ). */
export function formatVND(amount: number): string {
  return `${integerFormat.format(roundSafe(amount))} đ`;
}

/** 1250 → "1.250" */
export function formatNumber(value: number): string {
  return integerFormat.format(roundSafe(value));
}

/** 12.345 → "12,3%" */
export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`;
}

/**
 * Phần trăm thay đổi so với kỳ trước.
 * Trả về null khi kỳ trước bằng 0 (không chia được), giao diện sẽ hiện "—".
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

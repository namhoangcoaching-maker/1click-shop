/**
 * Đọc thời gian sản xuất/nhập hàng từ ô "Ghi chú nội bộ" của sản phẩm trên Pancake.
 *
 * Quy ước ghi: "SX: 8" (8 là số ngày). Cũng hiểu "SX 8 ngày", "Sản xuất: 8 ngày", "san xuat 8",
 * không phân biệt hoa thường; hoặc ghi chú chỉ có đúng một con số ("8").
 * Không lấy bừa con số bất kỳ trong ghi chú, để tránh nhầm với "bảo hành 12 tháng"…
 */

/** Dùng khi sản phẩm chưa ghi thời gian sản xuất. */
export const DEFAULT_LEAD_TIME_DAYS = 7;

/** Giới hạn hợp lý để bắt lỗi gõ nhầm (ví dụ "SX: 800"). */
const MAX_LEAD_TIME_DAYS = 365;

// Giữa "SX" và số phải có dấu ":", "=", "-" hoặc khoảng trắng, để mã sản phẩm như "SX098" không bị hiểu nhầm.
const LEAD_TIME_PATTERN =
  /(?:^|[^\p{L}\p{N}])(?:sx|s[ảa]n\s*xu[ấa]t)(?:\s*[:=\-]\s*|\s+)(\d{1,4})(?!\d)/iu;
const NUMBER_ONLY_PATTERN = /^\s*(\d{1,4})\s*(?:ngày|ngay)?\s*$/iu;

/** Trả về số ngày, hoặc null nếu ghi chú không có thời gian sản xuất hợp lệ. */
export function parseLeadTime(note: string | null | undefined): number | null {
  if (!note) return null;
  const match = note.normalize("NFC").match(LEAD_TIME_PATTERN) ?? note.match(NUMBER_ONLY_PATTERN);
  if (!match) return null;
  const days = Number(match[1]);
  return days > 0 && days <= MAX_LEAD_TIME_DAYS ? days : null;
}

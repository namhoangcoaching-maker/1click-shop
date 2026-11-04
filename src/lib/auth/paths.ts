export const LOGIN_PATH = "/dang-nhap";

/**
 * Các đường dẫn mở được khi chưa đăng nhập.
 * /api/cron: lịch tự động gọi vào, tự kiểm tra mật khẩu CRON_SECRET (không dùng phiên đăng nhập).
 */
const PUBLIC_PATHS = [LOGIN_PATH, "/api/cron"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Trang quay lại sau khi đăng nhập (tham số ?next=).
 * Chỉ chấp nhận đường dẫn nội bộ, chặn kiểu "//trang-la.com" hay "https://..."
 * để kẻ xấu không lợi dụng trang đăng nhập dẫn người dùng sang web khác.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (isPublicPath(next.split("?")[0])) return "/";
  return next;
}

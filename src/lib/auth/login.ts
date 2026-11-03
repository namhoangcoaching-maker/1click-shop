export interface LoginInput {
  email: string;
  password: string;
}

export type LoginCheck = { ok: true; value: LoginInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kiểm tra ô nhập trước khi gửi lên Supabase. */
export function checkLoginInput(email: unknown, password: unknown): LoginCheck {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const p = typeof password === "string" ? password : "";
  if (!e) return { ok: false, error: "Vui lòng nhập email." };
  if (!EMAIL_RE.test(e)) return { ok: false, error: "Email chưa đúng dạng, ví dụ: ten@gmail.com." };
  if (!p) return { ok: false, error: "Vui lòng nhập mật khẩu." };
  return { ok: true, value: { email: e, password: p } };
}

/** Đổi mã lỗi của Supabase sang câu tiếng Việt dễ hiểu. */
export function loginErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Email này chưa được xác nhận. Hãy mở hộp thư và bấm link xác nhận.";
    case "user_banned":
      return "Tài khoản này đang bị khóa. Liên hệ quản trị 1Click.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Bạn thử quá nhiều lần. Đợi vài phút rồi thử lại.";
    default:
      return "Chưa đăng nhập được. Kiểm tra mạng rồi thử lại.";
  }
}

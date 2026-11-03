/**
 * Đọc địa chỉ và khóa công khai của Supabase từ .env.local.
 * Thiếu thì báo lỗi tiếng Việt rõ ràng thay vì lỗi khó hiểu của thư viện.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trong .env.local (xem HUONG_DAN.md).",
    );
  }
  return { url, key };
}

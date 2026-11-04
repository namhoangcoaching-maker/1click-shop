import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Kết nối Supabase bằng KHÓA SECRET: bỏ qua RLS, đọc/ghi mọi shop.
 * Chỉ dùng cho việc nền của máy chủ (đồng bộ Pancake, giải mã khóa). TUYỆT ĐỐI không dùng để
 * trả dữ liệu cho người dùng: dữ liệu hiển thị phải đọc bằng createClient() trong server.ts (có RLS).
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Thiếu SUPABASE_SECRET_KEY trong biến môi trường.");
  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

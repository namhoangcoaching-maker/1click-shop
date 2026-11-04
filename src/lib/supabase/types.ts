import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Một kết nối Supabase bất kỳ: theo phiên người dùng (có RLS, dùng cho trang web)
 * hoặc khóa secret (việc nền như báo cáo 8:00 – người gọi phải tự bảo đảm đúng shop).
 */
export type AnySupabase = SupabaseClient;

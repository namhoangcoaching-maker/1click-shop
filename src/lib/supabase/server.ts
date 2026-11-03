import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Kết nối Supabase phía máy chủ, dùng phiên đăng nhập lưu trong cookie.
 * Dùng trong Server Component, Server Action, Route Handler.
 */
export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component không được ghi cookie; proxy.ts đã lo làm mới phiên.
        }
      },
    },
  });
}

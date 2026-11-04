import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "./roles";

export interface CurrentOrg {
  id: string;
  name: string;
  logoUrl: string | null;
  role: OrgRole;
}

/**
 * Shop của người đang đăng nhập (shop được gắn sớm nhất nếu thuộc nhiều shop).
 * Trả về null khi chưa đăng nhập hoặc chưa được gắn vào shop nào.
 * Đọc qua RLS bằng phiên của chính người dùng, nên không bao giờ lấy nhầm shop khác.
 * `cache` để nhiều khối trong cùng một lượt mở trang chỉ hỏi database một lần.
 */
export const getCurrentOrg = cache(async (): Promise<CurrentOrg | null> => {
  // Supabase dùng giờ hiện tại để kiểm tra hạn phiên → tính lúc mở trang.
  await connection();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations!inner(id, name, logo_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Không đọc được shop của tài khoản: ${error.message}`);
  if (!data) return null;

  const org = data.organizations as unknown as { id: string; name: string; logo_url: string | null };
  return { id: org.id, name: org.name, logoUrl: org.logo_url, role: data.role as OrgRole };
});

import "server-only";
import { decryptSecret, parseKey } from "@/lib/crypto/secret-box";
import type { PancakeCredentials } from "@/lib/pancake/client";
import { createAdminClient } from "@/lib/supabase/admin";

const PROVIDER = "pancake_pos";

/**
 * Khóa Pancake của shop, giải mã trên máy chủ. Đọc bằng khóa secret (bỏ qua RLS) nên
 * NGƯỜI GỌI PHẢI tự bảo đảm orgId là shop của người đang đăng nhập (getCurrentOrg) hoặc là việc nền.
 * Không bao giờ trả khóa này xuống trình duyệt.
 */
export async function getPancakeCredentials(orgId: string): Promise<PancakeCredentials | null> {
  const { data, error } = await createAdminClient()
    .from("connections")
    .select("external_id, secret_ciphertext")
    .eq("org_id", orgId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new Error(`Không đọc được kết nối: ${error.message}`);
  if (!data) return null;
  const apiKey = decryptSecret(data.secret_ciphertext, `${orgId}:${PROVIDER}`, parseKey(process.env.ENCRYPTION_KEY));
  return { shopId: data.external_id, apiKey };
}

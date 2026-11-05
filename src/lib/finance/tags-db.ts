import type { AnySupabase } from "@/lib/supabase/types";

/**
 * Đặt (hoặc đổi) tên một thẻ phiếu chi, bằng phiên người dùng (RLS: chỉ Chủ shop).
 * KHÔNG dùng upsert: upsert ghi lại cả org_id/tag_id, mà database chỉ cho sửa cột `name`
 * (column grant) → bị từ chối "permission denied" (lỗi 05/11/2026). Nên: sửa tên trước, chưa có thì thêm mới.
 */
export async function saveExpenseTagName(
  supabase: AnySupabase,
  orgId: string,
  tagId: string,
  name: string,
): Promise<{ error: string | null }> {
  const upd = await supabase
    .from("expense_tags")
    .update({ name })
    .eq("org_id", orgId)
    .eq("tag_id", tagId)
    .select("tag_id");
  if (upd.error) return { error: upd.error.message };
  if ((upd.data ?? []).length > 0) return { error: null };
  const ins = await supabase.from("expense_tags").insert({ org_id: orgId, tag_id: tagId, name });
  return { error: ins.error?.message ?? null };
}

import "server-only";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_RULES, rowToStockRules, SETTING_COLUMNS, type ShopRules } from "./settings";

export interface ShopStockRules {
  rules: ShopRules;
  /** true khi người đang xem là Chủ shop (được sửa). */
  canEdit: boolean;
  /** true khi shop chưa lưu cấu hình riêng, đang dùng số mặc định. */
  isDefault: boolean;
}

/** Cấu hình tồn kho của shop người đang đăng nhập (qua RLS); chưa có shop thì dùng mặc định. */
export async function getShopStockRules(): Promise<ShopStockRules> {
  const org = await getCurrentOrg();
  if (!org) return { rules: { ...DEFAULT_RULES }, canEdit: false, isDefault: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_settings")
    .select(SETTING_COLUMNS.join(", "))
    .eq("org_id", org.id)
    .maybeSingle();
  if (error) throw new Error(`Không đọc được cấu hình tồn kho: ${error.message}`);

  return {
    rules: rowToStockRules(data as Record<string, unknown> | null),
    canEdit: org.role === "owner",
    isDefault: !data,
  };
}

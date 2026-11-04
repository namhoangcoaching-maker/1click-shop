"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";
import { checkStockRules, SETTING_FIELDS, stockRulesToRow, type StockRuleKey } from "./settings";

export interface SettingsState {
  ok?: boolean;
  message?: string;
  errors?: Partial<Record<StockRuleKey, string>>;
  /** Giữ lại số đã gõ khi lỗi. */
  values?: Partial<Record<StockRuleKey, string>>;
}

/** Lưu cấu hình tồn kho. Chỉ Chủ shop (database cũng chặn người khác bằng RLS). */
export async function saveStockRules(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const values = Object.fromEntries(
    SETTING_FIELDS.map((f) => [f.key, String(formData.get(f.key) ?? "")]),
  ) as Record<StockRuleKey, string>;

  const org = await getCurrentOrg();
  if (!org) return { ok: false, message: "Tài khoản chưa được gắn vào shop.", values };
  if (org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop mới sửa được cấu hình tồn kho.", values };

  const check = checkStockRules(values);
  if (!check.ok) return { ok: false, message: "Có ô chưa đúng, xem dòng đỏ bên dưới từng ô.", errors: check.errors, values };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const fields = { ...stockRulesToRow(check.value), updated_by: auth?.claims?.sub ?? null };

  const existing = await supabase.from("inventory_settings").select("org_id").eq("org_id", org.id).maybeSingle();
  if (existing.error) return { ok: false, message: "Không lưu được, thử lại sau.", values };
  const { error } = existing.data
    ? await supabase.from("inventory_settings").update(fields).eq("org_id", org.id)
    : await supabase.from("inventory_settings").insert({ org_id: org.id, ...fields });
  if (error) return { ok: false, message: "Không lưu được, thử lại sau.", values };

  refresh();
  return { ok: true, message: "Đã lưu cấu hình. Báo động tồn kho đã tính lại theo số mới." };
}

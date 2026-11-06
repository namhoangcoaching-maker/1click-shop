"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";

export interface TaxState {
  ok?: boolean;
  message?: string;
}

/** Chủ shop lưu loại hình + doanh thu năm trước (database cũng chỉ cho Chủ – RLS 0018). */
export async function saveTaxSettings(_prev: TaxState, form: FormData): Promise<TaxState> {
  const org = await getCurrentOrg();
  if (!org || org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop sửa cấu hình thuế." };
  const businessType = String(form.get("businessType") ?? "");
  if (businessType !== "household" && businessType !== "company") return { ok: false, message: "Chọn loại hình." };
  const text = String(form.get("priorYearRevenue") ?? "").replace(/[.\s,₫đ]/g, "");
  if (!/^\d{1,15}$/.test(text)) return { ok: false, message: "Doanh thu năm trước chỉ gồm chữ số, ví dụ 3.200.000.000." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("tax_settings")
    .upsert(
      { org_id: org.id, business_type: businessType, prior_year_revenue: Number(text), updated_by: claims?.claims?.sub, updated_at: new Date().toISOString() },
      { onConflict: "org_id" },
    );
  if (error) return { ok: false, message: "Không lưu được, thử lại." };
  refresh();
  return { ok: true, message: "Đã lưu cấu hình thuế." };
}

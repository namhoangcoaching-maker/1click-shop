"use server";

import { refresh } from "next/cache";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";

export interface TagState {
  ok?: boolean;
  message?: string;
}

/** Chủ shop đặt tên cho thẻ phiếu chi Pancake (Pancake không trả tên thẻ qua API). */
export async function saveTagName(_prev: TagState, formData: FormData): Promise<TagState> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, message: "Tài khoản chưa được gắn vào shop." };
  if (org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop mới đặt tên thẻ." };
  const tagId = String(formData.get("tagId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!tagId || tagId.length > 100) return { ok: false, message: "Thiếu mã thẻ." };
  if (name.length < 1 || name.length > 60) return { ok: false, message: "Tên thẻ từ 1 đến 60 ký tự." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_tags")
    .upsert({ org_id: org.id, tag_id: tagId, name }, { onConflict: "org_id,tag_id" });
  if (error) return { ok: false, message: "Không lưu được, thử lại sau." };
  refresh();
  return { ok: true, message: `Đã đặt tên thẻ: ${name}` };
}

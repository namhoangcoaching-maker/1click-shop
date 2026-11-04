"use server";

import { connection } from "next/server";
import { refresh } from "next/cache";
import { todayInVN } from "@/lib/date-range";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";
import { checkIncomingForm } from "./incoming";

export interface IncomingState {
  ok?: boolean;
  message?: string;
}

async function requireEditor() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Tài khoản chưa được gắn vào shop." } as const;
  if (org.role !== "owner" && org.role !== "manager") {
    return { error: "Chỉ Chủ shop hoặc Quản lý mới nhập được hàng sắp về." } as const;
  }
  return { org } as const;
}

/** Nút "Đã đặt": lưu số lượng từng size đã đặt xưởng + ngày dự kiến về. Form gửi eta và q:<mã size>. */
export async function addIncoming(_prev: IncomingState, formData: FormData): Promise<IncomingState> {
  await connection();
  const auth = await requireEditor();
  if ("error" in auth) return { ok: false, message: auth.error };

  const quantities: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("q:")) quantities[k.slice(2)] = v;
  const check = checkIncomingForm(formData.get("eta"), quantities, todayInVN());
  if (!check.ok) return { ok: false, message: check.error };

  const supabase = await createClient();
  // Chỉ nhận mã size thuộc shop này (đọc qua RLS).
  const ids = check.entries.map((e) => e.variationId);
  const { data: known, error: e1 } = await supabase
    .from("products")
    .select("variation_id")
    .eq("org_id", auth.org.id)
    .in("variation_id", ids);
  if (e1 || (known ?? []).length !== new Set(ids).size) {
    return { ok: false, message: "Có size không thuộc shop, tải lại trang rồi thử lại." };
  }

  const { data: claims } = await supabase.auth.getClaims();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const { error } = await supabase.from("incoming_stock").insert(
    check.entries.map((e) => ({
      org_id: auth.org.id,
      variation_id: e.variationId,
      quantity: e.quantity,
      eta: check.eta,
      note,
      created_by: claims?.claims?.sub ?? null,
    })),
  );
  if (error) return { ok: false, message: "Không lưu được, thử lại sau." };
  refresh();
  const total = check.entries.reduce((s, e) => s + e.quantity, 0);
  return { ok: true, message: `Đã ghi ${total} cái sắp về ngày ${check.eta.split("-").reverse().join("/")}.` };
}

/** "Đã về" hoặc xóa một dòng hàng sắp về. */
export async function removeIncoming(id: string): Promise<IncomingState> {
  const auth = await requireEditor();
  if ("error" in auth) return { ok: false, message: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("incoming_stock").delete().eq("org_id", auth.org.id).eq("id", id);
  if (error) return { ok: false, message: "Không xóa được, thử lại sau." };
  refresh();
  return { ok: true };
}

"use server";

import { refresh, updateTag } from "next/cache";
import { encryptSecret, parseKey, secretHint } from "@/lib/crypto/secret-box";
import { pancakeStatsTag } from "@/lib/pancake/cached";
import { getCurrentOrg } from "@/lib/org/current";
import { fetchPancakeShops, pickShop } from "@/lib/pancake/shops";
import { runPancakeSync } from "@/lib/pancake/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SaveState {
  ok?: boolean;
  message?: string;
  /** Giữ lại Shop ID đã gõ khi lỗi (không bao giờ trả lại khóa API). */
  shopId?: string;
}

const PROVIDER = "pancake_pos";

async function requireOwner() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Tài khoản chưa được gắn vào shop." } as const;
  if (org.role !== "owner") return { error: "Chỉ Chủ shop mới thay đổi được kết nối." } as const;
  return { org } as const;
}

/** Kiểm tra khóa với Pancake; đúng thì mã hóa rồi lưu. Sai thì không lưu gì. */
export async function savePancakeConnection(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const shopIdInput = String(formData.get("shopId") ?? "").trim();
  const keep = { shopId: shopIdInput };

  const auth = await requireOwner();
  if ("error" in auth) return { ok: false, message: auth.error, ...keep };
  const { org } = auth;

  if (!apiKey) return { ok: false, message: "Vui lòng dán khóa API của Pancake POS.", ...keep };
  if (apiKey.length > 512 || /\s/.test(apiKey)) {
    return { ok: false, message: "Khóa API không đúng dạng (có khoảng trắng hoặc quá dài).", ...keep };
  }

  const shops = await fetchPancakeShops(apiKey);
  if (!shops.ok) return { ok: false, message: shops.error, ...keep };
  const pick = pickShop(shops.shops, shopIdInput);
  if (!pick.ok) return { ok: false, message: pick.error, ...keep };

  const sealed = encryptSecret(apiKey, `${org.id}:${PROVIDER}`, parseKey(process.env.ENCRYPTION_KEY));
  const supabase = await createClient();
  const { data: auth2 } = await supabase.auth.getClaims();

  const fields = {
    external_id: pick.shop.id,
    external_name: pick.shop.name,
    secret_ciphertext: sealed,
    secret_hint: secretHint(apiKey),
    status: "connected",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    updated_by: auth2?.claims?.sub ?? null,
  };

  const existing = await supabase
    .from("connections")
    .select("id, external_id")
    .eq("org_id", org.id)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (existing.error) return { ok: false, message: "Không lưu được, thử lại sau.", ...keep };

  // Đổi sang shop Pancake KHÁC: xóa dữ liệu đã đồng bộ của shop cũ để số liệu không bị trộn.
  if (existing.data && existing.data.external_id !== pick.shop.id) {
    const admin = createAdminClient();
    for (const table of ["orders", "products", "sync_state"] as const) {
      const { error: e } = await admin.from(table).delete().eq("org_id", org.id);
      if (e) return { ok: false, message: "Không xóa được dữ liệu của shop Pancake cũ, thử lại sau.", ...keep };
    }
  }

  const { error } = existing.data
    ? await supabase.from("connections").update(fields).eq("id", existing.data.id)
    : await supabase.from("connections").insert({ org_id: org.id, provider: PROVIDER, ...fields });
  if (error) return { ok: false, message: "Không lưu được, thử lại sau.", ...keep };

  refresh();
  return { ok: true, message: `Đã kết nối shop "${pick.shop.name}" (ID ${pick.shop.id}).` };
}

export async function deletePancakeConnection(): Promise<SaveState> {
  const auth = await requireOwner();
  if ("error" in auth) return { ok: false, message: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("org_id", auth.org.id)
    .eq("provider", PROVIDER);
  if (error) return { ok: false, message: "Không ngắt được kết nối, thử lại sau." };
  refresh();
  return { ok: true, message: "Đã ngắt kết nối Pancake POS và xóa khóa." };
}

/** Nút "Đồng bộ ngay": mọi thành viên shop bấm được (chỉ lấy dữ liệu về, không đổi gì trên Pancake). */
export async function syncPancakeNow(): Promise<SaveState> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, message: "Tài khoản chưa được gắn vào shop." };
  if (org.role === "staff") return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý mới đồng bộ được." };
  const r = await runPancakeSync(org.id, { budgetMs: 45_000 });
  // Xóa số Pancake đang nhớ tạm của shop để trang hiện số mới nhất ngay.
  updateTag(pancakeStatsTag(org.id));
  refresh();
  switch (r.status) {
    case "ok":
      return { ok: true, message: `Đã đồng bộ: ${r.orders} đơn mới/cập nhật${r.products ? `, ${r.products} mã sản phẩm` : ""}.` };
    case "partial":
      return { ok: true, message: `Đã lấy ${r.orders} đơn. Vẫn còn dữ liệu, bấm lần nữa hoặc đợi lịch tự động.` };
    case "busy":
      return { ok: false, message: "Đang có một lượt đồng bộ chạy, đợi 1–2 phút rồi xem lại." };
    case "not_connected":
      return { ok: false, message: "Shop chưa kết nối Pancake POS." };
    default:
      return { ok: false, message: r.error ?? "Đồng bộ lỗi, thử lại sau." };
  }
}

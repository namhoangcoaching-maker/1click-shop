/**
 * Kiểm tra khóa API Pancake POS bằng lệnh "Thông tin cửa hàng":
 *   GET https://pos.pages.fm/api/v1/shops?api_key=...
 * Theo tài liệu chính thức (docs.pancake.biz/pos/api, mục Shop):
 *   - Đúng khóa: 200 { success: true, shops: [{ id, name, avatar_url, ... }] }
 *   - Sai khóa:  403 { success: false, message: "api_key is invalid", error_code: 105 } (đã thử thật)
 */

export const PANCAKE_POS_BASE = "https://pos.pages.fm/api/v1";

export interface PancakeShop {
  id: string;
  name: string;
}

export type ShopsResult = { ok: true; shops: PancakeShop[] } | { ok: false; error: string };

/** Đọc kết quả trả về của Pancake (tách riêng để có unit test, không cần mạng). */
export function interpretShopsResponse(status: number, body: unknown): ShopsResult {
  const json = (body ?? {}) as { success?: unknown; shops?: unknown; message?: unknown };
  if (status === 403 || status === 401) {
    return { ok: false, error: "Pancake từ chối khóa API này. Kiểm tra lại khóa (có thể đã bị xóa hoặc chép thiếu)." };
  }
  if (status === 429) return { ok: false, error: "Pancake đang giới hạn số lần gọi. Đợi một phút rồi thử lại." };
  if (status >= 500) return { ok: false, error: "Máy chủ Pancake đang lỗi hoặc bảo trì. Thử lại sau." };
  if (status !== 200 || json.success !== true || !Array.isArray(json.shops)) {
    const msg = typeof json.message === "string" ? ` (${json.message})` : "";
    return { ok: false, error: `Pancake trả về kết quả không như mong đợi${msg}.` };
  }
  const shops = json.shops
    .filter((s): s is { id: unknown; name?: unknown } => typeof s === "object" && s !== null && "id" in s)
    .map((s) => ({ id: String(s.id), name: typeof s.name === "string" ? s.name : `Shop ${String(s.id)}` }));
  if (shops.length === 0) return { ok: false, error: "Khóa đúng nhưng không thấy shop nào trên Pancake." };
  return { ok: true, shops };
}

export type ShopPick = { ok: true; shop: PancakeShop } | { ok: false; error: string };

/** Chọn shop theo Shop ID người dùng nhập; để trống mà khóa chỉ có 1 shop thì tự chọn. */
export function pickShop(shops: PancakeShop[], shopIdInput: string): ShopPick {
  const wanted = shopIdInput.trim();
  if (!wanted) {
    if (shops.length === 1) return { ok: true, shop: shops[0] };
    return {
      ok: false,
      error: `Khóa này dùng được cho ${shops.length} shop: ${shops.map((s) => `${s.name} (ID ${s.id})`).join(", ")}. Hãy nhập Shop ID muốn kết nối.`,
    };
  }
  const shop = shops.find((s) => s.id === wanted);
  if (!shop) {
    return {
      ok: false,
      error: `Khóa này không có quyền với Shop ID ${wanted}. Các shop của khóa: ${shops.map((s) => `${s.name} (ID ${s.id})`).join(", ")}.`,
    };
  }
  return { ok: true, shop };
}

/** Gọi Pancake thật. Chỉ chạy trên máy chủ (khóa không bao giờ xuống trình duyệt). */
export async function fetchPancakeShops(apiKey: string): Promise<ShopsResult> {
  const url = `${PANCAKE_POS_BASE}/shops?api_key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body = await res.json().catch(() => null);
    return interpretShopsResponse(res.status, body);
  } catch {
    return { ok: false, error: "Không kết nối được tới Pancake (mạng chậm hoặc Pancake không phản hồi). Thử lại sau." };
  }
}

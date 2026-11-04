import { PANCAKE_POS_BASE } from "./shops";

export interface PancakeCredentials {
  shopId: string;
  apiKey: string;
}

export class PancakeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number>;

/** Gọi một trang dữ liệu Pancake POS (GET). Bị giới hạn (429) thì đợi rồi thử lại 1 lần. */
export async function pancakeGet<T = Record<string, unknown>>(
  creds: PancakeCredentials,
  path: string,
  params: Params = {},
): Promise<T> {
  const url = new URL(`${PANCAKE_POS_BASE}/shops/${encodeURIComponent(creds.shopId)}${path}`);
  url.searchParams.set("api_key", creds.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 3_000));
      continue;
    }
    const body = (await res.json().catch(() => null)) as (T & { success?: boolean; message?: string }) | null;
    if (!res.ok || !body || body.success === false) {
      const reason =
        res.status === 403
          ? "Pancake từ chối khóa API (khóa bị xóa hoặc hết quyền). Vào trang Kết nối để dán khóa mới."
          : res.status === 429
            ? "Pancake đang giới hạn số lần gọi, sẽ thử lại ở lần đồng bộ sau."
            : `Pancake trả lỗi ${res.status}${body?.message ? `: ${body.message}` : ""}.`;
      throw new PancakeError(reason, res.status);
    }
    return body;
  }
}

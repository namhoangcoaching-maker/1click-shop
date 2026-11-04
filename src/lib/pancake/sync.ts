import "server-only";
import { decryptSecret, parseKey } from "@/lib/crypto/secret-box";
import { createAdminClient } from "@/lib/supabase/admin";
import { pancakeGet, PancakeError, type PancakeCredentials } from "./client";
import { mapOrder, mapVariation, type OrderItemRow, type OrderRow, type ProductRow } from "./map";
import {
  incrementalRange,
  initialState,
  needsProducts,
  nextBackfillWindow,
  SYNC_RULES,
  type SyncStateLike,
} from "./sync-plan";

/**
 * Đồng bộ Pancake POS → database cho MỘT shop. Chạy được nhiều lần liên tiếp:
 *  1. Sản phẩm + tồn kho (nếu lần trước cũ hơn 10 phút).
 *  2. Đơn mới hoặc vừa đổi trạng thái (theo giờ cập nhật).
 *  3. Lấy dần lịch sử 90 ngày, mỗi đợt 7 ngày, tới khi hết thời gian cho phép (budgetMs).
 * Có khóa chống chạy chồng (cron và nút "Đồng bộ ngay" bấm cùng lúc).
 */

const PROVIDER = "pancake_pos";
const PAGE_SIZE = 500;

type Admin = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  status: "ok" | "partial" | "error" | "busy" | "not_connected";
  products: number;
  orders: number;
  /** Đơn/mã Pancake trả về nhưng không đọc được (thiếu mã, thiếu ngày): phải bằng 0. */
  skipped: number;
  backfillDone: boolean;
  error?: string;
}

/** Lấy khóa Pancake đã mã hóa của shop và giải mã (chỉ trên máy chủ). */
async function loadCredentials(admin: Admin, orgId: string): Promise<PancakeCredentials | null> {
  const { data, error } = await admin
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

async function acquireLock(admin: Admin, orgId: string, now: Date): Promise<SyncStateLike | null> {
  await admin
    .from("sync_state")
    .upsert({ org_id: orgId, provider: PROVIDER, ...initialState(now) }, { onConflict: "org_id,provider", ignoreDuplicates: true });
  const staleBefore = new Date(now.getTime() - SYNC_RULES.lockMinutes * 60_000).toISOString();
  const { data, error } = await admin
    .from("sync_state")
    .update({ running_since: now.toISOString() })
    .eq("org_id", orgId)
    .eq("provider", PROVIDER)
    .or(`running_since.is.null,running_since.lt.${staleBefore}`)
    .select("products_synced_at, orders_cursor, backfill_target, backfill_next_end");
  if (error) throw new Error(`Không khóa được lượt đồng bộ: ${error.message}`);
  return data?.[0] ?? null;
}

async function saveState(admin: Admin, orgId: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("sync_state").update(patch).eq("org_id", orgId).eq("provider", PROVIDER);
  if (error) throw new Error(`Không lưu được tiến độ đồng bộ: ${error.message}`);
}

async function upsertProducts(admin: Admin, orgId: string, rows: ProductRow[]) {
  const syncedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const chunk = rows.slice(i, i + PAGE_SIZE).map((r) => ({ ...r, org_id: orgId, synced_at: syncedAt }));
    const { error } = await admin.from("products").upsert(chunk, { onConflict: "org_id,variation_id" });
    if (error) throw new Error(`Không lưu được sản phẩm: ${error.message}`);
  }
}

async function upsertOrders(admin: Admin, orgId: string, batch: { order: OrderRow; items: OrderItemRow[] }[]) {
  if (batch.length === 0) return;
  const syncedAt = new Date().toISOString();
  // Một đơn có thể xuất hiện 2 lần trong cùng lượt (đổi trạng thái giữa 2 trang): giữ bản sau cùng.
  const byId = new Map(batch.map((b) => [b.order.order_id, b]));
  const unique = [...byId.values()];
  const { error } = await admin
    .from("orders")
    .upsert(unique.map((b) => ({ ...b.order, org_id: orgId, synced_at: syncedAt })), { onConflict: "org_id,order_id" });
  if (error) throw new Error(`Không lưu được đơn hàng: ${error.message}`);

  // Dòng hàng: xóa dòng cũ của các đơn này rồi ghi lại (đơn có thể bị sửa bớt/thêm sản phẩm).
  const ids = unique.map((b) => b.order.order_id);
  const del = await admin.from("order_items").delete().eq("org_id", orgId).in("order_id", ids);
  if (del.error) throw new Error(`Không cập nhật được dòng hàng: ${del.error.message}`);
  const items = unique.flatMap((b) => b.items.map((it) => ({ ...it, org_id: orgId })));
  for (let i = 0; i < items.length; i += 1000) {
    const { error: e } = await admin.from("order_items").insert(items.slice(i, i + 1000));
    if (e) throw new Error(`Không lưu được dòng hàng: ${e.message}`);
  }
}

/** Lấy mọi trang đơn trong khoảng thời gian; trả về false nếu hết giờ giữa chừng (chưa xong khoảng này). */
async function syncOrderRange(
  admin: Admin,
  orgId: string,
  creds: PancakeCredentials,
  range: { start: number; end: number; by: "inserted_at" | "updated_at" },
  deadline: number,
): Promise<{ complete: boolean; count: number; skipped: number }> {
  let count = 0;
  let skipped = 0;
  for (let page = 1; ; page++) {
    if (Date.now() > deadline) return { complete: false, count, skipped };
    const body = await pancakeGet<{ data?: Record<string, unknown>[]; total_pages?: number }>(creds, "/orders", {
      page_size: PAGE_SIZE,
      page_number: page,
      updateStatus: range.by,
      startDateTime: range.start,
      endDateTime: range.end,
    });
    const raw = body.data ?? [];
    const batch = raw.map(mapOrder).filter((x) => x !== null);
    await upsertOrders(admin, orgId, batch);
    count += batch.length;
    skipped += raw.length - batch.length;
    if (page >= (body.total_pages ?? 1) || raw.length === 0) return { complete: true, count, skipped };
  }
}

export async function runPancakeSync(orgId: string, opts: { budgetMs?: number } = {}): Promise<SyncResult> {
  const admin = createAdminClient();
  const startedAt = new Date();
  const deadline = startedAt.getTime() + (opts.budgetMs ?? 40_000);
  const result: SyncResult = { status: "ok", products: 0, orders: 0, skipped: 0, backfillDone: false };

  const creds = await loadCredentials(admin, orgId);
  if (!creds) return { ...result, status: "not_connected" };

  const state = await acquireLock(admin, orgId, startedAt);
  if (!state) return { ...result, status: "busy" };

  try {
    // 1. Sản phẩm + tồn kho
    if (needsProducts(state, startedAt)) {
      const rows: ProductRow[] = [];
      for (let page = 1; ; page++) {
        const body = await pancakeGet<{ data?: Record<string, unknown>[]; total_pages?: number }>(
          creds,
          "/products/variations",
          { page_size: PAGE_SIZE, page_number: page },
        );
        const raw = body.data ?? [];
        const mapped = raw.map(mapVariation).filter((x) => x !== null);
        rows.push(...mapped);
        result.skipped += raw.length - mapped.length;
        if (page >= (body.total_pages ?? 1) || (body.data ?? []).length === 0) break;
      }
      await upsertProducts(admin, orgId, rows);
      result.products = rows.length;
      await saveState(admin, orgId, { products_synced_at: startedAt.toISOString() });
    }

    // 2. Đơn mới / vừa đổi trạng thái
    const inc = await syncOrderRange(admin, orgId, creds, { ...incrementalRange(state, startedAt), by: "updated_at" }, deadline);
    result.orders += inc.count;
    result.skipped += inc.skipped;
    if (inc.complete) await saveState(admin, orgId, { orders_cursor: startedAt.toISOString() });
    else result.status = "partial";

    // 3. Lịch sử, lùi từng đợt 7 ngày
    let cursor: SyncStateLike = state;
    for (let w = nextBackfillWindow(cursor); w && inc.complete; w = nextBackfillWindow(cursor)) {
      if (Date.now() > deadline) {
        result.status = "partial";
        break;
      }
      const r = await syncOrderRange(
        admin,
        orgId,
        creds,
        { start: Math.floor(w.start.getTime() / 1000), end: Math.floor(w.end.getTime() / 1000), by: "inserted_at" },
        deadline,
      );
      result.orders += r.count;
      result.skipped += r.skipped;
      if (!r.complete) {
        result.status = "partial";
        break;
      }
      cursor = { ...cursor, backfill_next_end: w.start.toISOString() };
      await saveState(admin, orgId, { backfill_next_end: cursor.backfill_next_end });
    }
    result.backfillDone = nextBackfillWindow(cursor) === null;

    await saveState(admin, orgId, {
      running_since: null,
      last_run_at: new Date().toISOString(),
      last_status: result.status,
      last_error: null,
      last_counts: { products: result.products, orders: result.orders, skipped: result.skipped },
    });
    return result;
  } catch (err) {
    const message =
      err instanceof PancakeError ? err.message : `Lỗi khi đồng bộ: ${err instanceof Error ? err.message : String(err)}`;
    await saveState(admin, orgId, {
      running_since: null,
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_error: message.slice(0, 500),
    }).catch(() => {});
    return { ...result, status: "error", error: message };
  }
}

/** Đồng bộ lần lượt mọi shop đã kết nối Pancake (dùng cho lịch tự động). */
export async function runAllPancakeSyncs(budgetMs: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("connections").select("org_id").eq("provider", PROVIDER);
  if (error) throw new Error(`Không đọc được danh sách kết nối: ${error.message}`);
  const deadline = Date.now() + budgetMs;
  const results: Record<string, SyncResult> = {};
  for (const { org_id } of data ?? []) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    results[org_id] = await runPancakeSync(org_id, { budgetMs: left });
  }
  return results;
}

import "server-only";
import { backfillProgress } from "@/lib/pancake/sync-plan";
import { createClient } from "@/lib/supabase/server";

export type ConnectionProvider = "pancake_pos";

export interface ConnectionInfo {
  provider: ConnectionProvider;
  externalId: string;
  externalName: string | null;
  secretHint: string;
  status: "connected" | "error";
  lastError: string | null;
  lastCheckedAt: string | null;
}

/** Danh sách kết nối của shop (KHÔNG có khóa: database cũng không cho người dùng đọc cột bản mã). */
export async function getConnections(orgId: string): Promise<ConnectionInfo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .select("provider, external_id, external_name, secret_hint, status, last_error, last_checked_at")
    .eq("org_id", orgId);
  if (error) throw new Error(`Không đọc được danh sách kết nối: ${error.message}`);
  return (data ?? []).map((r) => ({
    provider: r.provider as ConnectionProvider,
    externalId: r.external_id,
    externalName: r.external_name,
    secretHint: r.secret_hint,
    status: r.status as ConnectionInfo["status"],
    lastError: r.last_error,
    lastCheckedAt: r.last_checked_at,
  }));
}

export interface SyncInfo {
  lastRunAt: string | null;
  lastStatus: "ok" | "partial" | "error" | null;
  lastError: string | null;
  running: boolean;
  backfillPercent: number;
  products: number;
  orders: number;
  oldestOrderAt: string | null;
}

/** Tình trạng đồng bộ Pancake của shop (đọc qua RLS). */
export async function getSyncInfo(orgId: string): Promise<SyncInfo | null> {
  const supabase = await createClient();
  const [state, products, orders, oldest] = await Promise.all([
    supabase
      .from("sync_state")
      .select("last_run_at, last_status, last_error, running_since, backfill_target, backfill_next_end, products_synced_at, orders_cursor")
      .eq("org_id", orgId)
      .eq("provider", "pancake_pos")
      .maybeSingle(),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("orders").select("inserted_at").eq("org_id", orgId).order("inserted_at").limit(1).maybeSingle(),
  ]);
  if (state.error) throw new Error(`Không đọc được tình trạng đồng bộ: ${state.error.message}`);
  if (!state.data) return null;
  const s = state.data;
  return {
    lastRunAt: s.last_run_at,
    lastStatus: s.last_status,
    lastError: s.last_error,
    running: Boolean(s.running_since) && Date.now() - new Date(s.running_since).getTime() < 5 * 60_000,
    backfillPercent: backfillProgress(s),
    products: products.count ?? 0,
    orders: orders.count ?? 0,
    oldestOrderAt: oldest.data?.inserted_at ?? null,
  };
}

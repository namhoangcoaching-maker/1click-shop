import "server-only";
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

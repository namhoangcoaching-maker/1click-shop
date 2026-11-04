import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AnySupabase } from "@/lib/supabase/types";
import type { IncomingRow } from "./incoming";

/** Hàng sắp về của shop (đọc qua RLS). */
export async function getIncoming(orgId: string, client?: AnySupabase): Promise<IncomingRow[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("incoming_stock")
    .select("id, variation_id, quantity, eta, note")
    .eq("org_id", orgId)
    .order("eta");
  if (error) throw new Error(`Không đọc được hàng sắp về: ${error.message}`);
  return (data ?? []) as IncomingRow[];
}

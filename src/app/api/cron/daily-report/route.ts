import { isCronAuthorized } from "@/lib/cron-auth";
import { runPancakeSync } from "@/lib/pancake/sync";
import { generateDailyReport } from "@/lib/report/generate";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Báo cáo 8:00 hằng ngày (Supabase pg_cron gọi lúc 01:00 giờ quốc tế = 8:00 giờ VN).
 * Với mỗi shop đã kết nối Pancake: đồng bộ nhanh cho số mới nhất, rồi lập và lưu báo cáo.
 */
export const maxDuration = 60;

async function handle(request: Request) {
  if (!isCronAuthorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("connections").select("org_id").eq("provider", "pancake_pos");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const results: Record<string, string> = {};
  for (const { org_id } of data ?? []) {
    try {
      await runPancakeSync(org_id, { budgetMs: 20_000 });
      const r = await generateDailyReport(org_id);
      results[org_id] = `ok ${r.date}${r.statsError ? ` (${r.statsError})` : ""}`;
    } catch (err) {
      results[org_id] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return Response.json({ ok: true, results });
}

export const GET = handle;
export const POST = handle;

import { isCronAuthorized } from "@/lib/cron-auth";
import { runAllPancakeSyncs } from "@/lib/pancake/sync";

/**
 * Lịch tự động (Supabase pg_cron gọi mỗi 30 phút, xem scripts/db-setup-cron.mjs) đồng bộ mọi shop.
 * Chỉ chạy khi có đúng mật khẩu CRON_SECRET trong header "Authorization: Bearer …".
 */
export const maxDuration = 60;

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const budget = Number(new URL(request.url).searchParams.get("budget")) || 45_000;
  const results = await runAllPancakeSyncs(Math.min(Math.max(budget, 5_000), 280_000));
  return Response.json({ ok: true, results });
}

export const GET = handle;
export const POST = handle;

import { timingSafeEqual } from "node:crypto";
import { runAllPancakeSyncs } from "@/lib/pancake/sync";

/**
 * Lịch tự động (Supabase pg_cron gọi mỗi 30 phút, xem scripts/db-setup-cron.mjs) đồng bộ mọi shop.
 * Chỉ chạy khi có đúng mật khẩu CRON_SECRET trong header "Authorization: Bearer …".
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = request.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const budget = Number(new URL(request.url).searchParams.get("budget")) || 45_000;
  const results = await runAllPancakeSyncs(Math.min(Math.max(budget, 5_000), 280_000));
  return Response.json({ ok: true, results });
}

export const GET = handle;
export const POST = handle;

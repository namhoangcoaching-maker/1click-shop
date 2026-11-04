import { timingSafeEqual } from "node:crypto";

/** Lịch tự động gọi vào /api/cron/... phải kèm "Authorization: Bearer <CRON_SECRET>". */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

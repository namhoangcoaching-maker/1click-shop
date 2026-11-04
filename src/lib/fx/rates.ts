import "server-only";
import type { DateString } from "@/lib/date-range";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchVcbRate } from "./vcb";

/**
 * Tỷ giá USD→VND (VCB mua chuyển khoản) cho các ngày cần; ngày chưa có trong database thì lấy từ VCB
 * rồi lưu lại (tối đa 40 ngày mỗi lần để không chậm trang). Trả về ngày → tỷ giá.
 */
export async function getUsdRates(dates: DateString[]): Promise<Map<DateString, number>> {
  const wanted = [...new Set(dates)].sort();
  const result = new Map<DateString, number>();
  if (wanted.length === 0) return result;
  const admin = createAdminClient();
  const { data } = await admin
    .from("fx_rates")
    .select("rate_date, rate")
    .eq("currency", "USD")
    .gte("rate_date", wanted[0])
    .lte("rate_date", wanted[wanted.length - 1]);
  for (const r of data ?? []) result.set(r.rate_date, Number(r.rate));

  const missing = wanted.filter((d) => !result.has(d)).slice(0, 40);
  const fetched = await Promise.all(missing.map(async (d) => [d, await fetchVcbRate(d)] as const));
  const rows = fetched
    .filter((x): x is readonly [string, number] => x[1] !== null)
    .map(([d, r]) => ({ currency: "USD", rate_date: d, rate: r }));
  if (rows.length) await admin.from("fx_rates").upsert(rows, { onConflict: "currency,rate_date" });
  for (const r of rows) result.set(r.rate_date, r.rate);
  return result;
}

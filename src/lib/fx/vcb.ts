/**
 * Tỷ giá Vietcombank (chủ dự án chốt 05/11/2026: đổi USD đơn Shopify theo tỷ giá VCB từng ngày,
 * lấy cột "mua chuyển khoản"). Nguồn: https://www.vietcombank.com.vn/api/exchangerates?date=YYYY-MM-DD
 */
import type { DateString } from "@/lib/date-range";

export const VCB_URL = "https://www.vietcombank.com.vn/api/exchangerates";

/** Đọc tỷ giá mua chuyển khoản của một loại tiền từ kết quả VCB; không có thì null. */
export function parseVcbRate(body: unknown, currency: string): number | null {
  const data = (body as { Data?: { currencyCode?: string; transfer?: string }[] } | null)?.Data;
  const row = Array.isArray(data) ? data.find((d) => d.currencyCode === currency) : undefined;
  const rate = Number(String(row?.transfer ?? "").replace(/,/g, ""));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export async function fetchVcbRate(date: DateString, currency = "USD"): Promise<number | null> {
  try {
    const res = await fetch(`${VCB_URL}?date=${date}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return parseVcbRate(await res.json(), currency);
  } catch {
    return null;
  }
}

/** Tỷ giá của ngày `date`; thiếu thì lấy ngày gần nhất TRƯỚC đó, không có nữa thì ngày gần nhất sau. */
export function rateOn(rates: Map<DateString, number>, date: DateString): number | null {
  if (rates.has(date)) return rates.get(date)!;
  const days = [...rates.keys()].sort();
  const before = days.filter((d) => d < date).pop();
  if (before) return rates.get(before)!;
  const after = days.find((d) => d > date);
  return after ? rates.get(after)! : null;
}

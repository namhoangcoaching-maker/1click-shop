import "server-only";
import { addDays, type DateString } from "@/lib/date-range";
import { createClient } from "@/lib/supabase/server";
import { cashByDay, cashEvents, type CashDay, type CashOrder, type CashTransaction } from "./compute";

const PAGE = 1000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lấy đủ mọi trang (Supabase trả tối đa 1.000 dòng mỗi lần), các trang sau chạy song song. */
async function fetchAll<T>(
  build: (supabase: Supabase) => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> },
  supabase: Supabase,
): Promise<T[]> {
  const first = await build(supabase).range(0, PAGE - 1);
  if (first.error) throw new Error(`Không đọc được dữ liệu tiền về: ${first.error.message}`);
  const total = first.count ?? 0;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(total / PAGE) - 1) }, (_, i) =>
      build(supabase).range((i + 1) * PAGE, (i + 2) * PAGE - 1),
    ),
  );
  for (const r of rest) if (r.error) throw new Error(`Không đọc được dữ liệu tiền về: ${r.error.message}`);
  return [first, ...rest].flatMap((r) => (r.data ?? []) as T[]);
}

/**
 * Tiền về theo ngày trong [from, to] (giờ Việt Nam), đọc qua RLS.
 * Lấy đơn khách nhận từ (from − 8 ngày) để tính khoản TikTok +7 ngày rơi vào khoảng này.
 */
export async function getCashDays(orgId: string, from: DateString, to: DateString): Promise<CashDay[]> {
  const supabase = await createClient();
  const startIso = new Date(`${addDays(from, -8)}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${addDays(to, 1)}T00:00:00+07:00`).toISOString();
  const txStart = new Date(`${from}T00:00:00+07:00`).toISOString();

  const [orders, transactions] = await Promise.all([
    fetchAll<CashOrder>(
      (s) =>
        s
          .from("orders")
          .select(
            "order_id, system_id, source, total_price, cod, partner_fee, carrier_id, delivered_at, returned_at, partial_returned_at, returned_value",
            { count: "exact" },
          )
          .eq("org_id", orgId)
          .or(`delivered_at.gte.${startIso},returned_at.gte.${startIso},partial_returned_at.gte.${startIso}`)
          .lt("delivered_at", endIso)
          .order("order_id"),
      supabase,
    ),
    fetchAll<CashTransaction>(
      (s) =>
        s
          .from("cash_transactions")
          .select("posted_at, amount, name, order_display_id", { count: "exact" })
          .eq("org_id", orgId)
          .gte("posted_at", txStart)
          .lt("posted_at", endIso)
          .order("transaction_id"),
      supabase,
    ),
  ]);
  return cashByDay(cashEvents(orders, transactions), from, to);
}

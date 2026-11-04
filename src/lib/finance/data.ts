import "server-only";
import { getCashDays } from "@/lib/cash/data";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import { addDays, type DateString } from "@/lib/date-range";
import { rangeToPancake } from "@/lib/overview/compute";
import { fetchSaleStats } from "@/lib/pancake/analytics";
import { createClient } from "@/lib/supabase/server";
import { buildMonthFinance, expenseLines, monthRange, type ExpenseTransaction, type MonthFinance, type MonthString } from "./month";

export interface TagInfo {
  tagId: string;
  name: string | null;
  /** Phiếu mẫu để nhận ra thẻ khi đặt tên. */
  sample: string | null;
  count: number;
}

export interface MonthFinanceData {
  finance: MonthFinance;
  pancakeError: string | null;
  tags: TagInfo[];
}

/** Lợi nhuận kinh doanh + Dòng tiền thực tế của một tháng. `orgId` lấy từ getCurrentOrg(). */
export async function getMonthFinance(orgId: string, month: MonthString, today: DateString): Promise<MonthFinanceData> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);
  const statsTo = to < today ? to : today;
  const iso = (d: DateString) => new Date(`${d}T00:00:00+07:00`).toISOString();

  const [creds, cashDays, txRes, tagRes, allTagged] = await Promise.all([
    getPancakeCredentials(orgId),
    getCashDays(orgId, from, to),
    // Phiếu chi có thẻ: lấy rộng ±31 ngày rồi lọc theo ngày phát sinh; phí ship trả riêng theo ngày tạo.
    supabase
      .from("cash_transactions")
      .select("display_id, name, amount, tag_ids, time_incurred, posted_at, status, is_canceled")
      .eq("org_id", orgId)
      .gte("posted_at", iso(addDays(from, -31)))
      .lt("posted_at", iso(addDays(to, 32)))
      .or("tag_ids.neq.{},name.ilike.Thanh toán phí vận chuyển*"),
    supabase.from("expense_tags").select("tag_id, name").eq("org_id", orgId),
    supabase.from("cash_transactions").select("tag_ids, name").eq("org_id", orgId).neq("tag_ids", "{}").limit(1000),
  ]);
  if (txRes.error) throw new Error(`Không đọc được phiếu chi: ${txRes.error.message}`);

  const tagNames = new Map((tagRes.data ?? []).map((t) => [t.tag_id as string, t.name as string]));
  const txs = (txRes.data ?? []) as ExpenseTransaction[];
  const shippingFeePaid = txs
    .filter((t) => /^Thanh toán phí vận chuyển/i.test(t.name ?? "") && !t.is_canceled)
    .filter((t) => {
      const d = new Date(Date.parse(t.posted_at) + 7 * 3_600_000).toISOString().slice(0, 10);
      return d >= from && d <= to;
    })
    .reduce((s, t) => s - t.amount, 0);

  let pancake: { sales: number; revenue: number; fee: number } | null = null;
  let pancakeError: string | null = null;
  if (creds && from <= today) {
    try {
      const [total] = await fetchSaleStats(creds, rangeToPancake({ from, to: statsTo }));
      pancake = {
        sales: total?.result.sales ?? 0,
        revenue: total?.result.revenue ?? 0,
        fee: total?.result.fee_marketplace ?? 0,
      };
    } catch {
      pancakeError = "Không lấy được Doanh thu từ Pancake, thử Tải lại sau.";
    }
  }

  // Mọi thẻ từng dùng (để Chủ shop đặt tên thẻ mới).
  const tagMap = new Map<string, TagInfo>();
  for (const t of allTagged.data ?? []) {
    for (const id of (t.tag_ids as string[]) ?? []) {
      const info = tagMap.get(id) ?? { tagId: id, name: tagNames.get(id) ?? null, sample: t.name as string | null, count: 0 };
      info.count++;
      tagMap.set(id, info);
    }
  }
  for (const [id, name] of tagNames) if (!tagMap.has(id)) tagMap.set(id, { tagId: id, name, sample: null, count: 0 });

  return {
    finance: buildMonthFinance({
      month,
      today,
      pancake,
      cashDays,
      expenses: expenseLines(txs, tagNames, from, to),
      shippingFeePaid,
      ads: null, // Quảng cáo: chưa kết nối (bước 3.2, 3.3)
    }),
    pancakeError,
    tags: [...tagMap.values()].sort((a, b) => Number(a.name !== null) - Number(b.name !== null) || b.count - a.count),
  };
}

import "server-only";
import { getCashDays } from "@/lib/cash/data";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import { addDays, type DateString } from "@/lib/date-range";
import { rangeToPancake } from "@/lib/overview/compute";
import { cachedOrderSources, cachedSaleStats } from "@/lib/pancake/cached";
import { createClient } from "@/lib/supabase/server";
import type { AnySupabase } from "@/lib/supabase/types";
import {
  buildMonthFinance,
  expenseLines,
  isAdsCategory,
  monthRange,
  shippingFeeLines,
  type ExpenseLine,
  type ExpenseTransaction,
  type MonthFinance,
  type MonthString,
  type ShippingFeeLine,
} from "./month";
import { adsByChannel, buildEfficiency, type Efficiency } from "./efficiency";

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

const iso = (d: DateString) => new Date(`${d}T00:00:00+07:00`).toISOString();

/**
 * Tiền CHI trong [from, to] (giờ VN), đọc qua RLS: phiếu chi có thẻ (theo ngày phát sinh)
 * và phí ship trả riêng (theo ngày tạo phiếu).
 */
export async function getCashOut(
  orgId: string,
  from: DateString,
  to: DateString,
  client?: AnySupabase,
): Promise<{ expenses: ExpenseLine[]; shippingFees: ShippingFeeLine[]; tagNames: Map<string, string> }> {
  const supabase = client ?? (await createClient());
  const [txRes, tagRes] = await Promise.all([
    // Phiếu chi có thẻ: lấy rộng ±31 ngày rồi lọc theo ngày phát sinh.
    supabase
      .from("cash_transactions")
      .select("display_id, name, amount, tag_ids, time_incurred, posted_at, status, is_canceled")
      .eq("org_id", orgId)
      .gte("posted_at", iso(addDays(from, -31)))
      .lt("posted_at", iso(addDays(to, 32)))
      .or("tag_ids.neq.{},name.ilike.Thanh toán phí vận chuyển*"),
    supabase.from("expense_tags").select("tag_id, name").eq("org_id", orgId),
  ]);
  if (txRes.error) throw new Error(`Không đọc được phiếu chi: ${txRes.error.message}`);
  const tagNames = new Map((tagRes.data ?? []).map((t) => [t.tag_id as string, t.name as string]));
  const txs = (txRes.data ?? []) as ExpenseTransaction[];
  return {
    expenses: expenseLines(txs, tagNames, from, to),
    shippingFees: shippingFeeLines(txs, from, to),
    tagNames,
  };
}

/** Lợi nhuận kinh doanh + Dòng tiền thực tế của một tháng. `orgId` lấy từ getCurrentOrg(). */
export async function getMonthFinance(orgId: string, month: MonthString, today: DateString): Promise<MonthFinanceData> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);
  const statsTo = to < today ? to : today;

  const [creds, cashDays, cashOut, allTagged] = await Promise.all([
    getPancakeCredentials(orgId),
    getCashDays(orgId, from, to),
    getCashOut(orgId, from, to, supabase),
    supabase.from("cash_transactions").select("tag_ids, name").eq("org_id", orgId).neq("tag_ids", "{}").limit(1000),
  ]);
  const { tagNames } = cashOut;

  let pancake: { sales: number; revenue: number; fee: number; partnerFee: number; capital: number } | null = null;
  let pancakeError: string | null = null;
  const revenueBySource: Record<string, number> = {};
  if (creds && from <= today) {
    try {
      const range = rangeToPancake({ from, to: statsTo });
      const [[total], bySource, sourceNames] = await Promise.all([
        cachedSaleStats(orgId, range),
        cachedSaleStats(orgId, range, "Order.order_sources"),
        cachedOrderSources(orgId),
      ]);
      // Doanh thu từng kênh (Shopee, TikTok…) để so với quảng cáo kênh đó.
      for (const r of bySource) {
        const name = (r.key && sourceNames.get(r.key)) ?? r.key ?? "Khác";
        revenueBySource[name] = (revenueBySource[name] ?? 0) + (r.result.revenue ?? 0);
      }
      pancake = {
        sales: total?.result.sales ?? 0,
        revenue: total?.result.revenue ?? 0,
        fee: total?.result.fee_marketplace ?? 0,
        partnerFee: total?.result.partner_fee ?? 0,
        capital: total?.result.capital ?? 0,
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
      revenueBySource,
      cashDays,
      expenses: cashOut.expenses,
      shippingFeePaid: cashOut.shippingFees.reduce((s, l) => s + l.amount, 0),
      ads: null, // Quảng cáo tự động (API Shopee/TikTok/Meta): chưa kết nối; quảng cáo nhập tay = thẻ "Quảng cáo …"
      hasAdsTags: [...tagNames.values()].some(isAdsCategory),
    }),
    pancakeError,
    tags: [...tagMap.values()].sort((a, b) => Number(a.name !== null) - Number(b.name !== null) || b.count - a.count),
  };
}

export interface MonthEfficiencyData {
  efficiency: Efficiency | null;
  error: string | null;
}

/**
 * "Hiệu quả kinh doanh" của một tháng (khối Tổng quan): số Pancake của tháng (tới hôm nay nếu đang chạy)
 * + phiếu chi có thẻ. `orgId` lấy từ getCurrentOrg().
 */
export async function getMonthEfficiency(orgId: string, month: MonthString, today: DateString): Promise<MonthEfficiencyData> {
  const { from, to } = monthRange(month);
  const [creds, cashOut] = await Promise.all([getPancakeCredentials(orgId), getCashOut(orgId, from, to)]);
  if (!creds) return { efficiency: null, error: "Shop chưa kết nối Pancake POS." };
  try {
    const [total] = await cachedSaleStats(orgId, rangeToPancake({ from, to: to < today ? to : today }));
    return {
      efficiency: buildEfficiency({
        pancakeRevenue: total?.result.revenue ?? 0,
        fee: total?.result.fee_marketplace ?? 0,
        partnerFee: total?.result.partner_fee ?? 0,
        capital: total?.result.capital ?? 0,
        expenses: cashOut.expenses,
      }),
      error: null,
    };
  } catch {
    return { efficiency: null, error: "Không lấy được số liệu từ Pancake, thử Tải lại sau." };
  }
}

/** Chi phí quảng cáo theo kênh (thẻ "Quảng cáo …") trong khoảng ngày, cho bảng Nguồn đơn. */
export async function getAdsByChannel(orgId: string, from: DateString, to: DateString): Promise<Map<string, number>> {
  const { expenses } = await getCashOut(orgId, from, to);
  return adsByChannel(expenses, from, to);
}

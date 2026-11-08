import "server-only";
import type { DateString } from "@/lib/date-range";
import { createClient } from "@/lib/supabase/server";
import { rangeToPancake } from "@/lib/overview/compute";
import { cachedSaleStats } from "@/lib/pancake/cached";
import { taxCalendar, thresholdWarning, type TaxReportPart } from "./calendar";
import { analyzeInvoices, type InvoiceLite, type OrderLite } from "./invoices";
import { pickRule, ruleFromDb, type TaxRule, type TaxSettings } from "./rules";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const PAGE = 1000;

/** PostgREST trả tối đa 1.000 dòng mỗi lần: đếm trước rồi lấy các trang song song. */
async function fetchAll<T>(build: (s: Supabase) => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }, count: number, supabase: Supabase): Promise<T[]> {
  const pages = Math.ceil(count / PAGE);
  const res = await Promise.all(Array.from({ length: pages }, (_, i) => build(supabase).range(i * PAGE, i * PAGE + PAGE - 1)));
  const err = res.find((r) => r.error);
  if (err?.error) throw new Error(err.error.message);
  return res.flatMap((r) => r.data ?? []);
}

const ORDER_COLUMNS =
  "system_id, order_id, source, status, delivered_at, returned_at, partial_returned_at, total_price, total_discount, shipping_fee, total_after_discount, fee_marketplace";

function orderFromDb(r: Record<string, unknown>): OrderLite {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    systemId: String(r.system_id),
    orderId: r.order_id as string,
    source: (r.source as string | null) ?? null,
    status: n(r.status),
    deliveredAt: (r.delivered_at as string | null) ?? null,
    returnedAt: (r.returned_at as string | null) ?? null,
    partialReturnedAt: (r.partial_returned_at as string | null) ?? null,
    totalPrice: n(r.total_price),
    totalDiscount: n(r.total_discount),
    shippingFee: n(r.shipping_fee),
    totalAfterDiscount: n(r.total_after_discount),
    feeMarketplace: n(r.fee_marketplace),
  };
}

function invoiceFromDb(r: Record<string, unknown>): InvoiceLite {
  return {
    id: Number(r.einvoice_id),
    invoiceNo: (r.invoice_no as string | null) ?? null,
    series: (r.invoice_series as string | null) ?? null,
    status: Number(r.status),
    orderSystemId: (r.order_system_id as string | null) ?? null,
    originalId: r.original_einvoice_id == null ? null : Number(r.original_einvoice_id),
    totalAmount: Number(r.total_amount ?? 0),
    releasedAt: (r.released_at as string | null) ?? null,
  };
}

export interface TaxContext {
  settings: TaxSettings | null;
  rules: TaxRule[];
  rule: TaxRule | null;
}

/** Cấu hình thuế của shop + quy định đang áp dụng. */
export async function getTaxContext(orgId: string, today: DateString, client?: Supabase): Promise<TaxContext> {
  const supabase = client ?? (await createClient());
  const [s, r] = await Promise.all([
    supabase.from("tax_settings").select("business_type, prior_year_revenue").eq("org_id", orgId).maybeSingle(),
    supabase.from("tax_rules").select("*").order("effective_from"),
  ]);
  const settings: TaxSettings | null = s.data ? { businessType: s.data.business_type, priorYearRevenue: Number(s.data.prior_year_revenue) } : null;
  const rules = (r.data ?? []).map(ruleFromDb);
  return { settings, rules, rule: settings ? pickRule(rules, settings, today) : null };
}

/**
 * Hóa đơn 3 tháng gần nhất (từ mùng 1 của 2 tháng trước) đối chiếu với đơn khách đã nhận.
 * Đọc qua RLS (chỉ Chủ / Quản lý) – người gọi dùng getManagerOrg() trước; lịch 8:00 truyền `client` khóa secret.
 */
export async function getInvoiceOverview(orgId: string, today: DateString, ctx: TaxContext, client?: Supabase) {
  const supabase = client ?? (await createClient());
  const m = Number(today.slice(5, 7));
  const y = Number(today.slice(0, 4));
  const fm = m - 2 <= 0 ? m + 10 : m - 2;
  const fy = m - 2 <= 0 ? y - 1 : y;
  const from = `${fy}-${String(fm).padStart(2, "0")}-01`;
  const fromIso = new Date(`${from}T00:00:00+07:00`).toISOString();

  const [oc, ic, sync] = await Promise.all([
    supabase.from("orders").select("order_id", { count: "exact", head: true }).eq("org_id", orgId).gte("delivered_at", fromIso),
    supabase.from("einvoices").select("einvoice_id", { count: "exact", head: true }).eq("org_id", orgId).gte("released_at", fromIso),
    supabase.from("sync_state").select("einvoices_synced_at").eq("org_id", orgId).maybeSingle(),
  ]);
  const [orderRows, invoiceRows] = await Promise.all([
    fetchAll((s) => s.from("orders").select(ORDER_COLUMNS).eq("org_id", orgId).gte("delivered_at", fromIso).order("order_id"), oc.count ?? 0, supabase),
    fetchAll(
      (s) =>
        s
          .from("einvoices")
          .select("einvoice_id, invoice_no, invoice_series, status, order_system_id, original_einvoice_id, total_amount, released_at")
          .eq("org_id", orgId)
          .gte("released_at", fromIso)
          .order("einvoice_id"),
      ic.count ?? 0,
      supabase,
    ),
  ]);
  const orders = (orderRows as Record<string, unknown>[]).map(orderFromDb);
  const invoices = (invoiceRows as Record<string, unknown>[]).map(invoiceFromDb);

  // Đơn có hóa đơn nhưng chưa từng "Đã nhận" trong khoảng (đơn hủy…): lấy thêm để xét điều chỉnh.
  const known = new Set(orders.map((o) => o.systemId));
  const extra = [...new Set(invoices.map((i) => i.orderSystemId).filter((x): x is string => !!x && !known.has(x)))];
  for (let i = 0; i < extra.length; i += 200) {
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).eq("org_id", orgId).in("system_id", extra.slice(i, i + 200));
    orders.push(...(data ?? []).map(orderFromDb));
  }

  const period = ctx.rule?.vatPeriod ?? "quarter";
  return {
    from,
    syncedAt: (sync.data?.einvoices_synced_at as string | null) ?? null,
    invoiceCount: invoices.length,
    ...analyzeInvoices({ orders, invoices, today, period, from }),
  };
}

/**
 * Doanh thu xét ngưỡng thuế trong khoảng ngày = Doanh thu Pancake + phí sàn (chủ dự án chốt 08/11/2026).
 * Lấy thẳng /analytics/sale (khớp Pancake). null = không lấy được.
 */
export async function taxRevenue(orgId: string, from: DateString, to: DateString): Promise<number | null> {
  try {
    const [row] = await cachedSaleStats(orgId, rangeToPancake({ from, to }));
    return Math.round((row?.result.revenue ?? 0) + (row?.result.fee_marketplace ?? 0));
  } catch {
    return null;
  }
}

/** Mọi thứ về thuế của hôm nay: quy định, hóa đơn, lịch, cảnh báo ngưỡng. */
export async function getTaxSummary(orgId: string, today: DateString, client?: Supabase) {
  const ctx = await getTaxContext(orgId, today, client);
  const year = today.slice(0, 4);
  const [inv, ytd] = await Promise.all([getInvoiceOverview(orgId, today, ctx, client), taxRevenue(orgId, `${year}-01-01`, today)]);
  const events = taxCalendar({ today, rule: ctx.rule, adjust: inv.adjust });
  const warning =
    ctx.settings && ytd !== null ? thresholdWarning({ today, ytd, settings: ctx.settings, rules: ctx.rules, rule: ctx.rule }) : null;
  return { ctx, inv, ytd, events, warning };
}

/** Phần Thuế trong báo cáo 8:00 gần nhất (cho Tổng quan – nhẹ). Đọc qua RLS. */
export async function latestTaxPart(orgId: string): Promise<{ part: TaxReportPart | null; date: DateString | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select("report_date, data")
    .eq("org_id", orgId)
    .not("data->tax", "is", null)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const part = ((data?.data as { tax?: TaxReportPart | null } | undefined)?.tax ?? null) as TaxReportPart | null;
  return { part, date: (data?.report_date as string | undefined) ?? null };
}

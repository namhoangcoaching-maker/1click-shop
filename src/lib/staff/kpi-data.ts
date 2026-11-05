import "server-only";
import { addDays, type DateString } from "@/lib/date-range";
import { monthRange } from "@/lib/finance/month";
import { rangeToPancake } from "@/lib/overview/compute";
import { cachedSaleStats } from "@/lib/pancake/cached";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentFromDb,
  assignmentsFor,
  kpiActual,
  kpiOutcome,
  templateFromDb,
  type KpiAssignment,
  type KpiOutcome,
  type KpiTemplate,
  type RevenueContext,
} from "./kpi";
import { manualKpiActual } from "./work-plan";

export interface PersonKpi {
  assignment: KpiAssignment;
  template: KpiTemplate;
  outcome: KpiOutcome;
  /** Ghi chú kết quả nhập tay. */
  note: string | null;
  /** Số Quản lý nhập cho cả tháng (thắng tổng báo cáo ngày). */
  managerValue: number | null;
  /** Tổng số trong các báo cáo ngày của tháng. */
  dailySum: number | null;
}

export interface KpiPerson {
  userId: string;
  department: string | null;
  sellerId: string | null;
}

export interface KpiMonth {
  templates: KpiTemplate[];
  assignments: KpiAssignment[];
  /** KPI từng người (chỉ những người truyền vào). */
  byUser: Map<string, PersonKpi[]>;
  /** Tổng tiền KPI từng người (thưởng − phạt). */
  totalByUser: Map<string, number>;
  pancakeError: string | null;
}

/**
 * KPI tháng `month` của những người `people` (người gọi đã kiểm tra quyền xem họ).
 * Mẫu, KPI gắn, kết quả nhập tay đọc qua RLS (Nhân viên chỉ ra KPI của mình / bộ phận mình).
 * Doanh thu Pancake chỉ lấy khi có KPI cần tới, tính từ đầu tháng tới hôm nay (tháng cũ: cả tháng).
 */
export async function getKpiMonth(orgId: string, month: string, today: DateString, people: KpiPerson[]): Promise<KpiMonth> {
  const supabase = await createClient();
  const { from: mFrom, to: mTo } = monthRange(month);
  const [tRes, aRes, rRes, dRes] = await Promise.all([
    supabase.from("kpi_templates").select("*").eq("org_id", orgId).order("created_at"),
    supabase.from("kpi_assignments").select("id, template_id, user_id, department, target").eq("org_id", orgId).order("created_at"),
    supabase.from("kpi_results").select("assignment_id, user_id, actual, note").eq("org_id", orgId).eq("month", `${month}-01`),
    // Số KPI nhập tay theo ngày (báo cáo cuối ngày, 6.5) – cộng dồn thành kết quả tháng.
    supabase.from("kpi_daily").select("assignment_id, user_id, value").eq("org_id", orgId).gte("work_date", mFrom).lte("work_date", mTo),
  ]);
  const dailySum = new Map<string, number>();
  for (const r of dRes.data ?? []) {
    const k = `${r.assignment_id}|${r.user_id}`;
    dailySum.set(k, (dailySum.get(k) ?? 0) + Number(r.value));
  }
  if (tRes.error || aRes.error) throw new Error(`Không đọc được KPI: ${(tRes.error ?? aRes.error)!.message}`);
  const templates = (tRes.data ?? []).map(templateFromDb);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const assignments = (aRes.data ?? []).map(assignmentFromDb).filter((a) => byId.has(a.templateId));
  const manual = new Map((rRes.data ?? []).map((r) => [`${r.assignment_id}|${r.user_id}`, { actual: Number(r.actual), note: r.note as string | null }]));

  // KPI áp cho từng người (bỏ mẫu đã ngừng dùng).
  const perPerson = people.map((p) => ({
    p,
    list: assignmentsFor(assignments, p.userId, p.department).filter((a) => !byId.get(a.templateId)!.archived),
  }));
  const sources = new Set(perPerson.flatMap(({ list }) => list.map((a) => byId.get(a.templateId)!.source)));

  // Doanh thu Pancake cần thiết (song song).
  const { from, to } = monthRange(month);
  const ctx: RevenueContext = { shop: null, bySource: null, bySeller: null };
  let pancakeError: string | null = null;
  if (from <= today && [...sources].some((s) => s !== "manual")) {
    const range = rangeToPancake({ from, to: to < today ? to : today });
    const revenueMap = (rows: Awaited<ReturnType<typeof cachedSaleStats>>) =>
      new Map(rows.filter((r) => r.key !== null).map((r) => [r.key!, r.result.revenue ?? 0]));
    const jobs = await Promise.allSettled([
      sources.has("shop_revenue") ? cachedSaleStats(orgId, range) : Promise.resolve(null),
      sources.has("channel_revenue") ? cachedSaleStats(orgId, range, "Order.order_sources") : Promise.resolve(null),
      sources.has("seller_revenue") ? cachedSaleStats(orgId, range, "Order.assigning_seller_id") : Promise.resolve(null),
    ]);
    const [shop, src, seller] = jobs.map((j) => (j.status === "fulfilled" ? j.value : null));
    if (shop) ctx.shop = shop[0]?.result.revenue ?? 0;
    if (src) ctx.bySource = revenueMap(src);
    if (seller) ctx.bySeller = revenueMap(seller);
    if (jobs.some((j) => j.status === "rejected")) pancakeError = "Không lấy được doanh thu từ Pancake, KPI doanh thu tạm chưa tính. Thử tải lại sau.";
  }

  const byUser = new Map<string, PersonKpi[]>();
  const totalByUser = new Map<string, number>();
  for (const { p, list } of perPerson) {
    const items = list.map((a) => {
      const template = byId.get(a.templateId)!;
      const key = `${a.id}|${p.userId}`;
      const m = manual.get(key);
      const daily = dailySum.get(key) ?? null;
      const actual = kpiActual(template, ctx, { sellerId: p.sellerId, manual: manualKpiActual(m?.actual, daily) });
      return {
        assignment: a,
        template,
        outcome: kpiOutcome(template, a.target, actual),
        note: m?.note ?? null,
        managerValue: m?.actual ?? null,
        dailySum: daily,
      };
    });
    byUser.set(p.userId, items);
    totalByUser.set(p.userId, items.reduce((s, k) => s + k.outcome.amount, 0));
  }
  return { templates, assignments, byUser, totalByUser, pancakeError };
}

/** Ngày cuối cùng đã tính doanh thu cho KPI của tháng (để ghi chú "tính tới ngày …"). */
export function kpiDataUntil(month: string, today: DateString): DateString {
  const { to } = monthRange(month);
  return to < today ? to : addDays(today, 0);
}

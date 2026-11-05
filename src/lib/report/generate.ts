import "server-only";
import { getCashDays } from "@/lib/cash/data";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import { addDays, todayInVN, type DateString } from "@/lib/date-range";
import { toPlanItems } from "@/lib/inventory/incoming";
import { getIncoming } from "@/lib/inventory/incoming-db";
import { buildOrderPlan } from "@/lib/inventory/plan";
import { getRealInventory } from "@/lib/inventory/real-data";
import { getRulesForOrg } from "@/lib/inventory/settings-db";
import { fetchPancakeOverview } from "@/lib/overview/pancake-fetch";
import type { PancakeOverview } from "@/lib/overview/pancake-stats";
import { PancakeError } from "@/lib/pancake/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildDailyReport, reportDateToShow, withFreshYesterday, type DailyReport } from "./build";

/**
 * Lập báo cáo hôm nay cho MỘT shop và lưu lại (ghi đè nếu đã có).
 * Dùng khóa secret nên NGƯỜI GỌI phải bảo đảm orgId đúng (lịch 8:00 hoặc getCurrentOrg).
 */
export async function generateDailyReport(orgId: string, now = new Date()): Promise<DailyReport> {
  const admin = createAdminClient();
  const today = todayInVN(now);

  const [creds, rules, incoming] = await Promise.all([
    getPancakeCredentials(orgId),
    getRulesForOrg(admin, orgId),
    getIncoming(orgId, admin),
  ]);
  const [inventory, cashDays] = await Promise.all([
    getRealInventory(orgId, rules.velocityWindowDays, now, admin),
    getCashDays(orgId, today, addDays(today, 7), admin),
  ]);

  let stats: PancakeOverview | null = null;
  let statsError: string | null = creds ? null : "Shop chưa kết nối Pancake POS.";
  if (creds) {
    try {
      stats = await fetchYesterday(orgId, today);
    } catch (err) {
      statsError = err instanceof PancakeError ? err.message : "Không lấy được số liệu từ Pancake lúc lập báo cáo.";
    }
  }

  const active = inventory.items.filter((i) => !i.inactive);
  const plan = buildOrderPlan(toPlanItems(active, incoming, rules.velocityWindowDays, today), today, rules);
  const byId = new Map(inventory.items.map((i) => [i.id, i]));
  const report = buildDailyReport({
    today,
    now,
    stats,
    statsError,
    cashDays,
    plan,
    missingCost: active.filter((i) => i.costPrice === null && i.stock > 0).length,
    incomingToday: incoming
      .filter((r) => r.eta === today)
      .map((r) => {
        const it = byId.get(r.variation_id);
        return { product: it?.name ?? "Mã đã xóa", variant: it ? (it.variant ?? it.sku) : "", quantity: r.quantity };
      }),
  });

  const { error } = await admin
    .from("daily_reports")
    .upsert({ org_id: orgId, report_date: today, data: report, created_at: now.toISOString() }, { onConflict: "org_id,report_date" });
  if (error) throw new Error(`Không lưu được báo cáo: ${error.message}`);
  return report;
}

/** Thống kê Pancake của "hôm qua" so với "hôm kia" tính từ ngày báo cáo (giống lúc lập lúc 8:00). */
async function fetchYesterday(orgId: string, reportDate: DateString): Promise<PancakeOverview> {
  const yesterday = addDays(reportDate, -1);
  return fetchPancakeOverview(
    orgId,
    { from: yesterday, to: yesterday },
    { from: addDays(yesterday, -1), to: addDays(yesterday, -1) },
    false,
  );
}

/**
 * Báo cáo để XEM: phần "Hôm qua" lấy lại số mới từ Pancake ngay lúc này (đơn hủy sau 8:00 bị Pancake rút
 * khỏi ngày tạo đơn), phần còn lại giữ như lúc 8:00. Không ghi đè bản đã lưu. Pancake lỗi → giữ số cũ + ghi chú.
 * `orgId` phải lấy từ getCurrentOrg().
 */
export async function refreshYesterday(orgId: string, report: DailyReport, now = new Date()): Promise<DailyReport> {
  try {
    const creds = await getPancakeCredentials(orgId);
    if (!creds) return report;
    return withFreshYesterday(report, await fetchYesterday(orgId, report.date), now);
  } catch {
    return withFreshYesterday(report, null, now);
  }
}

/** Giờ hiện tại theo giờ Việt Nam (0–23). */
export function vnHour(now: Date): number {
  return new Date(now.getTime() + 7 * 3_600_000).getUTCHours();
}

/**
 * Báo cáo để hiện trên web: từ 8:00 là báo cáo hôm nay, trước 8:00 là của hôm qua.
 * Phần "Hôm qua" luôn lấy lại số mới từ Pancake (refreshYesterday). Đọc qua RLS. Nếu đã quá 8:00 mà lịch tự động chưa lập (máy chủ lỗi…) thì lập ngay lúc này;
 * thiếu báo cáo của ngày đó thì hiện báo cáo gần nhất trước đó.
 * `orgId` phải lấy từ getCurrentOrg().
 */
export async function getReportToShow(orgId: string, now = new Date()): Promise<DailyReport | null> {
  const supabase = await createClient();
  const date: DateString = reportDateToShow(todayInVN(now), vnHour(now));
  // Báo cáo mới nhất tới ngày cần xem (thiếu ngày đó thì hiện ngày gần nhất trước đó).
  const { data } = await supabase
    .from("daily_reports")
    .select("report_date, data")
    .eq("org_id", orgId)
    .lte("report_date", date)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data && data.report_date === date) return refreshYesterday(orgId, data.data as DailyReport, now);
  if (date === todayInVN(now)) {
    // Đã quá 8:00 mà lịch tự động chưa lập (máy chủ lỗi…): lập ngay.
    try {
      return await generateDailyReport(orgId, now); // vừa lập: số đã mới
    } catch {
      /* lập không được thì hiện bản gần nhất */
    }
  }
  return data ? refreshYesterday(orgId, data.data as DailyReport, now) : null;
}

/** Danh sách báo cáo gần đây (trang Báo cáo). */
export async function getRecentReports(orgId: string, limit = 30): Promise<DailyReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select("data")
    .eq("org_id", orgId)
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Không đọc được báo cáo: ${error.message}`);
  return (data ?? []).map((r) => r.data as DailyReport);
}

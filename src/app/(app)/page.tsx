import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import {
  BadgeDollarSignIcon,
  ChartLineIcon,
  MegaphoneIcon,
  PlugIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";
import { CashInPanel } from "@/components/cash/cash-in";
import { DailyReportCard } from "@/components/report/daily-report";
import { DataWarnings, type DataIssue } from "@/components/dashboard/data-warning";
import { DateFilter } from "@/components/dashboard/date-filter";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Skeleton } from "@/components/dashboard/stat-card";
import { BusinessEfficiency } from "@/components/overview/business-efficiency";
import { OrderSources } from "@/components/overview/order-sources";
import { Recommendations } from "@/components/overview/recommendations";
import { SummaryCards } from "@/components/overview/summary-cards";
import { TopProducts } from "@/components/overview/top-products";
import { addDays, compareLabel, formatDateTimeVN, formatRangeVN, resolveFilter, todayInVN } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { toPlanItems } from "@/lib/inventory/incoming";
import { getIncoming } from "@/lib/inventory/incoming-db";
import { buildOrderPlan } from "@/lib/inventory/plan";
import { getCashDays } from "@/lib/cash/data";
import { getShopStockRules } from "@/lib/inventory/settings-db";
import { analyzeInventory, summarizeInventory, type StockAnalysis } from "@/lib/inventory/stock";
import { getManagerOrg } from "@/lib/org/guard";
import { getOverviewStats, getOverviewStock } from "@/lib/overview/real-data";
import { buildRecommendations } from "@/lib/overview/recommendations";
import { getReportToShow } from "@/lib/report/generate";
import { buildSourceGroups } from "@/lib/finance/efficiency";
import { getAdsByChannel, getMonthEfficiency } from "@/lib/finance/data";
import { recentMonths, resolveMonth } from "@/lib/finance/month";
import { TaxSummaryPanel } from "@/components/tax/tax-summary";
import { taxCalendar } from "@/lib/tax/calendar";
import { getTaxContext, latestTaxPart } from "@/lib/tax/data";

export const metadata: Metadata = { title: "Tổng quan" };

const INVENTORY_HREF = "/ton-kho";
const PANCAKE_URL = "https://pos.pages.fm";

/** "Dữ liệu cần kiểm tra": tự phát hiện từ dữ liệu Pancake đã đồng bộ. */
function dataIssues(unlinkedQty: number, stock: StockAnalysis[]): DataIssue[] {
  const noCost = stock.filter((a) => a.item.costPrice === null && a.item.stock > 0);
  const issues: DataIssue[] = [];
  if (noCost.length > 0) {
    issues.push({
      title: `${noCost.length} mã còn hàng chưa có giá vốn`,
      impact: "Lợi nhuận bị tính cao hơn thực tế, giá trị tồn kho bị thiếu.",
      howToFix: "Vào Pancake POS → Sản phẩm, mở từng mã dưới đây và nhập giá nhập (giá vốn).",
      items: noCost.map((a) => `${a.item.name}${a.item.variant ? ` · ${a.item.variant}` : ""} (${a.item.sku})`),
      fixUrl: PANCAKE_URL,
    });
  }
  if (unlinkedQty > 0) {
    issues.push({
      title: `${formatNumber(unlinkedQty)} sản phẩm bán ra chưa liên kết`,
      impact: "Dòng hàng trong đơn không gắn với mã sản phẩm nào (hoặc mã đã xóa): không trừ tồn, không có giá vốn, không vào Top sản phẩm.",
      howToFix: "Vào Pancake POS → Sản phẩm kênh bán (Shopee, TikTok…), liên kết từng sản phẩm sàn với sản phẩm trong kho.",
      fixUrl: PANCAKE_URL,
    });
  }
  return issues;
}

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Tổng quan</h1>
      {/* Báo cáo 8:00 (tải riêng, song song với phần số liệu bên dưới). */}
      <Suspense fallback={<Skeleton className="h-12 bg-card" />}>
        <MorningReport />
      </Suspense>

      {/* Phần phụ thuộc ngày hôm nay và bộ lọc: tải sau, hiện khung xám trong lúc chờ. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Tham số chung cho các khối của Tổng quan (chuỗi để React `cache` nhận ra cùng một lần gọi). */
interface Ctx {
  orgId: string;
  today: string;
  nowIso: string;
  from: string;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
}

/** Cấu hình tồn kho: chỉ đọc một lần cho cả trang. */
const loadRules = cache(async () => (await getShopStockRules()).rules);
const loadStats = (c: Ctx) => getOverviewStats(c.orgId, c.from, c.to, c.prevFrom, c.prevTo);
const loadStock = async (c: Ctx) => {
  const rules = await loadRules();
  return getOverviewStock(c.orgId, c.from, c.to, rules.velocityWindowDays, c.nowIso);
};

async function Overview({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // "Hôm nay" thay đổi theo thời điểm mở trang, nên phần này không được dựng sẵn trước.
  await connection();
  const org = await getManagerOrg();
  if (!org) return null; // Dải "chưa gắn vào shop" đã hiện ở đầu trang.

  const now = new Date();
  const today = todayInVN(now);
  const params = await searchParams;
  const filter = resolveFilter(params, today);
  const ctx: Ctx = {
    orgId: org.id,
    today,
    nowIso: now.toISOString(),
    from: filter.range.from,
    to: filter.range.to,
    prevFrom: filter.previousRange?.from ?? null,
    prevTo: filter.previousRange?.to ?? null,
  };
  // Bắt đầu hỏi số Pancake và tồn kho NGAY, song song; các khối bên dưới dùng lại kết quả (không hỏi lại).
  void loadStats(ctx);
  void loadStock(ctx).catch(() => {});

  // Giữ bộ lọc ngày khi bấm đổi tháng ở khối Hiệu quả kinh doanh.
  const keep = Object.fromEntries(
    Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "hq"),
  );
  const datesText = filter.previousRange
    ? `${formatRangeVN(filter.range)} · so với ${formatRangeVN(filter.previousRange)}`
    : formatRangeVN(filter.range);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateFilter
          preset={filter.preset}
          compare={filter.compare}
          previousLabel={compareLabel(filter.range, "previous")}
          datesText={datesText}
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Số tiền lấy trực tiếp từ Pancake · tồn kho cập nhật{" "}
            <Suspense fallback="…">
              <SyncedAt ctx={ctx} />
            </Suspense>
          </span>
          <RefreshButton />
        </div>
      </div>

      {/* Mỗi khối tải riêng: khối nào có số trước hiện trước. */}
      <Suspense fallback={<Skeleton className="h-56 bg-card" />}>
        <AdviceSection ctx={ctx} />
      </Suspense>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Suspense fallback={<Skeleton className="h-[640px] bg-card" />}>
            <BusinessSection ctx={ctx} />
          </Suspense>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Suspense fallback={<Skeleton className="h-80 bg-card" />}>
              <MonthEfficiency orgId={org.id} today={today} hq={params.hq} params={keep} />
            </Suspense>
            <NoDataPanel
              title="Chi phí quảng cáo"
              icon={MegaphoneIcon}
              stage="Giai đoạn 3"
              note="Tạm nhập bằng phiếu chi thẻ “Quảng cáo …” trên Pancake (xem cột Chi phí ads ở Nguồn đơn); sau sẽ lấy tự động."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Suspense fallback={<Skeleton className="h-48 bg-card" />}>
              <CashInSection ctx={ctx} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-80 bg-card" />}>
              <TopProductsSection ctx={ctx} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-48 bg-card" />}>
              <TaxSection />
            </Suspense>
          </div>

          <NoDataPanel title="Content" icon={VideoIcon} stage="Giai đoạn 4" note="Bài đăng nhiều lượt xem nhất trên Facebook, TikTok, Instagram, YouTube." />
        </div>

        <aside className="min-w-0 space-y-4">
          <NoDataPanel
            title="Nhân sự"
            icon={UsersIcon}
            stage="Giai đoạn 6"
            note="Chấm công, KPI, lương tạm tính, hiệu suất theo nhân viên."
          />
          <Panel title="Cách tính" icon={BadgeDollarSignIcon} tone="blue">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Doanh số, Doanh thu, Lợi nhuận, Đơn chốt, GTTB, Phí sàn, Nguồn đơn, Top sản phẩm: lấy nguyên từ Thống kê của Pancake, nên luôn khớp Pancake.</li>
              <li>Số Pancake được nhớ tạm khoảng 2 phút cho trang mở nhanh; bấm “Tải lại” để lấy số mới ngay.</li>
              <li>Hàng chốt / Hàng hoàn: “Số lượng” là số sản phẩm, giống Pancake.</li>
              <li>Lợi nhuận ở dải Kinh doanh và Nguồn đơn theo Pancake (đã trừ giá vốn, chưa trừ quảng cáo, lương…). Khối Hiệu quả kinh doanh trừ thêm lương, quay chụp, quảng cáo, chi phí khác; tiền trả xưởng (Sản xuất) xem ở Dòng tiền.</li>
              <li>Tồn kho và báo động sản xuất: 1Click tính từ dữ liệu đồng bộ mỗi 30 phút.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}

async function SyncedAt({ ctx }: { ctx: Ctx }) {
  const { syncedAt } = await loadStock(ctx);
  return syncedAt ? formatDateTimeVN(syncedAt) : "—";
}

/** Đề xuất, dữ liệu cần kiểm tra, thẻ hàng chốt/hoàn/tồn kho: cần cả số Pancake và tồn kho. */
async function AdviceSection({ ctx }: { ctx: Ctx }) {
  const [rules, { stats, statsError, connected }, stockData, incoming] = await Promise.all([
    loadRules(),
    loadStats(ctx),
    loadStock(ctx),
    getIncoming(ctx.orgId),
  ]);

  if (!connected && stockData.stock.length === 0) {
    return (
      <Panel title="Chưa có dữ liệu" icon={PlugIcon} tone="slate">
        <p className="text-sm text-muted-foreground">
          Shop chưa kết nối Pancake POS. Vào{" "}
          <Link href="/ket-noi" className="text-primary hover:underline">
            Kết nối
          </Link>{" "}
          để dán khóa API rồi bấm “Đồng bộ ngay”.
        </p>
      </Panel>
    );
  }

  const today = ctx.today;
  const active = stockData.stock.filter((i) => !i.inactive);
  const stock = analyzeInventory(active, today, rules);
  const inventory = summarizeInventory(active);
  const plan = buildOrderPlan(toPlanItems(active, incoming, rules.velocityWindowDays, today), today, rules);
  const urgentPlan = plan.urgent.filter((p) => !p.slow);
  const nextDay = plan.days[0]; // chỉ nhắc ngày đặt gần nhất
  const revenue = stats?.metrics.find((m) => m.key === "revenue")?.value ?? 0;
  const recommendations = buildRecommendations({
    totalRevenue: revenue,
    topProducts: stats?.topProducts ?? [],
    adCosts: [],
    stock,
    inventoryHref: INVENTORY_HREF,
    plan: {
      urgent: urgentPlan,
      nextDay: nextDay && {
        label: nextDay.day.label,
        date: nextDay.day.date,
        products: nextDay.products.filter((p) => !p.slow),
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Recommendations items={recommendations} />
        <DataWarnings issues={dataIssues(stockData.unlinkedQty, stock)} />
      </div>

      {statsError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {statsError}
        </p>
      )}

      {stats && (
        <SummaryCards
          closed={stats.closedOrders}
          returned={stats.returnedOrders}
          inventory={inventory}
          urgentCount={urgentPlan.length}
          inventoryHref={INVENTORY_HREF}
        />
      )}
    </div>
  );
}

/** Dải Kinh doanh + bảng Nguồn đơn (chỉ cần số Pancake + chi phí ads, không chờ tồn kho). */
async function BusinessSection({ ctx }: { ctx: Ctx }) {
  const [{ stats }, ads] = await Promise.all([
    loadStats(ctx),
    getAdsByChannel(ctx.orgId, ctx.from, ctx.to).catch(() => new Map<string, number>()),
  ]);
  if (!stats) return null;
  return (
    <div className="space-y-4">
      <Panel title="Kinh doanh" icon={ChartLineIcon}>
        <MetricStrip metrics={stats.metrics} />
      </Panel>
      <OrderSources groups={buildSourceGroups(stats.sources, ads)} />
    </div>
  );
}

async function TopProductsSection({ ctx }: { ctx: Ctx }) {
  const { stats } = await loadStats(ctx);
  return <TopProducts products={stats?.topProducts ?? []} />;
}

async function CashInSection({ ctx }: { ctx: Ctx }) {
  const days = await getCashDays(ctx.orgId, ctx.today, addDays(ctx.today, 7));
  return <CashInPanel days={days} today={ctx.today} />;
}

/** Khối Hiệu quả kinh doanh: theo tháng (?hq=YYYY-MM), tải riêng để không làm chậm phần còn lại. */
async function MonthEfficiency({
  orgId,
  today,
  hq,
  params,
}: {
  orgId: string;
  today: string;
  hq: string | string[] | undefined;
  params: Record<string, string>;
}) {
  const month = resolveMonth(hq, today);
  const { efficiency, error } = await getMonthEfficiency(orgId, month, today);
  return (
    <BusinessEfficiency data={efficiency} error={error} month={month} months={recentMonths(today, 6)} params={params} />
  );
}

async function MorningReport() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  return <DailyReportCard report={await getReportToShow(org.id)} />;
}

/** Khối Thuế: lịch tính trực tiếp + số hóa đơn của báo cáo 8:00 gần nhất. */
async function TaxSection() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const today = todayInVN();
  const [ctx, latest] = await Promise.all([getTaxContext(org.id, today), latestTaxPart(org.id)]);
  return (
    <TaxSummaryPanel today={today} events={taxCalendar({ today, rule: ctx.rule, adjust: [] })} part={latest.part} reportDate={latest.date} />
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-64 bg-card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 bg-card" />
        <Skeleton className="h-96 bg-card" />
      </div>
    </div>
  );
}

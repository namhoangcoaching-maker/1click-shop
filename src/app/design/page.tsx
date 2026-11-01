import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChartLineIcon } from "lucide-react";
import { DataWarnings, type DataIssue } from "@/components/dashboard/data-warning";
import { DateFilter } from "@/components/dashboard/date-filter";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { Panel } from "@/components/dashboard/panel";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Skeleton } from "@/components/dashboard/stat-card";
import { AdCosts } from "@/components/overview/ad-costs";
import { CashflowSummary } from "@/components/overview/cashflow-summary";
import { OrderSources } from "@/components/overview/order-sources";
import { Recommendations } from "@/components/overview/recommendations";
import { StaffSummary } from "@/components/overview/staff-summary";
import { SummaryCards } from "@/components/overview/summary-cards";
import { TaxSummary } from "@/components/overview/tax-summary";
import { TopContent } from "@/components/overview/top-content";
import { TopProducts } from "@/components/overview/top-products";
import { compareLabel, formatRangeVN, resolveFilter, todayInVN } from "@/lib/date-range";
import { analyzeInventory, summarizeInventory, type InventoryTotals } from "@/lib/inventory/stock";
import { getDemoOverview } from "@/lib/overview/demo-data";
import { buildRecommendations } from "@/lib/overview/recommendations";
import type { OverviewData } from "@/lib/overview/types";

export const metadata: Metadata = { title: "Tổng quan (bản mẫu)" };

const INVENTORY_HREF = "/design/ton-kho";

// Cảnh báo GIẢ cho bản mẫu. Giai đoạn 1 sẽ tự phát hiện từ dữ liệu Pancake.
// Con số lấy từ cùng bộ dữ liệu với các khối bên dưới để không bao giờ lệch nhau.
function demoIssues(data: OverviewData, inventory: InventoryTotals): DataIssue[] {
  return [
    {
      title: `${inventory.missingCost.length} sản phẩm chưa có giá vốn`,
      impact: "Lợi nhuận bị tính cao hơn thực tế, giá trị tồn kho bị thiếu.",
      howToFix: "Vào Pancake POS → Sản phẩm, mở từng sản phẩm dưới đây và nhập Giá vốn.",
      items: inventory.missingCost.map((item) => `${item.name} (${item.sku})`),
      fixUrl: "https://pos.pages.fm",
    },
    {
      title: `${data.staff.unassignedOrders} đơn chưa gán nhân viên`,
      impact: "Các đơn chỉ có “Hệ thống” nên KPI và hiệu suất theo nhân viên đang thiếu.",
      howToFix:
        "Gán nhân viên xử lý cho đơn trên Pancake, hoặc đặt quy tắc tự gán theo kênh ở trang Kết nối (sẽ có ở bước sau).",
      fixUrl: "https://pos.pages.fm",
    },
    {
      title: "4 sản phẩm sàn chưa liên kết",
      impact: "Dòng sản phẩm không tên “-” làm lệch bảng Top sản phẩm.",
      howToFix: "Vào Pancake POS → Sản phẩm kênh bán, liên kết từng sản phẩm sàn với sản phẩm trong kho.",
      items: ["Shopee: Kệ inox góc 2T", "Shopee: Combo 6 móc dán", "TikTok: Kệ dầu gội 304", "TikTok: Giá khăn 60"],
      fixUrl: "https://pos.pages.fm",
    },
  ];
}

export default function OverviewPrototypePage({ searchParams }: PageProps<"/design">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Tổng quan</h1>
        <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning">
          Bản mẫu · số liệu giả
        </span>
      </header>

      {/* Phần phụ thuộc ngày hôm nay và bộ lọc: tải sau, hiện khung xám trong lúc chờ. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/design">, "searchParams">) {
  // "Hôm nay" thay đổi theo thời điểm mở trang, nên phần này không được dựng sẵn trước.
  await connection();
  const today = todayInVN();
  const filter = resolveFilter(await searchParams, today);
  const data = getDemoOverview(filter.range, filter.previousRange, today);
  const totalRevenue = data.sources.reduce((sum, s) => sum + s.revenue.value, 0);
  const stock = analyzeInventory(data.stock, today);
  const inventory = summarizeInventory(data.stock);
  const urgentCount = stock.filter((a) => a.status === "out" || a.status === "urgent").length;
  const recommendations = buildRecommendations({
    totalRevenue,
    topProducts: data.topProducts,
    adCosts: data.adCosts,
    stock,
    inventoryHref: INVENTORY_HREF,
  });

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
        <RefreshButton />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Recommendations items={recommendations} />
        <DataWarnings issues={demoIssues(data, inventory)} />
      </div>

      <SummaryCards
        closed={data.closedOrders}
        returned={data.returnedOrders}
        inventory={inventory}
        urgentCount={urgentCount}
        inventoryHref={INVENTORY_HREF}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Kinh doanh" icon={ChartLineIcon}>
            <MetricStrip metrics={data.metrics} />
          </Panel>

          <OrderSources rows={data.sources} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CashflowSummary cashflow={data.cashflow} />
            <TaxSummary tax={data.tax} today={today} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopProducts products={data.topProducts} />
            <AdCosts channels={data.adCosts} totalRevenue={totalRevenue} />
          </div>

          <TopContent items={data.topContent} />
        </div>

        <aside className="min-w-0">
          <StaffSummary staff={data.staff} today={today} />
        </aside>
      </div>
    </>
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

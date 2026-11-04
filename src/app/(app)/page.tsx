import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  BadgeDollarSignIcon,
  ChartLineIcon,
  FileTextIcon,
  MegaphoneIcon,
  PlugIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
} from "lucide-react";
import { DataWarnings, type DataIssue } from "@/components/dashboard/data-warning";
import { DateFilter } from "@/components/dashboard/date-filter";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Skeleton } from "@/components/dashboard/stat-card";
import { OrderSources } from "@/components/overview/order-sources";
import { Recommendations } from "@/components/overview/recommendations";
import { SummaryCards } from "@/components/overview/summary-cards";
import { TopProducts } from "@/components/overview/top-products";
import { compareLabel, formatDateTimeVN, formatRangeVN, resolveFilter, todayInVN } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { groupStockAlarms } from "@/lib/inventory/alarms";
import { getShopStockRules } from "@/lib/inventory/settings-db";
import { analyzeInventory, summarizeInventory, type StockAnalysis } from "@/lib/inventory/stock";
import { getCurrentOrg } from "@/lib/org/current";
import { getRealOverview, type RealOverview } from "@/lib/overview/real-data";
import { buildRecommendations } from "@/lib/overview/recommendations";

export const metadata: Metadata = { title: "Tổng quan" };

const INVENTORY_HREF = "/ton-kho";
const PANCAKE_URL = "https://pos.pages.fm";

/** Tên mẫu (không lặp lại khi nhiều size cùng mẫu). */
function productNames(list: StockAnalysis[]): string[] {
  return [...new Set(list.map((a) => a.item.name))];
}

/** "Dữ liệu cần kiểm tra": tự phát hiện từ dữ liệu Pancake đã đồng bộ. */
function dataIssues(data: RealOverview, stock: StockAnalysis[], defaultLeadTimeDays: number): DataIssue[] {
  const noLeadTime = productNames(stock.filter((a) => a.leadTimeIsDefault));
  const noCost = stock.filter((a) => a.item.costPrice === null && a.item.stock > 0);
  const issues: DataIssue[] = [];
  if (noLeadTime.length > 0) {
    issues.push({
      title: `${noLeadTime.length} mẫu chưa ghi thời gian sản xuất`,
      impact: `Đang tạm tính ${defaultLeadTimeDays} ngày (số mặc định trong Tồn kho → Cấu hình), báo động sản xuất có thể sớm hoặc muộn hơn thực tế.`,
      howToFix:
        "Vào Pancake POS → Sản phẩm → mở sản phẩm → ô Ghi chú nội bộ, ghi “SX: 15” (15 là số ngày từ lúc đặt xưởng tới lúc hàng về).",
      items: noLeadTime,
      fixUrl: PANCAKE_URL,
    });
  }
  if (noCost.length > 0 || data.qtyWithoutCost > 0) {
    issues.push({
      title: `${noCost.length} mã còn hàng chưa có giá vốn`,
      impact:
        "Lợi nhuận bị tính cao hơn thực tế, giá trị tồn kho bị thiếu" +
        (data.qtyWithoutCost > 0 ? ` (kỳ này có ${formatNumber(data.qtyWithoutCost)} sản phẩm bán ra chưa có giá vốn).` : "."),
      howToFix: "Vào Pancake POS → Sản phẩm, mở từng mã dưới đây và nhập giá nhập (giá vốn).",
      items: noCost.map((a) => `${a.item.name}${a.item.variant ? ` · ${a.item.variant}` : ""} (${a.item.sku})`),
      fixUrl: PANCAKE_URL,
    });
  }
  if (data.unlinkedQty > 0) {
    issues.push({
      title: `${formatNumber(data.unlinkedQty)} sản phẩm bán ra chưa liên kết`,
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
      {/* Phần phụ thuộc ngày hôm nay và bộ lọc: tải sau, hiện khung xám trong lúc chờ. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // "Hôm nay" thay đổi theo thời điểm mở trang, nên phần này không được dựng sẵn trước.
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null; // Dải "chưa gắn vào shop" đã hiện ở đầu trang.

  const now = new Date();
  const today = todayInVN(now);
  const filter = resolveFilter(await searchParams, today);
  const { rules } = await getShopStockRules();
  const data = await getRealOverview(org.id, filter.range, filter.previousRange, rules.velocityWindowDays, now);

  if (!data.hasData) {
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

  const active = data.stock.filter((i) => !i.inactive);
  const stock = analyzeInventory(active, today, rules);
  const inventory = summarizeInventory(active);
  const urgentProducts = groupStockAlarms(stock).length;
  const revenue = data.metrics.find((m) => m.key === "revenue")?.value ?? 0;
  const recommendations = buildRecommendations({
    totalRevenue: revenue,
    topProducts: data.topProducts,
    adCosts: [],
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Pancake cập nhật {data.syncedAt ? formatDateTimeVN(data.syncedAt) : "—"}
          </span>
          <RefreshButton />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Recommendations items={recommendations} />
        <DataWarnings issues={dataIssues(data, stock, rules.defaultLeadTimeDays)} />
      </div>

      <SummaryCards
        closed={data.closedOrders}
        returned={data.returnedOrders}
        inventory={inventory}
        urgentCount={urgentProducts}
        inventoryHref={INVENTORY_HREF}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Kinh doanh" icon={ChartLineIcon}>
            <MetricStrip metrics={data.metrics} />
          </Panel>

          <OrderSources rows={data.sources} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopProducts products={data.topProducts} />
            <NoDataPanel
              title="Chi phí quảng cáo"
              icon={MegaphoneIcon}
              stage="Giai đoạn 3"
              note="Sẽ nhập từ file CSV của Shopee, TikTok, Facebook Ads, sau đó lấy tự động; lợi nhuận hiện chưa trừ quảng cáo."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NoDataPanel title="Dòng tiền" icon={WalletIcon} stage="Giai đoạn 3" note="Thu, chi, công nợ, tiền COD chưa đối soát." />
            <NoDataPanel title="Thuế" icon={FileTextIcon} stage="Giai đoạn 7" note="Hóa đơn đã xuất, cần điều chỉnh, lịch nộp thuế." />
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
              <li>Đơn chốt: từ “Đã xác nhận” trở đi, kể cả đơn hoàn.</li>
              <li>Doanh thu: doanh số − chiết khấu − hàng hoàn − phí sàn (giống Pancake).</li>
              <li>Lợi nhuận: doanh thu − giá vốn (giá nhập trung bình). Chưa trừ quảng cáo, lương.</li>
              <li>Đơn Shopee bị hoàn: không tính phí %, trừ phí PiShip 2.700 ₫/đơn.</li>
            </ul>
          </Panel>
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

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  BanknoteIcon,
  MegaphoneIcon,
  PackageCheckIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from "lucide-react";
import { DataWarning } from "@/components/dashboard/data-warning";
import { DateFilter } from "@/components/dashboard/date-filter";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRangeVN, resolveFilter } from "@/lib/date-range";

export const metadata: Metadata = { title: "Mẫu giao diện" };

// Số liệu GIẢ chỉ để xem giao diện. Sẽ thay bằng dữ liệu Pancake ở Giai đoạn 1.
const DEMO_STATS = [
  { label: "Doanh số", value: 48_750_000, previous: 41_200_000, icon: TrendingUpIcon },
  { label: "Doanh thu", value: 45_310_000, previous: 46_020_000, icon: BanknoteIcon },
  { label: "Lợi nhuận", value: 12_480_000, previous: 0, icon: ReceiptIcon },
  { label: "Đơn chốt", value: 137, previous: 118, icon: PackageCheckIcon, format: "number" as const },
  { label: "GTTB", value: 330_730, previous: 390_000, icon: ShoppingCartIcon },
  {
    label: "Chi phí quảng cáo",
    value: 5_600_000,
    previous: 4_100_000,
    icon: MegaphoneIcon,
    positiveIsGood: false,
  },
];

const COLORS = [
  { name: "Nhấn (primary)", className: "bg-primary" },
  { name: "Tăng (success)", className: "bg-success" },
  { name: "Giảm (destructive)", className: "bg-destructive" },
  { name: "Cảnh báo (warning)", className: "bg-warning" },
  { name: "Nền trang", className: "bg-background ring-1 ring-border" },
  { name: "Thẻ", className: "bg-card ring-1 ring-border" },
];

export default function DesignPage({ searchParams }: PageProps<"/design">) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mẫu giao diện 1Click</h1>
        <p className="text-sm text-muted-foreground">
          Trang nội bộ để xem các khối dùng chung. Số liệu trên trang này là số giả.
        </p>
      </header>

      {/* Phần phụ thuộc ngày hôm nay và bộ lọc: tải sau, hiện khung xám trong lúc chờ. */}
      <Suspense fallback={<FilteredStatsSkeleton />}>
        <FilteredStats searchParams={searchParams} />
      </Suspense>

      <section className="space-y-3">
        <SectionTitle>3. Banner cảnh báo dữ liệu</SectionTitle>
        <DataWarning
          title="7 sản phẩm chưa có giá vốn"
          impact="Lợi nhuận đang bị tính bằng 100% doanh thu và giá trị tồn kho bằng 0 đ."
          howToFix="Vào Pancake POS → Sản phẩm, mở từng sản phẩm dưới đây và nhập Giá vốn."
          items={[
            "Kệ góc nhà tắm inox SUS304 2 tầng",
            "Giá treo khăn inox SUS304 60cm",
            "Móc dán tường inox (bộ 6 cái)",
            "Kệ để dầu gội gắn tường",
            "Thanh treo rèm nhà tắm",
            "Hộp đựng giấy vệ sinh inox",
            "Kệ xà phòng đôi",
          ]}
          fixUrl="https://pos.pages.fm"
        />
      </section>

      <section className="space-y-3">
        <SectionTitle>4. Thẻ nội dung và mũi tên tăng giảm</SectionTitle>
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="font-semibold">Nguồn đơn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { name: "Shopee", change: 18.2 },
              { name: "TikTok", change: -6.5 },
              { name: "Facebook", change: 0 },
              { name: "Website", change: null },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span>{row.name}</span>
                <TrendBadge change={row.change} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>5. Nút và nhãn</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Lưu</Button>
          <Button variant="outline">Hủy</Button>
          <Button variant="secondary">Phụ</Button>
          <Button variant="destructive">Xóa</Button>
          <Button variant="link">Xem trên Pancake</Button>
          <Badge>Đã kết nối</Badge>
          <Badge variant="secondary">Chưa kết nối</Badge>
          <Badge variant="destructive">Lỗi</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>6. Bảng màu</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLORS.map((color) => (
            <div key={color.name} className="space-y-1.5">
              <div className={`h-12 rounded-lg ${color.className}`} />
              <p className="text-xs text-muted-foreground">{color.name}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

async function FilteredStats({ searchParams }: Pick<PageProps<"/design">, "searchParams">) {
  // "Hôm nay" thay đổi theo thời điểm mở trang, nên phần này không được dựng sẵn trước.
  await connection();
  const filter = resolveFilter(await searchParams);
  const showCompare = filter.previousRange !== null;

  return (
    <>
      <section className="space-y-3">
        <SectionTitle>1. Bộ lọc thời gian và nút Tải lại</SectionTitle>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DateFilter
            preset={filter.preset}
            compare={filter.compare}
            rangeText={formatRangeVN(filter.range)}
            compareText={
              filter.previousRange &&
              `${filter.compareLabel} (${formatRangeVN(filter.previousRange)})`
            }
          />
          <RefreshButton />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>2. Thẻ số liệu</SectionTitle>
        <p className="text-sm text-muted-foreground">
          &quot;Lợi nhuận&quot; có kỳ trước bằng 0 nên hiện &quot;—&quot;. &quot;Chi phí quảng cáo&quot;
          tăng là xấu nên hiện màu đỏ.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_STATS.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              previous={showCompare ? stat.previous : null}
              format={stat.format}
              positiveIsGood={stat.positiveIsGood}
              icon={stat.icon}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function FilteredStatsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_STATS.map((stat) => (
          <StatCardSkeleton key={stat.label} />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

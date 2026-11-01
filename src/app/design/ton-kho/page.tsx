import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, OctagonAlertIcon, WarehouseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { STOCK_STATUS } from "@/components/inventory/stock-status";
import { StockTable } from "@/components/inventory/stock-table";
import { formatDateVN, presetRange, todayInVN } from "@/lib/date-range";
import { formatDecimal, formatNumber, formatVND } from "@/lib/format";
import {
  STATUS_PRIORITY,
  STOCK_RULES,
  analyzeInventory,
  summarizeInventory,
  type StockStatus,
} from "@/lib/inventory/stock";
import { getDemoOverview } from "@/lib/overview/demo-data";

export const metadata: Metadata = { title: "Tồn kho (bản mẫu)" };

const PAGE_HREF = "/design/ton-kho";
const STATUSES = Object.keys(STATUS_PRIORITY) as StockStatus[];

export default function InventoryPrototypePage({ searchParams }: PageProps<"/design/ton-kho">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/design"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Tổng quan
          </Link>
          <h1 className="text-xl font-bold">Tồn kho</h1>
        </div>
        <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning">
          Bản mẫu · số liệu giả
        </span>
      </header>

      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Inventory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Inventory({ searchParams }: Pick<PageProps<"/design/ton-kho">, "searchParams">) {
  await connection();
  const today = todayInVN();
  const params = await searchParams;
  const filter = STATUSES.find((s) => s === params.status) ?? null;

  const { stock } = getDemoOverview(presetRange("today", today), null, today);
  const analyses = analyzeInventory(stock, today);
  const totals = summarizeInventory(stock);
  const alarms = analyses.filter((a) => a.status === "out" || a.status === "urgent");
  const rows = filter ? analyses.filter((a) => a.status === filter) : analyses;
  const countOf = (status: StockStatus) => analyses.filter((a) => a.status === status).length;

  return (
    <>
      {alarms.length > 0 && (
        <section
          aria-label="Báo động tồn kho"
          className="rounded-lg border border-destructive/40 bg-card"
        >
          <header className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-semibold text-destructive">
            <OctagonAlertIcon className="size-4" aria-hidden />
            Báo động: {alarms.length} mã cần sản xuất ngay
          </header>
          <ul className="divide-y">
            {alarms.map((a) => (
              <li key={a.item.sku} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{a.item.name}</span>{" "}
                  <span className="text-muted-foreground">({a.item.sku})</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {a.status === "out"
                    ? `Đã hết hàng, đang bán ${formatDecimal(a.velocity)} cái/ngày`
                    : `Đủ bán ${formatDecimal(a.daysOfStock)} ngày < cần ${a.requiredDays} ngày (SX ${a.item.leadTimeDays} + dự phòng ${STOCK_RULES.safetyDays})`}
                  {" · "}
                  <span className="font-semibold text-foreground">
                    Đặt ngay {formatNumber(a.suggestedQuantity)} cái
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FilterTile label="Tất cả" count={analyses.length} href={PAGE_HREF} active={filter === null} />
        {STATUSES.map((status) => (
          <FilterTile
            key={status}
            label={STOCK_STATUS[status].label}
            count={countOf(status)}
            href={`${PAGE_HREF}?status=${status}`}
            active={filter === status}
            danger={(status === "out" || status === "urgent") && countOf(status) > 0}
          />
        ))}
      </div>

      <Panel
        title="Tồn kho theo mã"
        icon={WarehouseIcon}
        action={
          <span className="text-muted-foreground tabular-nums">
            {formatNumber(totals.quantity)} SP · {formatVND(totals.costValue)} vốn
          </span>
        }
      >
        <StockTable rows={rows} />
        <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          Báo động khi số ngày đủ bán ít hơn thời gian sản xuất/nhập + {STOCK_RULES.safetyDays} ngày dự phòng.
          Tốc độ bán = trung bình {STOCK_RULES.velocityWindowDays} ngày gần nhất. “Nên sản xuất” = đủ bán{" "}
          {STOCK_RULES.targetCoverDays} ngày sau khi hàng về. Đủ bán quá {STOCK_RULES.slowMovingDays} ngày là bán
          chậm. Thời gian sản xuất/nhập do bạn nhập trên 1Click vì Pancake không có. Cập nhật ngày{" "}
          {formatDateVN(today)}.
        </p>
      </Panel>
    </>
  );
}

function FilterTile({
  label,
  count,
  href,
  active,
  danger = false,
}: {
  label: string;
  count: number;
  href: string;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg border-2 bg-card px-3 py-2 transition-colors hover:border-primary/40",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", danger && "text-destructive")}>
        {count}
      </div>
    </Link>
  );
}

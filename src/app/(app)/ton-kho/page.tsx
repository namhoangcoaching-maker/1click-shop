import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EyeOffIcon, OctagonAlertIcon, PlugIcon, WarehouseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { STOCK_STATUS } from "@/components/inventory/stock-status";
import { StockSettings } from "@/components/inventory/stock-settings";
import { StockTable } from "@/components/inventory/stock-table";
import { formatDateTimeVN, todayInVN } from "@/lib/date-range";
import { formatDecimal, formatNumber, formatVelocity, formatVND } from "@/lib/format";
import { getRealInventory } from "@/lib/inventory/real-data";
import { getShopStockRules } from "@/lib/inventory/settings-db";
import { STATUS_PRIORITY, analyzeInventory, summarizeInventory, type StockStatus } from "@/lib/inventory/stock";
import { getCurrentOrg } from "@/lib/org/current";

export const metadata: Metadata = { title: "Tồn kho" };

const PAGE_HREF = "/ton-kho";
const STATUSES = Object.keys(STATUS_PRIORITY) as StockStatus[];

/** Đường dẫn lọc, giữ lựa chọn "Hiện tất cả". */
function filterHref(status: StockStatus | null, showAll: boolean): string {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (showAll) q.set("all", "1");
  const s = q.toString();
  return s ? `${PAGE_HREF}?${s}` : PAGE_HREF;
}

export default function InventoryPage({ searchParams }: PageProps<"/ton-kho">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Tồn kho</h1>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Inventory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Inventory({ searchParams }: Pick<PageProps<"/ton-kho">, "searchParams">) {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null; // Dải "chưa gắn vào shop" đã hiện ở đầu trang.

  const now = new Date();
  const today = todayInVN(now);
  const params = await searchParams;
  const filter = STATUSES.find((s) => s === params.status) ?? null;
  const showAll = params.all === "1";

  const { rules, canEdit, isDefault } = await getShopStockRules();
  const inventory = await getRealInventory(org.id, rules.velocityWindowDays, now);

  if (inventory.items.length === 0) {
    return (
      <>
        <StockSettings rules={rules} canEdit={canEdit} isDefault={isDefault} />
        <Panel title="Chưa có dữ liệu tồn kho" icon={PlugIcon} tone="slate">
          <p className="text-sm text-muted-foreground">
            Shop chưa đồng bộ sản phẩm từ Pancake POS. Vào{" "}
            <Link href="/ket-noi" className="text-primary hover:underline">
              Kết nối
            </Link>{" "}
            để dán khóa API rồi bấm “Đồng bộ ngay”.
          </p>
        </Panel>
      </>
    );
  }

  const hiddenCount = inventory.items.filter((i) => i.inactive).length;
  const visible = showAll ? inventory.items : inventory.items.filter((i) => !i.inactive);
  const analyses = analyzeInventory(visible, today, rules);
  const totals = summarizeInventory(visible);
  const alarms = analyses.filter((a) => a.status === "out" || a.status === "urgent");
  const rows = filter ? analyses.filter((a) => a.status === filter) : analyses;
  const countOf = (status: StockStatus) => analyses.filter((a) => a.status === status).length;
  const noLeadTime = analyses.filter((a) => a.leadTimeIsDefault).length;
  const label = (a: (typeof analyses)[number]) => `${a.item.name}${a.item.variant ? ` · ${a.item.variant}` : ""}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Dữ liệu Pancake cập nhật lúc {inventory.syncedAt ? formatDateTimeVN(inventory.syncedAt) : "—"} · tự động mỗi
          30 phút
        </p>
        <StockSettings rules={rules} canEdit={canEdit} isDefault={isDefault} />
      </div>

      {alarms.length > 0 && (
        <section aria-label="Báo động tồn kho" className="rounded-lg border border-destructive/40 bg-card">
          <header className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-semibold text-destructive">
            <OctagonAlertIcon className="size-4" aria-hidden />
            Báo động: {alarms.length} mã cần sản xuất ngay
          </header>
          <ul className="max-h-96 divide-y overflow-y-auto">
            {alarms.map((a) => (
              <li
                key={a.item.id ?? a.item.sku}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{label(a)}</span>{" "}
                  <span className="text-muted-foreground">({a.item.sku})</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {a.status === "out"
                    ? `Đã hết hàng, đang bán ${formatVelocity(a.velocity)} cái/ngày`
                    : `Đủ bán ${formatDecimal(a.daysOfStock)} ngày < cần ${a.requiredDays} ngày (SX ${a.leadTimeDays}${a.leadTimeIsDefault ? " mặc định" : ""} + dự phòng ${rules.safetyDays})`}
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
        <FilterTile label="Tất cả" count={analyses.length} href={filterHref(null, showAll)} active={filter === null} />
        {STATUSES.map((status) => (
          <FilterTile
            key={status}
            label={STOCK_STATUS[status].label}
            count={countOf(status)}
            href={filterHref(status, showAll)}
            active={filter === status}
            danger={(status === "out" || status === "urgent") && countOf(status) > 0}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <EyeOffIcon className="size-4" aria-hidden />
          {showAll
            ? `Đang hiện cả ${formatNumber(hiddenCount)} mã ngừng kinh doanh.`
            : `Đang ẩn ${formatNumber(hiddenCount)} mã ngừng kinh doanh (hết hàng và 90 ngày không bán, hoặc đã ẩn trên Pancake).`}
          <Link href={filterHref(filter, !showAll)} scroll={false} className="text-primary hover:underline">
            {showAll ? "Ẩn đi" : "Hiện tất cả"}
          </Link>
        </p>
      )}

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
          Báo động khi số ngày đủ bán ít hơn thời gian sản xuất + {rules.safetyDays} ngày dự phòng. Tốc độ bán = số bán
          thực (đơn chốt trừ hàng khách hoàn) trong {rules.velocityWindowDays} ngày gần nhất ÷ {rules.velocityWindowDays}.
          “Nên sản xuất” = đủ bán {rules.targetCoverDays} ngày sau khi hàng về. Đủ bán quá {rules.slowMovingDays} ngày là
          bán chậm. Thời gian sản xuất đọc từ ô <b>Ghi chú nội bộ</b> của sản phẩm trên Pancake, ghi dạng{" "}
          <b>“SX: 10”</b> (10 là số ngày)
          {noLeadTime > 0
            ? `; hiện ${formatNumber(noLeadTime)} mã chưa ghi nên tạm dùng ${rules.defaultLeadTimeDays} ngày`
            : ""}
          . Đổi các con số này ở nút <b>Cấu hình</b>.
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
      <div className={cn("text-xl font-semibold tabular-nums", danger && "text-destructive")}>{count}</div>
    </Link>
  );
}

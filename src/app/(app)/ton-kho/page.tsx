import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlugIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { IncomingList, type IncomingView } from "@/components/inventory/incoming-list";
import { OrderDaySection, UrgentPlan } from "@/components/inventory/order-plan";
import { StockSettings } from "@/components/inventory/stock-settings";
import { formatDateTimeVN, formatDateVN, todayInVN } from "@/lib/date-range";
import { formatNumber, formatVND } from "@/lib/format";
import { isOverdue, toPlanItems } from "@/lib/inventory/incoming";
import { getIncoming } from "@/lib/inventory/incoming-db";
import { buildOrderPlan, type ProductSuggestion } from "@/lib/inventory/plan";
import { getRealInventory } from "@/lib/inventory/real-data";
import { getShopStockRules } from "@/lib/inventory/settings-db";
import { summarizeInventory } from "@/lib/inventory/stock";
import { getCurrentOrg } from "@/lib/org/current";

export const metadata: Metadata = { title: "Tồn kho" };

const PAGE_HREF = "/ton-kho";

export default function InventoryPage({ searchParams }: PageProps<"/ton-kho">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Tồn kho · Kế hoạch đặt hàng</h1>
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
  const showSlow = (await searchParams).cham === "1";

  const { rules, canEdit, isDefault } = await getShopStockRules();
  const [inventory, incoming] = await Promise.all([
    getRealInventory(org.id, rules.velocityWindowDays, now),
    getIncoming(org.id),
  ]);

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

  const active = inventory.items.filter((i) => !i.inactive);
  const plan = buildOrderPlan(toPlanItems(active, incoming, rules.velocityWindowDays, today), today, rules);
  const visible = (list: ProductSuggestion[]) => (showSlow ? list : list.filter((p) => !p.slow));
  const hidden = (list: ProductSuggestion[]) => (showSlow ? 0 : list.filter((p) => p.slow).length);
  const canEditIncoming = org.role === "owner" || org.role === "manager";
  const totals = summarizeInventory(active);

  const byId = new Map(inventory.items.map((i) => [i.id, i]));
  const incomingRows: IncomingView[] = incoming.map((r) => {
    const item = byId.get(r.variation_id);
    return {
      id: r.id,
      product: item?.name ?? "Mã đã xóa",
      variant: item ? (item.variant ?? item.sku) : r.variation_id.slice(0, 8),
      quantity: r.quantity,
      eta: formatDateVN(r.eta),
      overdue: isOverdue(r, today),
      note: r.note,
    };
  });
  const slowHref = showSlow ? null : `${PAGE_HREF}?cham=1`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Pancake cập nhật {inventory.syncedAt ? formatDateTimeVN(inventory.syncedAt) : "—"} · tồn{" "}
          {formatNumber(totals.quantity)} SP · {formatVND(totals.costValue)} vốn ·{" "}
          {showSlow ? (
            <Link href={PAGE_HREF} scroll={false} className="text-primary hover:underline">
              Ẩn mẫu bán chậm
            </Link>
          ) : (
            "đang ẩn mẫu bán chậm"
          )}
        </p>
        <StockSettings rules={rules} canEdit={canEdit} isDefault={isDefault} />
      </div>

      <UrgentPlan
        products={visible(plan.urgent)}
        today={today}
        maxNegativeDays={rules.maxNegativeDays}
        canEdit={canEditIncoming}
      />

      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold">Nhắc đặt hàng</h2>
        <p className="text-sm text-muted-foreground">
          Đặt chính ngày 16 và cuối tháng (đủ bán tới lần đặt chính kế tiếp + {rules.extraCoverDays} ngày). Ngày 10 và
          ngày 20 chỉ đặt bổ sung khi mẫu bán chạy lên hoặc đã đặt rồi vẫn thiếu. Tối thiểu {rules.moqPerSize} cái/size;
          sản xuất {rules.tier1Days} ngày (≤{rules.tier1Qty} cái), {rules.tier2Days} ngày (≤{rules.tier2Qty} cái),{" "}
          {rules.tier3Days} ngày (nhiều hơn). Ngày sau đã tính như các lần trước được đặt đúng gợi ý.
        </p>
      </div>

      {plan.days.map(({ day, products }) => (
        <OrderDaySection
          key={day.date}
          day={day}
          products={visible(products)}
          hiddenSlow={hidden(products)}
          today={today}
          canEdit={canEditIncoming}
          showSlowHref={slowHref}
        />
      ))}

      <IncomingList rows={incomingRows} canEdit={canEditIncoming} />
    </>
  );
}

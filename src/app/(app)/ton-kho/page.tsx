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
  const nextDay = plan.days[0];
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

      {/* Hôm nay là ngày đặt: mọi mẫu cần đặt nằm trong danh sách hôm nay bên dưới. */}
      {nextDay.day.date !== today && (
        <UrgentPlan
          products={visible(plan.urgent)}
          today={today}
          maxNegativeDays={rules.maxNegativeDays}
          canEdit={canEditIncoming}
        />
      )}

      {/* Chỉ hiện ngày đặt GẦN NHẤT (chủ shop yêu cầu): 1–5 → mùng 5, 6–16 → 16, 17–20 → 20, 21–cuối → cuối tháng. */}
      <OrderDaySection
        day={nextDay.day}
        products={visible(nextDay.products)}
        hiddenSlow={hidden(nextDay.products)}
        today={today}
        canEdit={canEditIncoming}
        showSlowHref={slowHref}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Ghi chú lịch đặt hàng</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            <b>Đặt chính</b> ngày 16 và cuối tháng: hàng phải đủ bán tới lần đặt chính kế tiếp + {rules.extraCoverDays}{" "}
            ngày (đặt ngày 16 → đủ tới mùng 7 tháng sau; đặt cuối tháng → đủ tới ngày 23 tháng sau).
          </li>
          <li>
            <b>Đặt bổ sung</b> mùng 5 và ngày 20: chỉ đặt mẫu bán chạy lên đột ngột, hoặc đã đặt rồi mà vẫn không đủ tới
            lần đặt chính kế tiếp + {rules.extraCoverDays} ngày.
          </li>
          <li>
            Tối thiểu {rules.moqPerSize} cái/size. Sản xuất {rules.tier1Days} ngày (≤{rules.tier1Qty} cái/mẫu),{" "}
            {rules.tier2Days} ngày (≤{rules.tier2Qty} cái), {rules.tier3Days} ngày (nhiều hơn). Cho bán âm kho tối đa{" "}
            {rules.maxNegativeDays} ngày.
          </li>
          <li>Đặt xong: nhập số thực tế từng size + ngày xưởng hẹn giao ở cột “Đặt thực tế”, rồi bấm “Đã đặt”.</li>
        </ul>
      </div>

      <IncomingList rows={incomingRows} canEdit={canEditIncoming} />
    </>
  );
}

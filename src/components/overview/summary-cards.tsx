import Link from "next/link";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CheckIcon,
  OctagonAlertIcon,
  WarehouseIcon,
} from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { StatBlock } from "@/components/dashboard/stat-card";
import { formatNumber, formatVND } from "@/lib/format";
import type { InventoryTotals } from "@/lib/inventory/stock";
import type { OrderTotals } from "@/lib/overview/types";

/** Hàng 3 thẻ đầu trang: Tổng hàng chốt, Tổng hàng hoàn, Tồn kho – như Pancake. */
export function SummaryCards({
  closed,
  returned,
  inventory,
  urgentCount,
  inventoryHref,
}: {
  closed: OrderTotals;
  returned: OrderTotals;
  inventory: InventoryTotals;
  /** Số mã hết hàng hoặc cần sản xuất ngay. */
  urgentCount: number;
  inventoryHref: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Tổng hàng chốt" icon={CheckIcon} tone="green">
        <div className="grid grid-cols-2 gap-4">
          <StatBlock label="Tổng tiền" value={closed.amount.value} previous={closed.amount.previous} tone="green" />
          <StatBlock label="Số lượng" value={closed.count.value} previous={closed.count.previous} format="number" />
        </div>
      </Panel>

      <Panel title="Tổng hàng hoàn" icon={ArrowLeftRightIcon} tone="orange">
        <div className="grid grid-cols-2 gap-4">
          <StatBlock
            label="Tổng tiền"
            value={returned.amount.value}
            previous={returned.amount.previous}
            positiveIsGood={false}
            tone="orange"
          />
          <StatBlock
            label="Số lượng"
            value={returned.count.value}
            previous={returned.count.previous}
            format="number"
            positiveIsGood={false}
          />
        </div>
      </Panel>

      <Panel
        title="Tồn kho có thể bán"
        icon={WarehouseIcon}
        tone="blue"
        action={
          <Link href={inventoryHref} className="inline-flex items-center gap-1 text-primary hover:underline">
            Xem chi tiết
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        }
        className="md:col-span-2 xl:col-span-1"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">
              Giá trị tồn (giá vốn) · {formatNumber(inventory.quantity)} SP
            </div>
            <div className="text-xl font-semibold tabular-nums">{formatVND(inventory.costValue)}</div>
            {inventory.missingCost.length > 0 && (
              <div className="text-[13px] text-warning">
                Chưa tính {inventory.missingCost.length} mã thiếu giá vốn
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Giá trị theo giá bán</div>
            <div className="text-xl font-semibold tabular-nums">{formatVND(inventory.retailValue)}</div>
          </div>
        </div>
        {urgentCount > 0 && (
          <Link
            href={inventoryHref}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[13px] font-medium text-destructive hover:bg-destructive/15"
          >
            <OctagonAlertIcon className="size-3.5" aria-hidden />
            {urgentCount} mẫu cần sản xuất ngay
          </Link>
        )}
      </Panel>
    </div>
  );
}

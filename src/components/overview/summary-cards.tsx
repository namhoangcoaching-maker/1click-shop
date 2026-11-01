import { ArrowLeftRightIcon, CheckIcon, WarehouseIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { StatBlock } from "@/components/dashboard/stat-card";
import { formatNumber, formatVND } from "@/lib/format";
import type { InventorySummary, OrderTotals } from "@/lib/overview/types";

/** Hàng 3 thẻ đầu trang: Tổng hàng chốt, Tổng hàng hoàn, Tồn kho – như Pancake. */
export function SummaryCards({
  closed,
  returned,
  inventory,
}: {
  closed: OrderTotals;
  returned: OrderTotals;
  inventory: InventorySummary;
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
        action={<span className="text-base font-semibold tabular-nums">{formatNumber(inventory.quantity)}</span>}
        className="md:col-span-2 xl:col-span-1"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Giá trị tồn (giá vốn)</div>
            <div className="text-xl font-semibold tabular-nums">{formatVND(inventory.costValue)}</div>
            {inventory.productsMissingCost > 0 && (
              <div className="text-[13px] text-warning">
                Chưa tính {inventory.productsMissingCost} SP thiếu giá vốn
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Giá trị theo giá bán</div>
            <div className="text-xl font-semibold tabular-nums">{formatVND(inventory.retailValue)}</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

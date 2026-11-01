import { cn } from "@/lib/utils";
import { formatDateVN } from "@/lib/date-range";
import { formatDecimal, formatNumber, formatVND } from "@/lib/format";
import type { StockAnalysis } from "@/lib/inventory/stock";
import { STOCK_STATUS, StockStatusChip } from "./stock-status";

/** Bảng tồn kho theo từng mã, việc gấp nhất ở trên. */
export function StockTable({ rows }: { rows: StockAnalysis[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[980px] text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-3 text-left font-normal">Trạng thái</th>
            <th className="px-3 py-2 text-left font-normal">Sản phẩm</th>
            <th className="px-3 py-2 text-right font-normal">Tồn</th>
            <th className="px-3 py-2 text-right font-normal">Bán / ngày</th>
            <th className="px-3 py-2 text-right font-normal">Đủ bán</th>
            <th className="px-3 py-2 text-right font-normal">SX / nhập</th>
            <th className="px-3 py-2 text-left font-normal">Hạn đặt sản xuất</th>
            <th className="px-3 py-2 text-right font-normal">Nên sản xuất</th>
            <th className="py-2 pl-3 text-right font-normal">Giá trị tồn (vốn)</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="py-6 text-center text-muted-foreground">
                Không có mã nào ở trạng thái này.
              </td>
            </tr>
          )}
          {rows.map((a) => (
            <tr key={a.item.sku} className={cn("border-b last:border-0", STOCK_STATUS[a.status].row)}>
              <td className="py-2.5 pr-3">
                <StockStatusChip status={a.status} />
              </td>
              <td className="max-w-72 px-3 py-2.5">
                <div className="truncate font-medium">{a.item.name}</div>
                <div className="text-xs text-muted-foreground">{a.item.sku}</div>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold">{formatNumber(a.item.stock)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(a.velocity)}</td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right",
                  (a.status === "urgent" || a.status === "out") && "font-semibold text-destructive",
                )}
              >
                {a.daysOfStock === Infinity ? "Không bán" : `${formatDecimal(a.daysOfStock)} ngày`}
              </td>
              <td className="px-3 py-2.5 text-right">
                {a.leadTimeIsDefault ? (
                  <span className="text-warning" title="Chưa ghi “SX: số ngày” trong Ghi chú nội bộ trên Pancake">
                    {a.leadTimeDays} ngày (mặc định)
                  </span>
                ) : (
                  <span className="text-muted-foreground">{a.leadTimeDays} ngày</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <OrderDeadline analysis={a} />
              </td>
              <td className="px-3 py-2.5 text-right font-semibold">
                {a.suggestedQuantity > 0 ? formatNumber(a.suggestedQuantity) : "—"}
              </td>
              <td className="py-2.5 pl-3 text-right">
                {a.costValue === null ? (
                  <span className="text-warning">Thiếu giá vốn</span>
                ) : (
                  formatVND(a.costValue)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDeadline({ analysis: a }: { analysis: StockAnalysis }) {
  // Bán chậm thì chưa cần nghĩ đến chuyện đặt thêm.
  if (a.daysUntilOrder === null || a.orderBy === null || a.status === "slow") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (a.daysUntilOrder < 0) {
    return (
      <span className="font-semibold text-destructive">
        Trễ {-a.daysUntilOrder} ngày – đặt ngay
      </span>
    );
  }
  if (a.daysUntilOrder === 0) {
    return <span className="font-semibold text-destructive">Hôm nay</span>;
  }
  return (
    <span className={cn(a.status === "soon" ? "font-medium text-warning" : "text-muted-foreground")}>
      {formatDateVN(a.orderBy)} · còn {a.daysUntilOrder} ngày
    </span>
  );
}

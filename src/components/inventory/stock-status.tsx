import {
  CircleCheckIcon,
  ClockIcon,
  HourglassIcon,
  OctagonAlertIcon,
  PackageXIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/inventory/stock";

export const STOCK_STATUS: Record<
  StockStatus,
  { label: string; icon: LucideIcon; chip: string; row?: string }
> = {
  out: { label: "Hết hàng", icon: PackageXIcon, chip: "bg-destructive/10 text-destructive", row: "bg-destructive/5" },
  urgent: {
    label: "Sản xuất ngay",
    icon: OctagonAlertIcon,
    chip: "bg-destructive/10 text-destructive",
    row: "bg-destructive/5",
  },
  soon: { label: "Sắp đến hạn đặt", icon: ClockIcon, chip: "bg-warning/15 text-warning" },
  slow: { label: "Bán chậm", icon: HourglassIcon, chip: "bg-slate-500/10 text-slate-600" },
  ok: { label: "Đủ hàng", icon: CircleCheckIcon, chip: "bg-success/10 text-success" },
};

/** Nhãn trạng thái tồn kho: luôn có biểu tượng + chữ, không chỉ dựa vào màu. */
export function StockStatusChip({ status, className }: { status: StockStatus; className?: string }) {
  const meta = STOCK_STATUS[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        meta.chip,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

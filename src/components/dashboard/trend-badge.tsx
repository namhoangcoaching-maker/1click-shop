import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

interface TrendBadgeProps {
  /** Phần trăm thay đổi, null khi kỳ trước bằng 0. */
  change: number | null;
  /** false cho các chỉ số mà tăng là xấu (chi phí, hoàn hàng…): tăng sẽ hiện màu đỏ. */
  positiveIsGood?: boolean;
  className?: string;
}

/** ↑ 12,5% (xanh lá) hoặc ↓ 8% (đỏ), giống Pancake. */
export function TrendBadge({ change, positiveIsGood = true, className }: TrendBadgeProps) {
  if (change === null || Math.abs(change) < 0.05) {
    return (
      <span className={cn("text-xs font-medium text-muted-foreground", className)}>
        {change === null ? "—" : "0%"}
      </span>
    );
  }

  const isUp = change > 0;
  const isGood = isUp === positiveIsGood;
  const Icon = isUp ? ArrowUpIcon : ArrowDownIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        isGood ? "text-success" : "text-destructive",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{isUp ? "Tăng" : "Giảm"}</span>
      {formatPercent(Math.abs(change))}
    </span>
  );
}

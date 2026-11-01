import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNumber, formatVND, percentChange } from "@/lib/format";
import { TrendBadge } from "./trend-badge";

export type StatFormat = "vnd" | "number";

const formatters: Record<StatFormat, (value: number) => string> = {
  vnd: formatVND,
  number: formatNumber,
};

interface StatCardProps {
  label: string;
  value: number;
  /** Giá trị kỳ trước. Bỏ trống khi không so sánh. */
  previous?: number | null;
  format?: StatFormat;
  /** false cho chi phí: tăng hiện màu đỏ. */
  positiveIsGood?: boolean;
  icon?: LucideIcon;
}

/** Thẻ số liệu kiểu Pancake: tên chỉ số, giá trị lớn, ↑/↓ % so với kỳ trước. */
export function StatCard({
  label,
  value,
  previous,
  format = "vnd",
  positiveIsGood = true,
  icon: Icon,
}: StatCardProps) {
  const formatValue = formatters[format];
  const hasPrevious = previous !== undefined && previous !== null;

  return (
    <Card size="sm" className="gap-2 px-4 shadow-xs">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden />}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">
        {formatValue(value)}
      </div>
      {hasPrevious && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <TrendBadge change={percentChange(value, previous)} positiveIsGood={positiveIsGood} />
          <span className="text-xs text-muted-foreground tabular-nums">
            Kỳ trước: {formatValue(previous)}
          </span>
        </div>
      )}
    </Card>
  );
}

/** Khung xám hiện trong lúc chờ số liệu tải về. */
export function StatCardSkeleton() {
  return (
    <Card size="sm" className="gap-3 px-4 shadow-xs" aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
    </Card>
  );
}

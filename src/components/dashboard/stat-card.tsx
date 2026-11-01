import { cn } from "@/lib/utils";
import { formatValue, percentChange, type ValueFormat } from "@/lib/format";
import { TrendBadge } from "./trend-badge";

const VALUE_TONES = {
  default: "text-foreground",
  green: "text-success",
  orange: "text-warning",
  blue: "text-primary",
} as const;

interface StatBlockProps {
  label: string;
  value: number;
  /** Giá trị kỳ trước. null/undefined khi không so sánh. */
  previous?: number | null;
  format?: ValueFormat;
  /** false cho chi phí, hàng hoàn: tăng hiện màu đỏ. */
  positiveIsGood?: boolean;
  tone?: keyof typeof VALUE_TONES;
  className?: string;
}

/**
 * Khối số kiểu Pancake: nhãn xám, số lớn, ↑/↓ % bên dưới.
 * Rê chuột vào để xem giá trị kỳ trước.
 */
export function StatBlock({
  label,
  value,
  previous,
  format = "vnd",
  positiveIsGood = true,
  tone = "default",
  className,
}: StatBlockProps) {
  const hasPrevious = previous !== undefined && previous !== null;

  return (
    <div
      className={cn("min-w-0 space-y-1", className)}
      title={hasPrevious ? `Kỳ trước: ${formatValue(previous, format)}` : undefined}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", VALUE_TONES[tone])}>
        {formatValue(value, format)}
      </div>
      {hasPrevious && (
        <TrendBadge change={percentChange(value, previous)} positiveIsGood={positiveIsGood} />
      )}
    </div>
  );
}

/** Khối xám nhấp nháy hiện trong lúc chờ số liệu tải về. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}

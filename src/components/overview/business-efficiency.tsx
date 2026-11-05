import Link from "next/link";
import { ArrowRightIcon, ScaleIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import type { Efficiency } from "@/lib/finance/efficiency";
import { formatPercent, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const label = (m: string) => `T${Number(m.slice(5))}`;
const pct = (v: number | null) => (v === null ? "—" : formatPercent(v, 1));

/**
 * Khối "Hiệu quả kinh doanh" ở Tổng quan: theo THÁNG (không theo ô chọn ngày), có nút xem lại 6 tháng.
 * `params`: các tham số đang có trên thanh địa chỉ (giữ nguyên bộ lọc ngày khi đổi tháng).
 */
export function BusinessEfficiency({
  data,
  error,
  month,
  months,
  params,
}: {
  data: Efficiency | null;
  error: string | null;
  month: string;
  months: string[];
  params: Record<string, string>;
}) {
  const href = (m: string) => `/?${new URLSearchParams({ ...params, hq: m })}`;
  return (
    <Panel
      title={`Hiệu quả kinh doanh T${Number(month.slice(5))}/${month.slice(0, 4)}`}
      icon={ScaleIcon}
      tone="violet"
      action={
        <Link href={`/dong-tien?thang=${month}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          Chi tiết
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <nav aria-label="Chọn tháng" className="mb-2 flex flex-wrap gap-1">
        {months.map((m) => (
          <Link
            key={m}
            href={href(m)}
            scroll={false}
            aria-current={m === month ? "page" : undefined}
            className={cn(
              "rounded border px-2 py-0.5 text-xs",
              m === month ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
            )}
          >
            {label(m)}
          </Link>
        ))}
      </nav>

      {!data ? (
        <p className="text-sm text-destructive">{error ?? "Chưa có số liệu."}</p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <tbody>
            <tr className="border-b font-semibold">
              <td className="py-1.5">Doanh thu</td>
              <td className="py-1.5 text-right">{formatVND(data.revenue)}</td>
              <td className="w-16 py-1.5 text-right text-muted-foreground">100%</td>
            </tr>
            {data.costs.map((c) => (
              <tr key={c.label} className={cn(c.amount === 0 && "text-muted-foreground")}>
                <td className="py-1">
                  <span className="mr-1 inline-block w-3 text-muted-foreground">−</span>
                  {c.label}
                </td>
                <td className="py-1 text-right">{formatVND(c.amount)}</td>
                <td className="py-1 text-right text-muted-foreground">{pct(c.percent)}</td>
              </tr>
            ))}
            <tr className="border-t text-base font-semibold">
              <td className="pt-2">Lợi nhuận</td>
              <td className={cn("pt-2 text-right", data.profit < 0 ? "text-destructive" : "text-success")}>
                {formatVND(data.profit)}
              </td>
              <td className={cn("pt-2 text-right text-sm", data.profit < 0 ? "text-destructive" : "text-success")}>
                {pct(data.profitPercent)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Panel>
  );
}

import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon, WalletIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { channelsOf, type CashDay } from "@/lib/cash/compute";
import { formatDateVN, type DateString } from "@/lib/date-range";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

const weekday = (d: DateString) =>
  ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(`${d}T00:00:00Z`).getUTCDay()];

/** Danh sách các ngày tới: thứ, ngày, số tiền dự kiến. */
export function NextDaysList({ days }: { days: CashDay[] }) {
  return (
    <ul className="divide-y text-sm">
      {days.map((d) => (
        <li key={d.date} className="flex justify-between py-1.5">
          <span className="text-muted-foreground">
            {weekday(d.date)} {formatDateVN(d.date).slice(0, 5)}
          </span>
          <span className={cn("tabular-nums", d.total < 0 && "text-destructive")}>{formatVND(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Khối "Tiền về" ở Tổng quan: dự kiến 7 ngày tới; chi tiết theo kênh ẩn, bấm mới mở. */
export function CashInPanel({ days, today }: { days: CashDay[]; today: DateString }) {
  const todayRow = days.find((d) => d.date === today);
  const next = days.filter((d) => d.date > today).slice(0, 7);
  const nextTotal = next.reduce((s, d) => s + d.total, 0);
  const channels = todayRow ? channelsOf([todayRow]) : [];

  return (
    <Panel
      title="Tiền về"
      icon={WalletIcon}
      tone="green"
      action={
        <Link href="/dong-tien" className="inline-flex items-center gap-1 text-primary hover:underline">
          Dòng tiền
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="rounded-md bg-muted px-3 py-2.5">
        <div className="text-xs text-muted-foreground">Dự kiến về 7 ngày tới</div>
        <div className="text-xl font-semibold tabular-nums">{formatVND(nextTotal)}</div>
        <div className="text-xs text-muted-foreground">
          Hôm nay: <span className="tabular-nums">{formatVND(todayRow?.total ?? 0)}</span>
        </div>
      </div>
      <details className="group mt-2" suppressHydrationWarning>
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-primary hover:underline [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          Xem từng ngày và theo kênh
        </summary>
        <div className="mt-1">
          <NextDaysList days={next} />
          {channels.length > 0 && (
            <div className="mt-2 rounded-md border px-2.5 py-2">
              <div className="text-xs font-medium">Hôm nay theo kênh</div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {channels.map((c) => (
                  <li key={c} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{c}</span>
                    <span className={cn("tabular-nums", todayRow!.byChannel[c] < 0 && "text-destructive")}>
                      {formatVND(todayRow!.byChannel[c])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Tự tính theo luật từng kênh (Shopee +4 ngày, TikTok +7, SPX/J&amp;T +3 sau khi khách nhận; chuyển khoản trước
            tính ngay). Số ước tính.
          </p>
        </div>
      </details>
    </Panel>
  );
}

/** Bảng tiền về theo ngày và theo kênh (trang Dòng tiền). */
export function CashTable({ days, today }: { days: CashDay[]; today: DateString }) {
  const channels = channelsOf(days);
  const sum = (c: string) => days.reduce((s, d) => s + (d.byChannel[c] ?? 0), 0);
  const total = days.reduce((s, d) => s + d.total, 0);
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[760px] text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-3 text-left font-normal">Ngày</th>
            <th className="px-3 py-2 text-right font-normal text-foreground">Tổng tiền về</th>
            {channels.map((c) => (
              <th key={c} className="px-3 py-2 text-right font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {days.map((d) => (
            <tr
              key={d.date}
              className={cn(
                "border-b last:border-0",
                d.date === today && "bg-primary/5 font-semibold",
                d.date > today && "text-muted-foreground",
              )}
            >
              <td className="py-2 pr-3">
                {weekday(d.date)} {formatDateVN(d.date)}
                {d.date === today && <span className="ml-1 text-xs text-primary">hôm nay</span>}
                {d.date > today && <span className="ml-1 text-xs">dự kiến</span>}
              </td>
              <td className={cn("px-3 py-2 text-right font-semibold text-foreground", d.total < 0 && "text-destructive")}>
                {formatVND(d.total)}
              </td>
              {channels.map((c) => (
                <td key={c} className={cn("px-3 py-2 text-right", (d.byChannel[c] ?? 0) < 0 && "text-destructive")}>
                  {d.byChannel[c] ? formatVND(d.byChannel[c]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold tabular-nums">
            <td className="py-2 pr-3">Tổng</td>
            <td className="px-3 py-2 text-right">{formatVND(total)}</td>
            {channels.map((c) => (
              <td key={c} className="px-3 py-2 text-right">
                {formatVND(sum(c))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

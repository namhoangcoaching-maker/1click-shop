import Link from "next/link";
import { ChevronRightIcon, LandmarkIcon, PiggyBankIcon, TriangleAlertIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { formatDateVN } from "@/lib/date-range";
import { formatPercent, formatVND } from "@/lib/format";
import { UNNAMED_TAG, type AdsAlert, type ExpenseGroup, type MonthFinance, type MonthString } from "@/lib/finance/month";
import { cn } from "@/lib/utils";

const monthLabel = (m: MonthString) => `${m.slice(5)}/${m.slice(0, 4)}`;

function Line({ label, value, sign, strong, muted, note }: { label: string; value: number | null; sign?: "+" | "−" | "="; strong?: boolean; muted?: boolean; note?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", strong && "border-t pt-2 text-base font-semibold", muted && "text-muted-foreground")}>
      <span>
        {sign && <span className="mr-1 inline-block w-3 text-muted-foreground">{sign}</span>}
        {label}
        {note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
      </span>
      <span className={cn("whitespace-nowrap tabular-nums", strong && value !== null && value < 0 && "text-destructive", strong && value !== null && value >= 0 && "text-success")}>
        {value === null ? "—" : formatVND(value)}
      </span>
    </div>
  );
}

/** Một loại chi phí: bấm để xem các phiếu chi tạo nên nó. */
function ExpenseRow({ group }: { group: ExpenseGroup }) {
  return (
    <details className="group" suppressHydrationWarning>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center">
          <span className="mr-1 inline-block w-3 text-muted-foreground">−</span>
          <ChevronRightIcon className="mr-0.5 size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          <span className={cn(group.category === UNNAMED_TAG && "text-warning")}>{group.category}</span>
          <span className="ml-1 text-xs text-muted-foreground">({group.lines.length} phiếu)</span>
        </span>
        <span className="tabular-nums">{formatVND(group.total)}</span>
      </summary>
      <ul className="mb-1 ml-8 space-y-0.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
        {group.lines.map((l, i) => (
          <li key={`${l.displayId}-${i}`} className="flex justify-between gap-2">
            <span className="truncate">
              {formatDateVN(l.date).slice(0, 5)} · {l.displayId} · {l.name}
            </span>
            <span className="tabular-nums">{formatVND(l.amount)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Cảnh báo quảng cáo cao (> 12% tổng doanh thu, > 25% doanh thu một kênh). */
function AdsAlerts({ alerts }: { alerts: AdsAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
      {alerts.map((a) => (
        <li key={a.channel ?? "all"} className="flex gap-2">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Quảng cáo {a.channel ?? "toàn shop"} = <b>{formatPercent(a.ratio * 100)}</b> doanh thu
            {a.channel ? ` ${a.channel}` : ""} ({formatVND(a.amount)} / {formatVND(a.revenue)}), vượt ngưỡng{" "}
            {formatPercent(a.limit * 100, 0)}.
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MonthSelector({ months, current }: { months: MonthString[]; current: MonthString }) {
  return (
    <nav aria-label="Chọn tháng" className="flex flex-wrap gap-1.5">
      {months.map((m) => (
        <Link
          key={m}
          href={`/dong-tien?thang=${m}`}
          scroll={false}
          aria-current={m === current ? "page" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm",
            m === current ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card hover:bg-muted",
          )}
        >
          Tháng {monthLabel(m)}
        </Link>
      ))}
    </nav>
  );
}

/** Hai khối tách bạch: Lợi nhuận kinh doanh và Dòng tiền thực tế của tháng. */
export function MonthFinanceView({ f, pancakeError }: { f: MonthFinance; pancakeError: string | null }) {
  const label = monthLabel(f.month);
  const adsNote = f.profit.ads === null ? "chưa có: tạo phiếu chi thẻ “Quảng cáo Shopee/TikTok…” trên Pancake" : undefined;
  // Quảng cáo theo thẻ: mỗi kênh một dòng bấm xem phiếu; chưa có thẻ thì một dòng “chưa có”.
  const adsRows = (value: number | null) =>
    f.adsGroups.length > 0 ? (
      f.adsGroups.map((g) => <ExpenseRow key={g.category} group={g} />)
    ) : (
      <Line label="Quảng cáo" value={value} sign="−" note={adsNote} muted={value === null} />
    );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title={`Lợi nhuận kinh doanh tháng ${label}`} icon={PiggyBankIcon} tone="violet">
        <p className="mb-2 text-xs text-muted-foreground">
          Doanh thu trừ tiền thực trả xưởng và các khoản chi trong tháng. Khác “Lợi nhuận” của Pancake (Pancake trừ giá
          vốn từng sản phẩm bán ra).{f.isCurrentMonth && " Tháng đang chạy: số tính tới hôm nay."}
        </p>
        {pancakeError && <p className="mb-2 text-sm text-destructive">{pancakeError}</p>}
        <Line label="Doanh số" value={f.profit.sales} muted />
        <Line label="Phí sàn" value={f.profit.fee} sign="−" muted note="đã trừ sẵn trong Doanh thu" />
        <Line label="Doanh thu" value={f.profit.revenue} note="Pancake: đã trừ chiết khấu, hàng hoàn, phí sàn" />
        <Line
          label="Phí vận chuyển ngoại sàn"
          value={f.profit.partnerFee}
          sign="−"
          note="shop trả đơn vị vận chuyển, Doanh thu chưa trừ"
        />
        {f.expenseGroups.map((g) => (
          <ExpenseRow key={g.category} group={g} />
        ))}
        {adsRows(f.profit.ads)}
        <Line label="Lợi nhuận kinh doanh" value={f.profit.result} sign="=" strong />
        <AdsAlerts alerts={f.adsAlerts} />
      </Panel>

      <Panel title={`Dòng tiền thực tế tháng ${label}`} icon={LandmarkIcon} tone="green">
        <p className="mb-2 text-xs text-muted-foreground">
          Tiền thực về trừ tiền thực chi. Tiền về đã trừ sẵn phí sàn và phí ship đơn vị vận chuyển giữ lại, nên không trừ
          lần nữa.
        </p>
        <Line label={f.isCurrentMonth ? "Tiền về (tới hôm nay)" : "Tiền về trong tháng"} value={f.cash.received} />
        {f.expenseGroups.map((g) => (
          <ExpenseRow key={g.category} group={g} />
        ))}
        <Line label="Phí ship trả riêng" value={f.cash.shippingFeePaid} sign="−" note="phiếu Pancake" />
        {adsRows(f.cash.ads)}
        <Line label={f.isCurrentMonth ? "Dòng tiền ròng tới hôm nay" : "Dòng tiền ròng tháng"} value={f.cash.net} sign="=" strong />
        {f.isCurrentMonth && (
          <div className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ Tiền về dự kiến tới cuối tháng</span>
              <span className="tabular-nums">{formatVND(f.cash.expected)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Dự kiến cả tháng (chưa tính khoản chi sắp tới)</span>
              <span className={cn("tabular-nums", f.cash.netWithExpected < 0 ? "text-destructive" : "text-success")}>
                {formatVND(f.cash.netWithExpected)}
              </span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

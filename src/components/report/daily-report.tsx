import Link from "next/link";
import { CalendarClockIcon, ChevronDownIcon, ClipboardListIcon, NewspaperIcon, TrendingUpIcon, WalletIcon } from "lucide-react";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import { formatDateTimeVN, formatDateVN } from "@/lib/date-range";
import { formatNumber, formatVND, percentChange } from "@/lib/format";
import type { DailyReport, ReportMetric } from "@/lib/report/build";
import { cn } from "@/lib/utils";

function Row({ label, m, money = true, positiveIsGood = true }: { label: string; m: ReportMetric; money?: boolean; positiveIsGood?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <b>{money ? formatVND(m.value) : formatNumber(m.value)}</b>
        <TrendBadge change={m.previous === null ? null : percentChange(m.value, m.previous)} positiveIsGood={positiveIsGood} />
      </span>
    </div>
  );
}

function Box({ title, icon: Icon, children }: { title: string; icon: typeof WalletIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-md bg-muted px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </div>
      {children}
    </div>
  );
}

/** Nội dung một báo cáo 8:00 (dùng ở Tổng quan và trang Báo cáo). */
export function DailyReportBody({ report }: { report: DailyReport }) {
  const y = report.yesterday;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Box title={y ? `Hôm qua ${formatDateVN(y.date).slice(0, 5)} (so với hôm kia)` : "Hôm qua"} icon={TrendingUpIcon}>
        {y ? (
          <>
            <Row label="Doanh số" m={y.sales} />
            <Row label="Doanh thu" m={y.revenue} />
            <Row label="Lợi nhuận" m={y.profit} />
            <Row label="Đơn chốt" m={y.orders} money={false} />
            <Row label="Hàng hoàn (SP)" m={y.returnedQty} money={false} positiveIsGood={false} />
            {y.topSources.length > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Nguồn: {y.topSources.map((s) => `${s.name} ${formatVND(s.revenue)} (${s.orders} đơn)`).join(" · ")}
              </p>
            )}
            {y.topProducts.length > 0 && (
              <ul className="space-y-1 pt-1">
                {y.topProducts.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 text-xs">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ Pancake, nhỏ
                      <img src={p.imageUrl} alt="" className="size-7 rounded object-cover" />
                    ) : (
                      <span className="size-7 rounded bg-card" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatNumber(p.quantity)} SP</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-destructive">{report.statsError ?? "Chưa có số liệu."}</p>
        )}
      </Box>

      <Box title="Tiền về" icon={WalletIcon}>
        <div className="text-xs text-muted-foreground">Dự kiến về 7 ngày tới</div>
        <div className="text-lg font-semibold tabular-nums">{formatVND(report.cash.next7)}</div>
        <p className="text-sm">
          Hôm nay: <b className={cn("tabular-nums", report.cash.today < 0 && "text-destructive")}>{formatVND(report.cash.today)}</b>
        </p>
        {report.cash.byChannel.length > 0 && (
          <details className="text-xs" suppressHydrationWarning>
            <summary className="cursor-pointer text-primary">Hôm nay theo kênh</summary>
            <ul className="mt-1 space-y-0.5">
              {report.cash.byChannel.map((c) => (
                <li key={c.channel} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{c.channel}</span>
                  <span className={cn("tabular-nums", c.amount < 0 && "text-destructive")}>{formatVND(c.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <Link href="/dong-tien" className="block text-xs text-primary hover:underline">
          Xem Dòng tiền
        </Link>
      </Box>

      <Box title={report.order.isToday ? `HÔM NAY ĐẶT HÀNG (${report.order.label})` : `Đặt hàng: ${report.order.label} ${formatDateVN(report.order.date).slice(0, 5)}`} icon={CalendarClockIcon}>
        {report.order.products > 0 ? (
          <>
            <p className={cn("text-sm", report.order.isToday && "font-semibold text-destructive")}>
              {report.order.products} mẫu · {formatNumber(report.order.quantity)} cái
            </p>
            <ul className="space-y-0.5 text-xs">
              {report.order.top.map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums">{formatNumber(p.quantity)} cái</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa cần đặt mẫu nào.</p>
        )}
        {report.order.urgent > 0 && (
          <p className="text-sm font-semibold text-destructive">{report.order.urgent} mẫu cần sản xuất ngay</p>
        )}
        <Link href="/ton-kho" className="text-xs text-primary hover:underline">
          Xem kế hoạch đặt hàng
        </Link>
      </Box>

      <Box title="Việc cần làm" icon={ClipboardListIcon}>
        <ul className="list-disc space-y-0.5 pl-4 text-sm">
          {report.order.isToday && <li>Đặt xưởng theo gợi ý, nhập “Đặt thực tế” rồi bấm “Đã đặt”.</li>}
          {report.todo.incomingToday.length > 0 && (
            <li>
              Hàng về hôm nay:{" "}
              {report.todo.incomingToday.map((x) => `${x.product} ${x.variant} (${x.quantity})`).join(", ")} – nhập kho
              Pancake rồi bấm “Đã về”.
            </li>
          )}
          {report.todo.missingCost > 0 && <li>{report.todo.missingCost} mã còn hàng chưa có giá vốn trên Pancake.</li>}
          {!report.order.isToday && report.todo.incomingToday.length === 0 && report.todo.missingCost === 0 && (
            <li className="list-none text-muted-foreground">Không có việc gấp.</li>
          )}
        </ul>
      </Box>
    </div>
  );
}

/** Khối báo cáo 8:00 ở đầu trang Tổng quan, bấm tiêu đề để thu gọn. */
export function DailyReportCard({ report }: { report: DailyReport | null }) {
  if (!report) return null;
  return (
    <details open className="group rounded-lg border border-primary/30 bg-card" suppressHydrationWarning>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <NewspaperIcon className="size-4 text-primary" aria-hidden />
        <span className="font-semibold">Báo cáo sáng {formatDateVN(report.date)}</span>
        <span className="text-xs text-muted-foreground">lập lúc {formatDateTimeVN(report.createdAt).slice(11)}</span>
        <Link href="/bao-cao" className="ml-auto text-sm text-primary hover:underline">
          Báo cáo các ngày trước
        </Link>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">
        <DailyReportBody report={report} />
      </div>
    </details>
  );
}

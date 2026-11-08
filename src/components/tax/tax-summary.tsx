import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { formatDateVN } from "@/lib/date-range";
import { formatVND } from "@/lib/format";
import { dueLabel, type TaxEvent, type TaxReportPart } from "@/lib/tax/calendar";
import { daysUntil } from "@/lib/tax/rules";
import { cn } from "@/lib/utils";

/**
 * Khối Thuế ở Tổng quan: lịch tính trực tiếp (nhẹ) + số hóa đơn lấy từ báo cáo 8:00 (tránh đọc hàng nghìn
 * hóa đơn mỗi lần mở Tổng quan). Việc có hạn trong 7 ngày hoặc quá hạn hiện ở đầu.
 */
export function TaxSummaryPanel({ today, events, part, reportDate }: { today: string; events: TaxEvent[]; part: TaxReportPart | null; reportDate: string | null }) {
  // Hạn điều chỉnh hóa đơn chỉ có trong báo cáo 8:00; hạn khai thuế tính lại trực tiếp.
  const live = events.map((e) => ({ date: e.date, title: e.title, daysLeft: e.daysLeft }));
  const fromReport = (part?.due ?? []).filter((d) => d.title.startsWith("Điều chỉnh")).map((d) => ({ ...d, daysLeft: daysUntil(today, d.date) }));
  const due = [...fromReport, ...live.filter((e) => e.daysLeft <= 7)].sort((a, b) => a.daysLeft - b.daysLeft);
  const next = live.find((e) => e.daysLeft > 7);

  return (
    <Panel
      title="Thuế"
      icon={FileTextIcon}
      tone="slate"
      action={
        <Link href="/thue" className="text-xs text-primary hover:underline">
          Xem trang Thuế
        </Link>
      }
    >
      <ul className="space-y-1 text-sm">
        {due.map((d) => (
          <li key={`${d.date}-${d.title}`} className={cn("flex justify-between gap-2", d.daysLeft < 0 ? "text-destructive" : "text-warning")}>
            <span>{d.title}</span>
            <span className="whitespace-nowrap">{dueLabel(d.daysLeft)}</span>
          </li>
        ))}
        {next && (
          <li className="flex justify-between gap-2">
            <span>{next.title}</span>
            <span className="whitespace-nowrap text-muted-foreground">
              {formatDateVN(next.date)} · {dueLabel(next.daysLeft)}
            </span>
          </li>
        )}
      </ul>
      {part ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-muted-foreground">Đã xuất HĐ tháng này</div>
            <div className="text-sm font-semibold tabular-nums">{part.rate === null ? "—" : `${String(part.rate).replace(".", ",")}%`}</div>
          </div>
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-muted-foreground">Đơn chưa xuất HĐ</div>
            <div className={cn("text-sm font-semibold tabular-nums", part.missing > 0 && "text-warning")}>{part.missing}</div>
          </div>
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-muted-foreground">HĐ cần điều chỉnh</div>
            <div className={cn("text-sm font-semibold tabular-nums", part.adjust > 0 && "text-destructive")}>
              {part.adjust.toLocaleString("vi-VN")}
              {part.adjustOverdue > 0 && <span className="ml-1 text-xs font-normal">({part.adjustOverdue} quá hạn)</span>}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Số hóa đơn có sau báo cáo 8:00 sáng mai.</p>
      )}
      {part?.warning && (
        <p className="mt-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning">
          Doanh thu năm nay {part.warning.level === "exceeded" ? "đã vượt" : "sắp vượt"} ngưỡng {formatVND(part.warning.threshold)} ({String(part.warning.pct).replace(".", ",")}%).
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        {reportDate ? `Số hóa đơn theo báo cáo 8:00 ngày ${formatDateVN(reportDate)}. ` : ""}Thông tin tham khảo, xác nhận với kế toán.
      </p>
    </Panel>
  );
}

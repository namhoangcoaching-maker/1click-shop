import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlertTriangleIcon, ExternalLinkIcon, FileTextIcon, LandmarkIcon, ReceiptIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { TaxSettingsForm } from "@/components/tax/tax-settings-form";
import { formatDateVN, todayInVN } from "@/lib/date-range";
import { formatVND } from "@/lib/format";
import { getManagerOrg } from "@/lib/org/guard";
import { vnDateOf } from "@/lib/staff/attendance";
import { getInvoiceOverview, getTaxContext } from "@/lib/tax/data";
import { ADJUST_LABELS, INVOICE_STATUS, type AdjustKind } from "@/lib/tax/invoices";
import { BUSINESS_LABELS, DISCLAIMER, PERIOD_LABELS, daysUntil, periodOf } from "@/lib/tax/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Thuế" };

const PANCAKE_URL = "https://pos.pages.fm";
const SHOW = 100;

export default function TaxPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Thuế</h1>
        <p className="text-sm text-warning">{DISCLAIMER}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Tax />
      </Suspense>
    </main>
  );
}

const ddmm = (d: string) => formatDateVN(d).slice(0, 5);

function DeadlineCell({ daysLeft, deadline, label }: { daysLeft: number; deadline: string; label: string }) {
  return (
    <span className={cn("whitespace-nowrap", daysLeft < 0 ? "text-destructive" : daysLeft <= 7 ? "text-warning" : "")}>
      {formatDateVN(deadline)}
      <span className="block text-xs text-muted-foreground">
        {label} · {daysLeft < 0 ? `quá hạn ${-daysLeft} ngày` : daysLeft === 0 ? "hôm nay" : `còn ${daysLeft} ngày`}
      </span>
    </span>
  );
}

async function Tax() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const today = todayInVN();
  const ctx = await getTaxContext(org.id, today);
  const inv = await getInvoiceOverview(org.id, today, ctx);
  const rule = ctx.rule;
  const current = rule ? periodOf(today, rule.vatPeriod) : null;
  const kinds = (Object.keys(ADJUST_LABELS) as AdjustKind[]).map((k) => ({ k, n: inv.adjust.filter((a) => a.kind === k).length })).filter((x) => x.n > 0);
  const overdue = inv.adjust.filter((a) => a.daysLeft < 0).length;

  return (
    <>
      <Panel title="Nghĩa vụ thuế" icon={LandmarkIcon} tone="blue">
        {!ctx.settings ? (
          <p className="text-sm text-muted-foreground">Chưa cấu hình loại hình. {org.role === "owner" ? "Điền bên dưới." : "Chủ shop cần điền."}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">Loại hình</dt>
            <dd>
              {BUSINESS_LABELS[ctx.settings.businessType]} · doanh thu năm trước {formatVND(ctx.settings.priorYearRevenue)}
              {ctx.settings.priorYearRevenue === 1_000_000_001 && <span className="ml-1 text-xs text-warning">(số tạm “trên 1 tỷ” – Chủ shop điền số chính xác)</span>}
            </dd>
            <dt className="text-muted-foreground">Quy định áp dụng</dt>
            <dd>
              {rule ? (
                <>
                  {rule.summary}
                  {rule.legalRef && <span className="block text-xs text-muted-foreground">Căn cứ: {rule.legalRef}</span>}
                </>
              ) : (
                <span className="text-warning">Chưa có quy định khớp loại hình / doanh thu này.</span>
              )}
            </dd>
            {rule && current && (
              <>
                <dt className="text-muted-foreground">Kỳ khai thuế GTGT</dt>
                <dd>
                  {PERIOD_LABELS[rule.vatPeriod]}
                  {rule.vatPeriod !== "none" ? ` · kỳ hiện tại ${current.label}, hạn nộp tờ khai ${formatDateVN(current.deadline)} (còn ${daysUntil(today, current.deadline)} ngày)` : ` · thông báo doanh thu năm ${today.slice(0, 4)} chậm nhất ${formatDateVN(current.deadline)}`}
                </dd>
                <dt className="text-muted-foreground">Hóa đơn điện tử</dt>
                <dd>{rule.einvoiceRequired ? "Bắt buộc" : "Không bắt buộc"}</dd>
              </>
            )}
          </dl>
        )}
        {org.role === "owner" && (
          <details className="mt-3 rounded-md border" open={!ctx.settings} suppressHydrationWarning>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Sửa loại hình / doanh thu năm trước</summary>
            <div className="px-3 pb-3">
              <TaxSettingsForm businessType={ctx.settings?.businessType ?? "household"} priorYearRevenue={ctx.settings?.priorYearRevenue ?? 0} />
            </div>
          </details>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Lịch thuế đầy đủ, nhắc trước 7 ngày / 1 ngày và cảnh báo vượt ngưỡng: bước 7.2.</p>
      </Panel>

      <Panel
        title="Hóa đơn điện tử"
        icon={ReceiptIcon}
        tone="green"
        action={
          <span className="text-xs text-muted-foreground">
            {inv.syncedAt ? `${inv.invoiceCount.toLocaleString("vi-VN")} hóa đơn từ ${formatDateVN(inv.from)} · đồng bộ mỗi 30 phút` : "Đang lấy hóa đơn lần đầu…"}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Tỷ lệ đã xuất tháng này</div>
            <div className="text-lg font-semibold tabular-nums">{inv.coverage[0]?.rate == null ? "—" : `${String(inv.coverage[0].rate).replace(".", ",")}%`}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Đơn chưa xuất (trễ)</div>
            <div className={cn("text-lg font-semibold tabular-nums", inv.missing.length > 0 && "text-warning")}>{inv.missing.length}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Hóa đơn cần điều chỉnh</div>
            <div className={cn("text-lg font-semibold tabular-nums", inv.adjust.length > 0 && "text-destructive")}>{inv.adjust.length}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Trong đó đã quá hạn</div>
            <div className={cn("text-lg font-semibold tabular-nums", overdue > 0 && "text-destructive")}>{overdue}</div>
          </div>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-normal">Tháng (theo ngày khách nhận)</th>
              <th className="py-1.5 text-right font-normal">Đơn cần hóa đơn</th>
              <th className="py-1.5 text-right font-normal">Đã xuất</th>
              <th className="py-1.5 text-right font-normal">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {inv.coverage.map((c) => (
              <tr key={c.month} className="border-b last:border-0">
                <td className="py-1.5">
                  Tháng {c.month.slice(5)}/{c.month.slice(0, 4)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{c.needed.toLocaleString("vi-VN")}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {c.issued.toLocaleString("vi-VN")}
                  {c.pending > 0 && <span className="ml-1 text-xs text-muted-foreground">(+{c.pending} chờ phát hành)</span>}
                </td>
                <td className={cn("py-1.5 text-right tabular-nums", c.rate !== null && c.rate < 100 && "text-warning")}>
                  {c.rate === null ? "—" : `${String(c.rate).replace(".", ",")}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Đơn cần hóa đơn = đơn khách đã nhận (Pancake tự xuất hóa đơn đúng lúc đơn chuyển “Đã nhận”); đơn hoàn toàn bộ mà
          chưa có hóa đơn thì không tính. {inv.pendingToday > 0 && `${inv.pendingToday} đơn khách nhận hôm nay chưa có hóa đơn (chưa coi là trễ).`}
        </p>
      </Panel>

      <Panel title={`Đơn chưa xuất hóa đơn (${inv.missing.length})`} icon={FileTextIcon} tone="orange" action={<PancakeLink />}>
        {inv.missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có đơn nào trễ. Đơn khách đã nhận từ hôm qua trở về trước đều đã có hóa đơn.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-normal">Mã đơn</th>
                  <th className="px-2 py-1.5 font-normal">Kênh</th>
                  <th className="px-2 py-1.5 font-normal">Khách nhận</th>
                  <th className="px-2 py-1.5 text-right font-normal">Tiền đơn</th>
                  <th className="py-1.5 pl-2 text-right font-normal">Trễ</th>
                </tr>
              </thead>
              <tbody>
                {inv.missing.slice(0, SHOW).map((m) => (
                  <tr key={m.order.systemId} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <b>#{m.order.systemId}</b>
                      <span className="block text-xs text-muted-foreground">{m.order.orderId}</span>
                    </td>
                    <td className="px-2 py-1.5">{m.order.source ?? "—"}</td>
                    <td className="px-2 py-1.5">{ddmm(m.deliveredDate)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(m.order.totalAfterDiscount + m.order.feeMarketplace)}</td>
                    <td className="py-1.5 pl-2 text-right text-warning">{m.daysLate} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inv.missing.length > SHOW && <p className="mt-2 text-xs text-muted-foreground">Đang hiện {SHOW} đơn trễ lâu nhất.</p>}
          </div>
        )}
      </Panel>

      <Panel title={`Hóa đơn cần điều chỉnh (${inv.adjust.length})`} icon={AlertTriangleIcon} tone="red" action={<PancakeLink />}>
        {inv.adjust.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có hóa đơn nào cần điều chỉnh.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              {kinds.map(({ k, n }) => (
                <span key={k} className="rounded bg-muted px-2 py-1">
                  {ADJUST_LABELS[k]}: <b>{n}</b>
                </span>
              ))}
            </div>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2 font-normal">Mã đơn</th>
                    <th className="px-2 py-1.5 font-normal">Hóa đơn</th>
                    <th className="px-2 py-1.5 text-right font-normal">Tiền hóa đơn</th>
                    <th className="px-2 py-1.5 font-normal">Lý do</th>
                    <th className="py-1.5 pl-2 font-normal">Hạn xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.adjust.slice(0, SHOW).map((a) => (
                    <tr key={`${a.invoice.id}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <b>#{a.order.systemId}</b>
                        <span className="block text-xs text-muted-foreground">
                          {a.order.source ?? ""} · {a.order.orderId}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {a.invoice.series} {a.invoice.invoiceNo}
                        <span className="block text-xs text-muted-foreground">
                          {INVOICE_STATUS[a.invoice.status]}
                          {a.invoice.releasedAt ? ` · ${formatDateVN(vnDateOf(a.invoice.releasedAt))}` : ""}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatVND(a.invoice.totalAmount)}
                        {a.kind === "amount" && <span className="block text-xs text-muted-foreground">đơn: {formatVND(a.orderAmount)}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {ADJUST_LABELS[a.kind]}
                        {a.eventDate && a.kind !== "amount" && <span className="block text-xs text-muted-foreground">ngày {ddmm(a.eventDate)}</span>}
                      </td>
                      <td className="py-1.5 pl-2">
                        <DeadlineCell daysLeft={a.daysLeft} deadline={a.deadline} label={a.periodLabel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inv.adjust.length > SHOW && <p className="mt-2 text-xs text-muted-foreground">Đang hiện {SHOW} hóa đơn gấp nhất (hạn gần nhất trước).</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Hạn = hạn nộp tờ khai của kỳ chứa hóa đơn gốc. Hóa đơn quá hạn (đơn hoàn sau khi kỳ đã khai) có thể phải khai bổ sung –
              hỏi kế toán. Tìm đơn trên Pancake bằng mã #…; xử lý xong, 1Click tự cập nhật sau lần đồng bộ kế tiếp.
            </p>
          </>
        )}
      </Panel>
    </>
  );
}

function PancakeLink() {
  return (
    <a href={PANCAKE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      Mở Pancake <ExternalLinkIcon className="size-3.5" aria-hidden />
    </a>
  );
}

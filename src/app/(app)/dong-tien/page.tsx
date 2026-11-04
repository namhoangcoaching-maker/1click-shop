import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronDownIcon, HandCoinsIcon, TagsIcon, WalletIcon } from "lucide-react";
import { CashTable, NextDaysList } from "@/components/cash/cash-in";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { MonthFinanceView, MonthSelector } from "@/components/finance/month-finance";
import { TagNames } from "@/components/finance/tag-names";
import { CASH_RULES } from "@/lib/cash/compute";
import { getCashDays } from "@/lib/cash/data";
import { addDays, todayInVN } from "@/lib/date-range";
import { getMonthFinance } from "@/lib/finance/data";
import { recentMonths, resolveMonth } from "@/lib/finance/month";
import { formatVND } from "@/lib/format";
import { getCurrentOrg } from "@/lib/org/current";

export const metadata: Metadata = { title: "Dòng tiền" };

/** Bảng chi tiết tiền về: số ngày xem lại và xem trước. */
const PAST_DAYS = 14;
const FUTURE_DAYS = 10;

export default function CashflowPage({ searchParams }: PageProps<"/dong-tien">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Dòng tiền</h1>

      <Suspense fallback={<Skeleton className="h-64 bg-card" />}>
        <CashIn />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Month searchParams={searchParams} />
      </Suspense>

      <NoDataPanel
        title="Công nợ"
        icon={HandCoinsIcon}
        stage="Giai đoạn 3"
        note="Phải thu khách hàng, phải trả nhà cung cấp / xưởng."
      />
    </main>
  );
}

/** Lợi nhuận kinh doanh + Dòng tiền thực tế theo tháng, và tên thẻ phiếu chi. */
async function Month({ searchParams }: Pick<PageProps<"/dong-tien">, "searchParams">) {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  const today = todayInVN();
  const month = resolveMonth((await searchParams).thang, today);
  const { finance, pancakeError, tags } = await getMonthFinance(org.id, month, today);
  const unnamed = tags.filter((t) => !t.name).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Kết quả theo tháng</h2>
        <MonthSelector months={recentMonths(today, 6)} current={month} />
      </div>
      <MonthFinanceView f={finance} pancakeError={pancakeError} />

      <details className="group rounded-lg bg-card" open={unnamed > 0} suppressHydrationWarning>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
          <TagsIcon className="size-4 text-primary" aria-hidden />
          <span className="font-semibold">Thẻ chi phí</span>
          <span className="text-sm text-muted-foreground">
            {tags.length} thẻ{unnamed > 0 ? ` · ${unnamed} thẻ chưa đặt tên` : ""}
          </span>
          <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-2 px-4 pb-4 text-sm">
          <p className="text-muted-foreground">
            Chi phí lấy từ <b>phiếu chi có gắn thẻ</b> trên Pancake (Thu chi): thẻ “Sản xuất” = trả xưởng / nhập hàng,
            “Quay chụp”, “Phần mềm”, “Giao hàng”, “Mặt bằng”, “Lương”, “Khác”… Phiếu Pancake tự sinh theo đơn (trả trước,
            hoàn, đổi số tiền) không phải chi phí. Pancake chỉ cho biết mã thẻ, nên Chủ shop đặt tên thẻ một lần ở đây.
          </p>
          {tags.length === 0 ? (
            <p className="text-muted-foreground">Chưa có phiếu chi nào gắn thẻ.</p>
          ) : (
            <TagNames tags={tags} canEdit={org.role === "owner"} />
          )}
        </div>
      </details>
    </>
  );
}

/** Phần Tiền về: dự kiến 7 ngày tới; bảng chi tiết theo ngày/kênh ẩn, shop tự mở khi cần. */
async function CashIn() {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  const today = todayInVN();
  const days = await getCashDays(org.id, addDays(today, -PAST_DAYS), addDays(today, FUTURE_DAYS));
  const todayTotal = days.find((d) => d.date === today)?.total ?? 0;
  const next7 = days.filter((d) => d.date > today && d.date <= addDays(today, 7));
  const next7Total = next7.reduce((s, d) => s + d.total, 0);

  return (
    <Panel title="Tiền về" icon={WalletIcon} tone="green">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-md bg-muted px-3 py-2.5">
            <div className="text-sm text-muted-foreground">Dự kiến về 7 ngày tới</div>
            <div className="text-2xl font-semibold tabular-nums">{formatVND(next7Total)}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2.5">
            <div className="text-sm text-muted-foreground">Hôm nay dự kiến về</div>
            <div className="text-lg font-semibold tabular-nums">{formatVND(todayTotal)}</div>
          </div>
        </div>
        <NextDaysList days={next7} />
      </div>

      <details className="group mt-4 rounded-md border" suppressHydrationWarning>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          Xem chi tiết theo ngày và theo kênh ({PAST_DAYS} ngày qua, {FUTURE_DAYS} ngày tới) · cách tính
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <CashTable days={[...days].reverse()} today={today} />
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            <li>
              Shopee: tiền sàn trả (đã trừ phí sàn) về ngày khách nhận + {CASH_RULES.marketplaceDelay.Shopee} ngày. TikTok: +
              {CASH_RULES.marketplaceDelay.Tiktok} ngày.
            </li>
            <li>
              Ngoại sàn qua đơn vị vận chuyển (SPX, J&amp;T, Viettel Post…): COD trừ phí ship, về ngày khách nhận +{" "}
              {CASH_RULES.carrierDelay} ngày (phí ship đã trả riêng thì không trừ).
            </li>
            <li>
              Khách chuyển khoản trước: theo Thu chi Pancake, đúng ngày giao dịch (đã trừ hủy/hoàn). Đơn Shopify bằng USD
              đổi theo tỷ giá mua chuyển khoản Vietcombank của ngày đó.
            </li>
            <li>Đã nhận rồi mới hoàn: trừ vào ngày đơn chuyển “Đã hoàn”.</li>
            <li>Phiếu chi có thẻ (Sản xuất, Quay chụp…) là chi phí, không trừ vào tiền về.</li>
            <li>
              Số dự kiến chỉ gồm đơn khách đã nhận; đơn đang giao được cộng khi khách nhận. Là ước tính theo luật, có thể
              lệch vài ngày với tiền thật về tài khoản.
            </li>
          </ul>
        </div>
      </details>
    </Panel>
  );
}

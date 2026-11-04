import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronDownIcon, HandCoinsIcon, ReceiptIcon, ScaleIcon, WalletIcon } from "lucide-react";
import { CashTable, NextDaysList } from "@/components/cash/cash-in";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { CASH_RULES } from "@/lib/cash/compute";
import { getCashDays } from "@/lib/cash/data";
import { addDays, todayInVN } from "@/lib/date-range";
import { formatVND } from "@/lib/format";
import { getCurrentOrg } from "@/lib/org/current";

export const metadata: Metadata = { title: "Dòng tiền" };

/** Bảng chi tiết: số ngày xem lại và xem trước. */
const PAST_DAYS = 14;
const FUTURE_DAYS = 10;

export default function CashflowPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Dòng tiền</h1>

      <Suspense fallback={<Skeleton className="h-64 bg-card" />}>
        <CashIn />
      </Suspense>

      {/* Các phần còn lại của Dòng tiền (Giai đoạn 3). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NoDataPanel
          title="Chi phí"
          icon={ReceiptIcon}
          stage="Giai đoạn 3"
          note="Lương, quảng cáo từng kênh, phiếu chi Pancake, nhập hàng, phí sàn, phí vận chuyển shop trả."
        />
        <NoDataPanel
          title="Công nợ"
          icon={HandCoinsIcon}
          stage="Giai đoạn 3"
          note="Phải thu khách hàng, phải trả nhà cung cấp / xưởng."
        />
        <NoDataPanel
          title="Thu – chi"
          icon={ScaleIcon}
          stage="Giai đoạn 3"
          note="Kết quả thu trừ chi theo ngày và tháng, dự báo và cảnh báo sắp thiếu tiền."
        />
      </div>
    </main>
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
            <li>Khách chuyển khoản trước, Shopify: theo Thu chi Pancake, đúng ngày giao dịch (đã trừ hủy/hoàn).</li>
            <li>Đã nhận rồi mới hoàn: trừ vào ngày đơn chuyển “Đã hoàn”.</li>
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

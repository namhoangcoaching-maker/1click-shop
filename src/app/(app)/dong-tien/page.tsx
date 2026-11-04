import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { WalletIcon } from "lucide-react";
import { CashTable } from "@/components/cash/cash-in";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { CASH_RULES } from "@/lib/cash/compute";
import { getCashDays } from "@/lib/cash/data";
import { addDays, todayInVN } from "@/lib/date-range";
import { formatVND } from "@/lib/format";
import { getCurrentOrg } from "@/lib/org/current";

export const metadata: Metadata = { title: "Dòng tiền" };

/** Số ngày xem lại và xem trước. */
const PAST_DAYS = 14;
const FUTURE_DAYS = 10;

export default function CashflowPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Dòng tiền · Tiền về</h1>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Cash />
      </Suspense>
    </main>
  );
}

async function Cash() {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  const today = todayInVN();
  const days = await getCashDays(org.id, addDays(today, -PAST_DAYS), addDays(today, FUTURE_DAYS));
  const todayTotal = days.find((d) => d.date === today)?.total ?? 0;
  const future = days.filter((d) => d.date > today).reduce((s, d) => s + d.total, 0);
  const past7 = days.filter((d) => d.date < today && d.date >= addDays(today, -7)).reduce((s, d) => s + d.total, 0);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Hôm nay dự kiến về", todayTotal],
          [`${FUTURE_DAYS} ngày tới dự kiến`, future],
          ["7 ngày qua đã về (ước tính)", past7],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg bg-card px-4 py-3">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold tabular-nums">{formatVND(value as number)}</div>
          </div>
        ))}
      </div>

      <Panel title="Tiền về theo ngày" icon={WalletIcon} tone="green">
        <CashTable days={[...days].reverse()} today={today} />
      </Panel>

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Cách tính (tự động, không cần đối soát)</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            Shopee: tiền sàn trả (đã trừ phí sàn) về ngày khách nhận + {CASH_RULES.marketplaceDelay.Shopee} ngày. TikTok: +
            {CASH_RULES.marketplaceDelay.Tiktok} ngày.
          </li>
          <li>
            Đơn ngoại sàn qua đơn vị vận chuyển (SPX, J&amp;T, Viettel Post…): tiền COD trừ phí ship về ngày khách nhận +{" "}
            {CASH_RULES.carrierDelay} ngày (phí ship đã trả riêng thì không trừ).
          </li>
          <li>Khách chuyển khoản trước, Shopify: theo Thu chi Pancake, về đúng ngày giao dịch (đã trừ hủy/hoàn trả trước).</li>
          <li>Đơn đã nhận rồi mới hoàn: trừ lại vào ngày đơn chuyển “Đã hoàn” (hoàn một phần trừ theo phần hoàn).</li>
          <li>
            Số ước tính theo luật, có thể lệch vài ngày so với tiền thật về tài khoản (sàn trả chậm, ngày lễ). Chi phí,
            công nợ sẽ có ở Giai đoạn 3.
          </li>
        </ul>
      </div>
    </>
  );
}

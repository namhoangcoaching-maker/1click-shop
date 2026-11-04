import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/dashboard/stat-card";
import { DailyReportBody } from "@/components/report/daily-report";
import { formatDateTimeVN, formatDateVN } from "@/lib/date-range";
import { getCurrentOrg } from "@/lib/org/current";
import { getRecentReports, getReportToShow } from "@/lib/report/generate";

export const metadata: Metadata = { title: "Báo cáo" };

export default function ReportsPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold">Báo cáo hằng ngày</h1>
        <p className="text-sm text-muted-foreground">
          1Click tự lập báo cáo lúc 8:00 mỗi sáng: kết quả hôm qua, tiền về hôm nay, việc đặt hàng. 30 ngày gần nhất.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Reports />
      </Suspense>
    </main>
  );
}

async function Reports() {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  await getReportToShow(org.id); // đã quá 8:00 mà chưa có báo cáo hôm nay thì lập ngay
  const reports = await getRecentReports(org.id);
  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có báo cáo nào. Báo cáo đầu tiên sẽ có lúc 8:00 sáng mai.</p>;
  }
  return (
    <ul className="space-y-3">
      {reports.map((r, i) => (
        <li key={r.date}>
          <details open={i === 0} className="group rounded-lg bg-card" suppressHydrationWarning>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">Báo cáo sáng {formatDateVN(r.date)}</span>
              <span className="text-xs text-muted-foreground">lập lúc {formatDateTimeVN(r.createdAt).slice(11)}</span>
            </summary>
            <div className="px-4 pb-4">
              <DailyReportBody report={r} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

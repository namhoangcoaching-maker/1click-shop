import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Skeleton } from "@/components/dashboard/stat-card";
import { DailyReportBody } from "@/components/report/daily-report";
import { formatDateTimeVN, formatDateVN } from "@/lib/date-range";
import { getCurrentOrg } from "@/lib/org/current";
import { getRecentReports, getReportToShow, refreshYesterday } from "@/lib/report/generate";

export const metadata: Metadata = { title: "Báo cáo" };

export default function ReportsPage({ searchParams }: PageProps<"/bao-cao">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold">Báo cáo hằng ngày</h1>
        <p className="text-sm text-muted-foreground">
          1Click tự lập báo cáo lúc 8:00 mỗi sáng: kết quả hôm qua, tiền về hôm nay, việc đặt hàng. 30 ngày gần nhất.
          Khi mở một báo cáo, phần “Hôm qua” lấy lại số mới nhất từ Pancake (đơn hủy sau 8:00 được trừ ra).
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/bao-cao">, "searchParams">) {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  // Đã quá 8:00 mà chưa có báo cáo hôm nay thì lập ngay; trả về bản đã lấy số mới.
  const [shown, reports, params] = await Promise.all([getReportToShow(org.id), getRecentReports(org.id), searchParams]);
  if (reports.length === 0 && !shown) {
    return <p className="text-sm text-muted-foreground">Chưa có báo cáo nào. Báo cáo đầu tiên sẽ có lúc 8:00 sáng mai.</p>;
  }
  const list = shown && !reports.some((r) => r.date === shown.date) ? [shown, ...reports] : reports;
  const wanted = typeof params.ngay === "string" ? params.ngay : null;
  const selected = list.find((r) => r.date === wanted) ?? shown ?? list[0];
  // Chỉ báo cáo đang mở mới hỏi lại Pancake (mỗi lần ~6 lượt hỏi).
  const open = selected.date === shown?.date ? shown : await refreshYesterday(org.id, selected);

  return (
    <ul className="space-y-3">
      {list.map((r) =>
        r.date === open.date ? (
          <li key={r.date} className="rounded-lg border border-primary/30 bg-card">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="font-semibold">Báo cáo sáng {formatDateVN(r.date)}</span>
              <span className="text-xs text-muted-foreground">lập lúc {formatDateTimeVN(r.createdAt).slice(11)}</span>
            </div>
            <div className="px-4 pb-4">
              <DailyReportBody report={open} />
            </div>
          </li>
        ) : (
          <li key={r.date}>
            <Link
              href={`/bao-cao?ngay=${r.date}`}
              scroll={false}
              className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 hover:bg-muted"
            >
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-semibold">Báo cáo sáng {formatDateVN(r.date)}</span>
              <span className="text-xs text-muted-foreground">lập lúc {formatDateTimeVN(r.createdAt).slice(11)}</span>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}

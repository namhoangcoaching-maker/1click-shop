import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClipboardCheckIcon, ClockIcon, IdCardIcon, WalletIcon } from "lucide-react";
import { NoDataPanel } from "@/components/dashboard/no-data-panel";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { DayList, SummaryLine } from "@/components/staff/attendance-view";
import { ClockCard } from "@/components/staff/clock-card";
import { todayInVN } from "@/lib/date-range";
import { monthRange } from "@/lib/finance/month";
import { formatVND } from "@/lib/format";
import { personMonth, vnTimeOf } from "@/lib/staff/attendance";
import { currentUserId, getAttendance } from "@/lib/staff/attendance-data";
import { getCurrentOrg } from "@/lib/org/current";
import { createClient } from "@/lib/supabase/server";
import { getLocations, getMySettings } from "@/lib/staff/data";
import { PAY_LABELS, dailyRate, describeShift } from "@/lib/staff/settings";

export const metadata: Metadata = { title: "Của tôi" };

/**
 * Trang chính của từng người (là trang chủ của Nhân viên – Giai đoạn 6):
 * vào/ra ca, ngày công, KPI, hiệu suất, lương dự kiến, kế hoạch và báo cáo trong ngày.
 * 6.2: hiện cấu hình của mình; các phần còn lại có ở 6.3–6.6.
 */
export default function MyPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">Của tôi</h1>
      <Suspense fallback={<Skeleton className="h-48 bg-card" />}>
        <MyAttendance />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-32 bg-card" />}>
        <MySetup />
      </Suspense>
      <NoDataPanel
        title="KPI, lương dự kiến"
        icon={WalletIcon}
        stage="Bước 6.4"
        note="KPI, hiệu suất và lương dự kiến tới hôm nay của bạn."
      />
      <NoDataPanel
        title="Kế hoạch hôm nay và báo cáo cuối ngày"
        icon={ClipboardCheckIcon}
        stage="Bước 6.5"
        note="Danh sách việc cần làm trong ngày; cuối ngày điền báo cáo."
      />
    </main>
  );
}

/** Chấm công hôm nay (nút Vào ca / Ra ca) + bảng công tháng này của chính mình. */
async function MyAttendance() {
  await connection();
  const org = await getCurrentOrg();
  if (!org) return null;
  const me = await currentUserId();
  if (!me) return null;
  const today = todayInVN();
  const { from, to } = monthRange(today.slice(0, 7));
  const [s, locations, rows] = await Promise.all([getMySettings(org.id, me), getLocations(org.id), getAttendance(org.id, from, to, me)]);
  if (!s) {
    return (
      <Panel title="Chấm công" icon={ClockIcon} tone="green">
        <p className="text-sm text-muted-foreground">Chủ shop / Quản lý chưa cấu hình chấm công cho bạn.</p>
      </Panel>
    );
  }
  const todayRow = rows.find((r) => r.workDate === today);
  const month = personMonth(rows, s.workDays, from, to, today);

  return (
    <Panel title="Chấm công" icon={ClockIcon} tone="green">
      <ClockCard
        mode={s.attendanceMode}
        locationName={locations.find((l) => l.id === s.locationId)?.name ?? null}
        checkIn={todayRow?.checkInAt ? vnTimeOf(todayRow.checkInAt) : null}
        checkOut={todayRow?.checkOutAt ? vnTimeOf(todayRow.checkOutAt) : null}
        shift={`${s.shiftStart}–${s.shiftEnd}`}
      />
      <h3 className="mt-5 mb-2 font-semibold">Tháng {today.slice(5, 7)}/{today.slice(0, 4)}</h3>
      <SummaryLine s={month.summary} />
      <details className="group mt-3 rounded-md border" suppressHydrationWarning>
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          Xem từng ngày
        </summary>
        <div className="px-3 pb-3">
          <DayList days={month.days} />
          <p className="mt-2 text-xs text-muted-foreground">
            Công = giờ làm trong ca ÷ độ dài ca (tối đa 1). Quên Ra ca thì ngày đó chưa có công, báo Quản lý sửa.
          </p>
        </div>
      </details>
    </Panel>
  );
}

async function MySetup() {
  await connection();
  const [org, supabase] = await Promise.all([getCurrentOrg(), createClient()]);
  if (!org) return null;
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return null;
  const [s, locations] = await Promise.all([getMySettings(org.id, userId), getLocations(org.id)]);

  return (
    <Panel title="Cách tính công và lương của bạn" icon={IdCardIcon} tone="blue">
      {!s ? (
        <p className="text-sm text-muted-foreground">Chủ shop / Quản lý chưa cấu hình cho bạn.</p>
      ) : (
        <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Chấm công</dt>
          <dd>
            {s.attendanceMode === "gps"
              ? `GPS tại ${locations.find((l) => l.id === s.locationId)?.name ?? "shop"}`
              : "Online tại nhà"}
          </dd>
          <dt className="text-muted-foreground">Ca làm</dt>
          <dd>
            {describeShift(s)} · cho phép trễ {s.lateGraceMin} phút
          </dd>
          <dt className="text-muted-foreground">Lương cứng</dt>
          <dd>
            {s.baseSalary > 0 ? (
              <>
                {formatVND(s.baseSalary)} ({PAY_LABELS[s.payType].toLowerCase()}
                {s.payType === "monthly" ? `, ${s.standardDays} ngày công chuẩn` : ""}) · ≈ {formatVND(dailyRate(s))}/ngày công
              </>
            ) : (
              "Chưa có"
            )}
          </dd>
          {s.allowance > 0 && (
            <>
              <dt className="text-muted-foreground">Phụ cấp</dt>
              <dd>{formatVND(s.allowance)}/tháng</dd>
            </>
          )}
          {s.latePenalty > 0 && (
            <>
              <dt className="text-muted-foreground">Đi muộn</dt>
              <dd>trừ {formatVND(s.latePenalty)}/lần (quá {s.lateGraceMin} phút)</dd>
            </>
          )}
        </dl>
      )}
    </Panel>
  );
}

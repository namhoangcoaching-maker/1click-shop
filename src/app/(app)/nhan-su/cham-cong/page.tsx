import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, CalendarCheckIcon, LockIcon, LockOpenIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { EditDayForm, LockButton } from "@/components/staff/attendance-forms";
import { todayInVN } from "@/lib/date-range";
import { monthRange, recentMonths, resolveMonth } from "@/lib/finance/month";
import { getManagerOrg } from "@/lib/org/guard";
import { formatUnits, monthEditable, personMonth, vnTimeOf, weekday, type DayResult } from "@/lib/staff/attendance";
import { getAttendance, isMonthUnlocked } from "@/lib/staff/attendance-data";
import { getMembers } from "@/lib/staff/data";
import { formatVND } from "@/lib/format";
import { estimatePay } from "@/lib/staff/payroll";
import { canManage } from "@/lib/staff/permissions";
import { DAY_LABELS } from "@/lib/staff/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bảng chấm công" };

export default function AttendanceSheetPage({ searchParams }: PageProps<"/nhan-su/cham-cong">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <div className="flex items-center gap-2">
        <Link href="/nhan-su" className="rounded-md p-1 hover:bg-muted" aria-label="Về Nhân sự">
          <ArrowLeftIcon className="size-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">Bảng chấm công</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Sheet searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Ô một ngày: chữ ngắn để vừa bảng. */
function cell(d: DayResult): { text: string; className: string; title: string } {
  const times = d.row?.checkInAt ? `${vnTimeOf(d.row.checkInAt)}–${d.row.checkOutAt ? vnTimeOf(d.row.checkOutAt) : "?"}` : "";
  const note = d.row?.editNote ? ` · sửa: ${d.row.editNote}` : "";
  switch (d.status) {
    case "done":
      return {
        text: formatUnits(d.units),
        className: d.late ? "bg-warning/15 text-warning font-medium" : d.units < 1 ? "" : "text-success",
        title: `${times}${d.late ? ` · muộn ${d.lateMin} phút` : ""}${note}`,
      };
    case "working":
      return { text: "…", className: d.late ? "bg-warning/15 text-warning" : "text-primary", title: `Đang làm, vào ${times.slice(0, 5)}${note}` };
    case "missing_out":
      return { text: "?", className: "bg-warning/25 text-warning font-bold", title: `Thiếu giờ ra (vào ${times.slice(0, 5)})${note}` };
    case "absent":
      return { text: "V", className: "bg-destructive/10 text-destructive", title: `Vắng${note}` };
    case "pending":
      return { text: "", className: "", title: "Chưa vào ca" };
    case "off":
      return { text: "·", className: "text-muted-foreground/50", title: "Ngày nghỉ theo ca" };
    default:
      return { text: "", className: "", title: "" };
  }
}

async function Sheet({ searchParams }: Pick<PageProps<"/nhan-su/cham-cong">, "searchParams">) {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const sp = await searchParams;
  const today = todayInVN();
  const month = resolveMonth(sp.thang, today);
  const { from, to } = monthRange(month);
  const [members, rows, unlocked] = await Promise.all([getMembers(org.id), getAttendance(org.id, from, to), isMonthUnlocked(org.id, month)]);
  const people = members.filter((m) => canManage(org.role, m.role) && m.settings && !m.disabledAt);
  const sheet = people.map((m) => ({ m, pm: personMonth(rows.filter((r) => r.userId === m.userId), m.settings!.workDays, from, to, today) }));
  const editable = monthEditable(from, today, unlocked);
  const label = `${month.slice(5)}/${month.slice(0, 4)}`;
  const href = (extra = "") => `/nhan-su/cham-cong?thang=${month}${extra}`;

  // Ô đang sửa: ?sua=<userId>_<YYYY-MM-DD>
  const [editUser, editDate] = typeof sp.sua === "string" ? sp.sua.split("_") : [];
  const editing = sheet.find((x) => x.m.userId === editUser);
  const editDay = editing?.pm.days.find((d) => d.date === editDate);
  const canEditDay = (date: string) => editable && monthEditable(date, today, unlocked);
  const lockDeadline = (() => {
    const [y, mo] = month.split("-").map(Number);
    return mo === 12 ? `05/01/${y + 1}` : `05/${String(mo + 1).padStart(2, "0")}/${y}`;
  })();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Chọn tháng" className="flex flex-wrap gap-1.5">
          {recentMonths(today, 6).map((mo) => (
            <Link
              key={mo}
              href={`/nhan-su/cham-cong?thang=${mo}`}
              scroll={false}
              aria-current={mo === month ? "page" : undefined}
              className={cn("rounded-md border px-2.5 py-1 text-sm", mo === month ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card hover:bg-muted")}
            >
              Tháng {mo.slice(5)}/{mo.slice(0, 4)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {editable ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <LockOpenIcon className="size-4" aria-hidden />
              {unlocked ? "Chủ shop đã mở khóa sổ" : `Sửa được tới hết ${lockDeadline}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <LockIcon className="size-4" aria-hidden />
              Đã khóa sổ (quá {lockDeadline})
            </span>
          )}
          {org.role === "owner" && (unlocked || !editable) && <LockButton month={month} unlocked={unlocked} />}
        </div>
      </div>

      {editing && editDay && canEditDay(editDay.date) && (
        <EditDayForm
          key={sp.sua as string}
          userId={editing.m.userId}
          date={editDay.date}
          name={editing.m.displayName ?? editing.m.email ?? ""}
          dateLabel={`${DAY_LABELS[weekday(editDay.date) - 1]} ${editDay.date.slice(8)}/${editDay.date.slice(5, 7)}`}
          checkIn={editDay.row?.checkInAt ? vnTimeOf(editDay.row.checkInAt) : ""}
          checkOut={editDay.row?.checkOutAt ? vnTimeOf(editDay.row.checkOutAt) : ""}
          closeHref={href()}
        />
      )}

      <Panel title={`Tháng ${label}`} icon={CalendarCheckIcon} tone="green">
        {sheet.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có nhân sự nào được cấu hình ca làm (trang Cấu hình nhân sự).</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-[150px] bg-card py-2 pr-3 text-left font-normal">Nhân sự</th>
                  <th className="px-2 py-2 text-right font-normal">Công</th>
                  <th className="px-2 py-2 text-right font-normal">Muộn</th>
                  <th className="px-2 py-2 text-right font-normal whitespace-nowrap">Lương dự kiến</th>
                  {sheet[0].pm.days.map((d) => (
                    <th key={d.date} className={cn("w-9 px-0.5 py-2 text-center font-normal", d.date === today && "text-primary font-semibold")}>
                      <div className="text-[10px]">{DAY_LABELS[weekday(d.date) - 1]}</div>
                      <div>{d.date.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.map(({ m, pm }) => (
                  <tr key={m.userId} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card py-2 pr-3">
                      <div className="font-medium">{m.displayName ?? m.email}</div>
                      {pm.summary.missingOut > 0 && <div className="text-xs text-warning">{pm.summary.missingOut} ngày thiếu giờ ra</div>}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatUnits(pm.summary.units)}</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", pm.summary.lateCount > 0 && "text-warning")}>{pm.summary.lateCount}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                      {m.settings!.baseSalary > 0 ? formatVND(estimatePay(m.settings!, pm).sofar.total) : "—"}
                    </td>
                    {pm.days.map((d) => {
                      const c = cell(d);
                      const selected = editing?.m.userId === m.userId && editDate === d.date;
                      const inner = (
                        <span className={cn("flex h-8 w-9 items-center justify-center rounded tabular-nums", c.className, selected && "ring-2 ring-primary")}>
                          {c.text}
                        </span>
                      );
                      return (
                        <td key={d.date} className="px-0.5 py-1 text-center" title={c.title}>
                          {canEditDay(d.date) ? (
                            <Link href={href(`&sua=${m.userId}_${d.date}`)} scroll={false} className="block rounded hover:bg-muted" aria-label={`Sửa công ${d.date}`}>
                              {inner}
                            </Link>
                          ) : (
                            inner
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <b className="text-success">1</b> đủ công · <b>0,75</b> làm 3/4 ca
          </span>
          <span>
            <b className="text-warning">ô vàng</b> đi muộn
          </span>
          <span>
            <b className="text-warning">?</b> thiếu giờ ra (chưa có công)
          </span>
          <span>
            <b className="text-destructive">V</b> vắng
          </span>
          <span>… đang làm · “·” ngày nghỉ theo ca</span>
          <span>Rê chuột vào ô xem giờ vào/ra; bấm ô để sửa.</span>
        </div>
      </Panel>
    </>
  );
}

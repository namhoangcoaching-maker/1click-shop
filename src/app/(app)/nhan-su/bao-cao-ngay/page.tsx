import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, RepeatIcon, SendIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { AddTaskForm, ArchiveRecurringButton, DayTaskList, ManagerNoteForm, RecurringForm } from "@/components/staff/work-plan-forms";
import { addDays, todayInVN } from "@/lib/date-range";
import { getManagerOrg } from "@/lib/org/guard";
import { vnTimeOf, weekday } from "@/lib/staff/attendance";
import { getMembers } from "@/lib/staff/data";
import { getKpiMonth } from "@/lib/staff/kpi-data";
import { canManage } from "@/lib/staff/permissions";
import { DAY_LABELS } from "@/lib/staff/settings";
import { getWorkDay } from "@/lib/staff/work-plan-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Báo cáo ngày" };

export default function DailyWorkPage({ searchParams }: PageProps<"/nhan-su/bao-cao-ngay">) {
  return (
    <main className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-4 md:px-6">
      <div className="flex items-center gap-2">
        <Link href="/nhan-su" className="rounded-md p-1 hover:bg-muted" aria-label="Về Nhân sự">
          <ArrowLeftIcon className="size-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">Kế hoạch và báo cáo ngày</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Day searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const label = (d: string) => `${DAY_LABELS[weekday(d) - 1]} ${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function Day({ searchParams }: Pick<PageProps<"/nhan-su/bao-cao-ngay">, "searchParams">) {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const today = todayInVN();
  const raw = (await searchParams).ngay;
  const day = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= addDays(today, 30) ? raw : today;

  const members = (await getMembers(org.id)).filter((m) => !m.disabledAt && canManage(org.role, m.role) && m.settings);
  const people = members.map((m) => ({ userId: m.userId, department: m.department }));
  const [work, kpi] = await Promise.all([
    getWorkDay(org.id, day, people),
    getKpiMonth(org.id, day.slice(0, 7), today, members.map((m) => ({ userId: m.userId, department: m.department, sellerId: m.settings?.pancakeSellerId ?? null }))),
  ]);
  const name = (m: (typeof members)[number]) => m.displayName ?? m.email ?? "";
  const departments = [...new Set(members.map((m) => m.department).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, "vi"));
  const sent = members.filter((m) => work.byUser.get(m.userId)?.report?.submittedAt).length;
  const recurring = work.recurringAll.filter((r) => !r.archived);
  const nav = (d: string) => `/nhan-su/bao-cao-ngay?ngay=${d}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={nav(addDays(day, -1))} scroll={false} className="rounded-md border bg-card p-1.5 hover:bg-muted" aria-label="Ngày trước">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="min-w-[150px] text-center font-semibold">
            {label(day)}
            {day === today && <span className="ml-1 text-primary">(hôm nay)</span>}
          </span>
          <Link href={nav(addDays(day, 1))} scroll={false} className="rounded-md border bg-card p-1.5 hover:bg-muted" aria-label="Ngày sau">
            <ChevronRightIcon className="size-4" />
          </Link>
          {day !== today && (
            <Link href={nav(today)} scroll={false} className="ml-1 text-sm text-primary hover:underline">
              Hôm nay
            </Link>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          <SendIcon className="mr-1 inline size-4" aria-hidden />
          {sent}/{members.length} người đã gửi báo cáo
        </span>
      </div>

      <Panel title="Giao việc" icon={ClipboardListIcon} tone="blue">
        <AddTaskForm people={members.map((m) => ({ userId: m.userId, name: name(m) }))} defaultDate={day >= today ? day : today} />
        <p className="mt-2 text-xs text-muted-foreground">Việc chưa xong tự chuyển sang ngày làm kế tiếp (ghi “trễ từ ngày …”).</p>
      </Panel>

      {members.length === 0 && <p className="text-sm text-muted-foreground">Chưa có nhân sự nào được cấu hình.</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {members.map((m) => {
          const d = work.byUser.get(m.userId)!;
          const r = d.report;
          const manual = (kpi.byUser.get(m.userId) ?? []).filter((k) => k.template.source === "manual");
          return (
            <Panel
              key={m.userId}
              title={name(m)}
              action={
                <span className="flex items-center gap-2 text-xs">
                  {d.summary.total > 0 && (
                    <span className="tabular-nums text-muted-foreground">
                      Xong {d.summary.done}/{d.summary.total}
                    </span>
                  )}
                  {r?.submittedAt ? (
                    <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">Đã gửi {vnTimeOf(r.submittedAt)}</span>
                  ) : day <= today ? (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning">Chưa gửi</span>
                  ) : null}
                </span>
              }
            >
              {m.department && <p className="-mt-2 mb-2 text-xs text-muted-foreground">{m.department}</p>}
              <DayTaskList
                userId={m.userId}
                date={day}
                canTick={day === today}
                tasks={d.tasks.map((t) => ({
                  id: t.task.id,
                  title: t.task.title,
                  done: t.done,
                  lateFrom: t.lateFrom,
                  selfAdded: t.selfAdded,
                  removable: true,
                }))}
                recurring={d.recurring.map((x) => ({ id: x.id, title: x.title, done: d.recurringDone.has(x.id) }))}
              />
              {manual.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {manual.map((k) => (
                    <span key={k.assignment.id}>
                      {k.template.name}: <b className="tabular-nums">{(d.kpiValues.get(k.assignment.id) ?? 0).toLocaleString("vi-VN")}</b> {k.template.unitLabel ?? "lần"}
                    </span>
                  ))}
                </div>
              )}
              {r?.submittedAt && (
                <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                  {r.resultText && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Kết quả</dt>
                      <dd className="whitespace-pre-line">{r.resultText}</dd>
                    </div>
                  )}
                  {r.blockers && (
                    <div>
                      <dt className="text-xs text-destructive">Vướng mắc / cần hỗ trợ</dt>
                      <dd className="whitespace-pre-line">{r.blockers}</dd>
                    </div>
                  )}
                  {r.tomorrow && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Kế hoạch ngày mai</dt>
                      <dd className="whitespace-pre-line">{r.tomorrow}</dd>
                    </div>
                  )}
                </dl>
              )}
              {r?.submittedAt && (
                <div className="mt-3">
                  <ManagerNoteForm key={r.managerNote ?? ""} userId={m.userId} date={day} note={r.managerNote ?? ""} />
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Việc lặp lại" icon={RepeatIcon} tone="slate">
        <RecurringForm people={members.map((m) => ({ userId: m.userId, name: name(m) }))} departments={org.role === "owner" ? departments : null} />
        {recurring.length > 0 && (
          <div className="mt-3 divide-y text-sm">
            {recurring.map((x) => {
              const target = members.find((m) => m.userId === x.userId);
              const can = x.userId ? !!target : org.role === "owner";
              return (
                <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>
                    {x.title}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {x.userId ? (target ? name(target) : "người khác") : `bộ phận ${x.department}`} ·{" "}
                      {x.workDays.length === 7 ? "cả tuần" : x.workDays.map((w) => DAY_LABELS[w - 1]).join(", ")}
                    </span>
                  </span>
                  {can && <ArchiveRecurringButton id={x.id} />}
                </div>
              );
            })}
          </div>
        )}
        <p className={cn("mt-2 text-xs text-muted-foreground")}>
          Việc lặp lại tự hiện ở kế hoạch các ngày đã chọn; không xong thì không dồn sang ngày sau.
          {org.role !== "owner" && " Giao cho cả bộ phận do Chủ shop làm."}
        </p>
      </Panel>
    </>
  );
}

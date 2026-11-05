/**
 * Kế hoạch hôm nay + báo cáo cuối ngày (Giai đoạn 6.5, thuần, có unit test). Chủ dự án chốt 05/11/2026:
 *  • Việc giao / tự thêm chưa xong TỰ HIỆN LẠI các ngày sau, ghi "trễ từ ngày …".
 *  • Việc lặp lại hiện theo thứ trong tuần, tích xong theo ngày, KHÔNG dồn sang ngày sau.
 *  • Số KPI nhập tay trong báo cáo ngày cộng dồn thành kết quả tháng; số Quản lý nhập cho tháng thắng.
 */
import type { DateString } from "@/lib/date-range";
import { vnDateOf, weekday } from "./attendance";

export interface Task {
  id: string;
  userId: string;
  title: string;
  dueDate: DateString;
  createdBy: string | null;
  doneAt: string | null;
}

export interface RecurringTask {
  id: string;
  title: string;
  userId: string | null;
  department: string | null;
  workDays: number[];
  startDate: DateString;
  archived: boolean;
}

export interface DayTask {
  task: Task;
  /** Xong trong ngày đang xem. */
  done: boolean;
  /** Ngày giao gốc nếu là việc trễ (dồn từ ngày trước). */
  lateFrom: DateString | null;
  /** Người làm tự thêm. */
  selfAdded: boolean;
}

/** Việc (giao / tự thêm) hiện ở ngày `day` của một người. */
export function tasksForDay(tasks: Task[], userId: string, day: DateString): DayTask[] {
  return tasks
    .filter((t) => t.userId === userId && t.dueDate <= day && (t.doneAt === null || vnDateOf(t.doneAt) >= day))
    .map((t) => ({
      task: t,
      done: t.doneAt !== null && vnDateOf(t.doneAt) === day,
      lateFrom: t.dueDate < day ? t.dueDate : null,
      selfAdded: t.createdBy === userId,
    }))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.task.dueDate < b.task.dueDate ? -1 : a.task.dueDate > b.task.dueDate ? 1 : 0) || a.task.title.localeCompare(b.task.title, "vi"));
}

/** Việc lặp lại áp cho người này ở ngày `day` (gắn đích danh hoặc bộ phận của họ). */
export function recurringForDay(list: RecurringTask[], userId: string, department: string | null, day: DateString): RecurringTask[] {
  const wd = weekday(day);
  return list.filter(
    (r) =>
      !r.archived &&
      r.startDate <= day &&
      r.workDays.includes(wd) &&
      (r.userId === userId || (r.department !== null && r.department === department)),
  );
}

/** Đếm việc xong / tổng trong ngày. */
export function daySummary(tasks: DayTask[], recurring: RecurringTask[], recurringDone: Set<string>) {
  const total = tasks.length + recurring.length;
  const done = tasks.filter((t) => t.done).length + recurring.filter((r) => recurringDone.has(r.id)).length;
  const late = tasks.filter((t) => !t.done && t.lateFrom !== null).length;
  return { total, done, late };
}

/** Kết quả KPI nhập tay của tháng: số Quản lý nhập (nếu có) thắng, không thì tổng các ngày báo cáo. */
export function manualKpiActual(managerValue: number | null | undefined, dailySum: number | null | undefined): number | null {
  if (managerValue !== null && managerValue !== undefined) return managerValue;
  return dailySum ?? null;
}

export function taskFromDb(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    dueDate: r.due_date as string,
    createdBy: (r.created_by as string | null) ?? null,
    doneAt: (r.done_at as string | null) ?? null,
  };
}

export function recurringFromDb(r: Record<string, unknown>): RecurringTask {
  return {
    id: r.id as string,
    title: r.title as string,
    userId: (r.user_id as string | null) ?? null,
    department: (r.department as string | null) ?? null,
    workDays: (r.work_days as number[]) ?? [],
    startDate: r.start_date as string,
    archived: !!r.archived_at,
  };
}

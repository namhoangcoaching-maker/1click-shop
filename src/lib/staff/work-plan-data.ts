import "server-only";
import type { DateString } from "@/lib/date-range";
import { createClient } from "@/lib/supabase/server";
import { vnToIso } from "./attendance";
import { daySummary, recurringForDay, recurringFromDb, taskFromDb, tasksForDay, type DayTask, type RecurringTask } from "./work-plan";

export interface WorkReport {
  resultText: string | null;
  blockers: string | null;
  tomorrow: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  managerNote: string | null;
  managerNoteAt: string | null;
}

export interface PersonDay {
  tasks: DayTask[];
  recurring: RecurringTask[];
  recurringDone: Set<string>;
  report: WorkReport | null;
  /** Số KPI nhập tay của ngày, theo mã KPI gắn. */
  kpiValues: Map<string, number>;
  summary: { total: number; done: number; late: number };
}

export interface WorkDay {
  byUser: Map<string, PersonDay>;
  /** Mọi việc lặp lại đọc được (để quản lý danh sách). */
  recurringAll: RecurringTask[];
}

/**
 * Kế hoạch + báo cáo ngày `day` của những người `people`. Đọc qua RLS: Nhân viên chỉ ra phần của mình;
 * Quản lý ra Nhân viên; Chủ ra cả shop.
 */
export async function getWorkDay(orgId: string, day: DateString, people: { userId: string; department: string | null }[]): Promise<WorkDay> {
  const supabase = await createClient();
  const ids = people.map((p) => p.userId);
  if (ids.length === 0) return { byUser: new Map(), recurringAll: [] };
  const dayStart = vnToIso(day, "00:00")!;
  const [tRes, rRes, rdRes, wrRes, kdRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, user_id, title, due_date, created_by, done_at")
      .eq("org_id", orgId)
      .in("user_id", ids)
      .lte("due_date", day)
      .or(`done_at.is.null,done_at.gte.${dayStart}`),
    supabase.from("recurring_tasks").select("id, title, user_id, department, work_days, start_date, archived_at").eq("org_id", orgId).order("created_at"),
    supabase.from("recurring_done").select("recurring_id, user_id").eq("org_id", orgId).eq("work_date", day).in("user_id", ids),
    supabase
      .from("work_reports")
      .select("user_id, result_text, blockers, tomorrow, submitted_at, updated_at, manager_note, manager_note_at")
      .eq("org_id", orgId)
      .eq("work_date", day)
      .in("user_id", ids),
    supabase.from("kpi_daily").select("assignment_id, user_id, value").eq("org_id", orgId).eq("work_date", day).in("user_id", ids),
  ]);
  if (tRes.error) throw new Error(`Không đọc được việc: ${tRes.error.message}`);
  const tasks = (tRes.data ?? []).map(taskFromDb);
  const recurringAll = (rRes.data ?? []).map(recurringFromDb);

  const byUser = new Map<string, PersonDay>();
  for (const p of people) {
    const dayTasks = tasksForDay(tasks, p.userId, day);
    const recurring = recurringForDay(recurringAll, p.userId, p.department, day);
    const recurringDone = new Set((rdRes.data ?? []).filter((r) => r.user_id === p.userId).map((r) => r.recurring_id as string));
    const w = (wrRes.data ?? []).find((r) => r.user_id === p.userId);
    byUser.set(p.userId, {
      tasks: dayTasks,
      recurring,
      recurringDone,
      report: w
        ? {
            resultText: w.result_text,
            blockers: w.blockers,
            tomorrow: w.tomorrow,
            submittedAt: w.submitted_at,
            updatedAt: w.updated_at,
            managerNote: w.manager_note,
            managerNoteAt: w.manager_note_at,
          }
        : null,
      kpiValues: new Map((kdRes.data ?? []).filter((r) => r.user_id === p.userId).map((r) => [r.assignment_id as string, Number(r.value)])),
      summary: daySummary(dayTasks, recurring, recurringDone),
    });
  }
  return { byUser, recurringAll };
}

/** Ai đã gửi báo cáo ngày `day` (cho cột Hôm nay ở trang Nhân sự). */
export async function reportedUsers(orgId: string, day: DateString): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("work_reports").select("user_id").eq("org_id", orgId).eq("work_date", day).not("submitted_at", "is", null);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { RepeatIcon, Trash2Icon } from "lucide-react";
import {
  addRecurring,
  addTask,
  archiveRecurring,
  removeTask,
  saveManagerNote,
  saveReport,
  setRecurringDone,
  setTaskDone,
  type PlanState,
} from "@/lib/staff/work-plan-actions";
import { DAY_LABELS } from "@/lib/staff/settings";
import { cn } from "@/lib/utils";

const input = "h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary";
const btn = "h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60";
const ddmm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

function Msg({ s }: { s: PlanState }) {
  if (!s.message) return null;
  return <span className={`text-xs ${s.ok ? "text-success" : "text-destructive"}`}>{s.message}</span>;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  lateFrom: string | null;
  selfAdded: boolean;
  removable: boolean;
}

export interface RecurringItem {
  id: string;
  title: string;
  done: boolean;
}

/** Danh sách việc trong ngày có ô tích xong. `canTick` = được tích (người làm hôm nay, hoặc người quản lý). */
export function DayTaskList({
  userId,
  date,
  tasks,
  recurring,
  canTick,
}: {
  userId: string;
  date: string;
  tasks: TaskItem[];
  recurring: RecurringItem[];
  canTick: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<PlanState>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.message ?? "Không lưu được."));
    });

  if (tasks.length === 0 && recurring.length === 0) return <p className="text-sm text-muted-foreground">Chưa có việc nào.</p>;
  return (
    <div className={cn("space-y-1", pending && "opacity-70")}>
      {recurring.map((r) => (
        <label key={r.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-success)]"
            checked={r.done}
            disabled={!canTick || pending}
            onChange={(e) => run(() => setRecurringDone(r.id, userId, date, e.target.checked))}
          />
          <span className={cn("flex-1", r.done && "text-muted-foreground line-through")}>{r.title}</span>
          <RepeatIcon className="size-3.5 text-muted-foreground" aria-label="Việc lặp lại" />
        </label>
      ))}
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60">
          <input
            type="checkbox"
            aria-label={t.title}
            className="size-4 accent-[var(--color-success)]"
            checked={t.done}
            disabled={!canTick || pending}
            onChange={(e) => run(() => setTaskDone(t.id, e.target.checked))}
          />
          <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>
            {t.title}
            {t.lateFrom && !t.done && <span className="ml-1.5 rounded bg-warning/15 px-1 text-xs text-warning">trễ từ {ddmm(t.lateFrom)}</span>}
            {t.selfAdded && <span className="ml-1.5 text-xs text-muted-foreground">tự thêm</span>}
          </span>
          {t.removable && (
            <button type="button" onClick={() => run(() => removeTask(t.id))} disabled={pending} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label={`Xóa ${t.title}`}>
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Thêm việc: nhân viên tự thêm (chỉ tên); quản lý giao (chọn người + ngày). */
export function AddTaskForm({ people, defaultDate }: { people?: { userId: string; name: string }[]; defaultDate: string }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(addTask, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      {people && (
        <select name="userId" required defaultValue="" aria-label="Giao cho" className={input}>
          <option value="" disabled>
            Giao cho…
          </option>
          {people.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <input name="title" required maxLength={200} placeholder={people ? "Việc cần làm" : "Thêm việc của bạn…"} aria-label="Tên việc" className={cn(input, "min-w-[200px] flex-1")} />
      {people && <input type="date" name="dueDate" defaultValue={defaultDate} aria-label="Ngày" className={input} />}
      <button type="submit" disabled={pending} className={btn}>
        {people ? "Giao việc" : "Thêm"}
      </button>
      <Msg s={state} />
    </form>
  );
}

export interface KpiInput {
  assignmentId: string;
  name: string;
  unit: string;
  value: number | null;
}

/** Báo cáo cuối ngày của chính mình (hôm nay): số KPI nhập tay + 3 ô chữ. */
export function ReportForm({
  kpis,
  resultText,
  blockers,
  tomorrow,
  submitted,
}: {
  kpis: KpiInput[];
  resultText: string;
  blockers: string;
  tomorrow: string;
  submitted: boolean;
}) {
  const [state, action, pending] = useActionState<PlanState, FormData>(saveReport, {});
  const area = "w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";
  return (
    <form action={action} className="space-y-3 text-sm">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kpis.map((k) => (
            <label key={k.assignmentId} className="space-y-1 rounded-md bg-muted px-2.5 py-2">
              <span className="block text-xs text-muted-foreground">{k.name} hôm nay</span>
              <span className="flex items-center gap-1.5">
                <input
                  name={`kpi:${k.assignmentId}`}
                  inputMode="decimal"
                  defaultValue={k.value === null ? "" : String(k.value).replace(".", ",")}
                  placeholder="0"
                  className="h-8 w-20 rounded-md border border-input bg-card px-2 text-right tabular-nums"
                />
                <span className="text-xs text-muted-foreground">{k.unit}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Kết quả hôm nay</span>
        <textarea name="resultText" rows={3} maxLength={2000} defaultValue={resultText} className={area} placeholder="Đã làm được gì, số liệu nổi bật…" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Vướng mắc / cần hỗ trợ</span>
        <textarea name="blockers" rows={2} maxLength={2000} defaultValue={blockers} className={area} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Kế hoạch ngày mai</span>
        <textarea name="tomorrow" rows={2} maxLength={2000} defaultValue={tomorrow} className={area} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Đang gửi…" : submitted ? "Cập nhật báo cáo" : "Gửi báo cáo"}
        </button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function ManagerNoteForm({ userId, date, note }: { userId: string; date: string; note: string }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(saveManagerNote, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="date" value={date} />
      <input name="note" defaultValue={note} maxLength={1000} placeholder="Nhận xét của Quản lý…" aria-label="Nhận xét" className={cn(input, "min-w-[220px] flex-1")} />
      <button type="submit" disabled={pending} className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted disabled:opacity-60">
        Lưu nhận xét
      </button>
      <Msg s={state} />
    </form>
  );
}

/** Tạo việc lặp lại theo thứ trong tuần. */
export function RecurringForm({ people, departments }: { people: { userId: string; name: string }[]; departments: string[] | null }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(addRecurring, {});
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <input name="title" required maxLength={200} placeholder="Ví dụ: Trả lời hết tin nhắn page trước 21:00" aria-label="Tên việc" className={cn(input, "min-w-[240px] flex-1")} />
        <select name="who" required defaultValue="" aria-label="Giao cho" className={input}>
          <option value="" disabled>
            Giao cho…
          </option>
          <optgroup label="Người">
            {people.map((p) => (
              <option key={p.userId} value={`user:${p.userId}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
          {departments && departments.length > 0 && (
            <optgroup label="Cả bộ phận">
              {departments.map((d) => (
                <option key={d} value={`dept:${d}`}>
                  Bộ phận {d}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {DAY_LABELS.map((l, i) => (
          <label key={l} className="inline-flex items-center gap-1">
            <input type="checkbox" name="workDays" value={i + 1} defaultChecked={i < 6} />
            {l}
          </label>
        ))}
        <button type="submit" disabled={pending} className={btn}>
          Tạo việc lặp lại
        </button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function ArchiveRecurringButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await archiveRecurring(id)))}
      className="h-8 rounded-md border bg-card px-2.5 text-xs text-destructive hover:bg-muted disabled:opacity-60"
    >
      Bỏ
    </button>
  );
}

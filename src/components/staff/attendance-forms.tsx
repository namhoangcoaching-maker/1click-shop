"use client";

import Link from "next/link";
import { useActionState } from "react";
import { editAttendance, setMonthLock, type EditState } from "@/lib/staff/attendance-actions";

/** Sửa một ô bảng công: giờ vào, giờ ra, lý do (bắt buộc). */
export function EditDayForm({
  userId,
  date,
  name,
  dateLabel,
  checkIn,
  checkOut,
  closeHref,
}: {
  userId: string;
  date: string;
  name: string;
  dateLabel: string;
  checkIn: string;
  checkOut: string;
  closeHref: string;
}) {
  const [state, action, pending] = useActionState<EditState, FormData>(editAttendance, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-primary/40 bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold">
          Sửa công: {name} · {dateLabel}
        </div>
        <Link href={closeHref} scroll={false} className="text-xs text-muted-foreground hover:underline">
          Đóng
        </Link>
      </div>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Giờ vào</span>
          <input type="time" name="in" defaultValue={checkIn} className="h-9 rounded-md border border-input bg-card px-2" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Giờ ra</span>
          <input type="time" name="out" defaultValue={checkOut} className="h-9 rounded-md border border-input bg-card px-2" />
        </label>
        <label className="min-w-[220px] flex-1 space-y-1">
          <span className="block text-xs text-muted-foreground">Lý do sửa (bắt buộc)</span>
          <input
            name="note"
            required
            minLength={2}
            maxLength={200}
            placeholder="Ví dụ: quên bấm Ra ca, Quản lý xác nhận về 17:30"
            className="h-9 w-full rounded-md border border-input bg-card px-2"
          />
        </label>
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Để trống cả giờ vào và giờ ra = ghi nhận không đi làm ngày này.</p>
      {state.message && <p className={state.ok ? "text-success" : "text-destructive"}>{state.message}</p>}
    </form>
  );
}

/** Nút Chủ shop mở khóa / khóa lại sổ chấm công của tháng. */
export function LockButton({ month, unlocked }: { month: string; unlocked: boolean }) {
  const [state, action, pending] = useActionState<EditState, FormData>(setMonthLock, {});
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="action" value={unlocked ? "lock" : "unlock"} />
      <button type="submit" disabled={pending} className="h-8 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
        {unlocked ? "Khóa sổ lại" : "Mở khóa sổ để sửa"}
      </button>
      {state.message && !state.ok && <span className="text-xs text-destructive">{state.message}</span>}
    </form>
  );
}

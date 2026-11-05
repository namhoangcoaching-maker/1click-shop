"use client";

import { useActionState, useState, useTransition } from "react";
import { addMember, resetMemberPassword, setMemberLocked, updateMember, type StaffState } from "@/lib/staff/actions";
import { PASSWORD_MIN } from "@/lib/staff/validate";
import { cn } from "@/lib/utils";

export interface MemberRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "manager" | "staff";
  department: string | null;
  locked: boolean;
  /** "05/11/2026 08:02" hoặc null nếu chưa đăng nhập lần nào. */
  lastSignIn: string | null;
  isMe: boolean;
}

const ROLE_OPTIONS = [
  { value: "staff", label: "Nhân viên" },
  { value: "manager", label: "Quản lý" },
  { value: "owner", label: "Chủ shop" },
] as const;
const roleLabel = (r: MemberRow["role"]) => ROLE_OPTIONS.find((o) => o.value === r)!.label;

const input = "h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-primary disabled:opacity-60";
const button = "h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60";

function Message({ state }: { state: StaffState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={cn("text-sm", state.ok ? "text-success" : "text-destructive")}>
      {state.message}
    </p>
  );
}

/** Ô thêm nhân viên (chỉ Chủ shop). */
export function AddMemberForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(addMember, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input name="displayName" required maxLength={80} placeholder="Họ tên" className={input} aria-label="Họ tên" />
        <input name="email" type="email" required placeholder="Email đăng nhập" className={input} aria-label="Email" />
        <input
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          placeholder={`Mật khẩu tạm (≥ ${PASSWORD_MIN} ký tự)`}
          autoComplete="off"
          className={input}
          aria-label="Mật khẩu tạm"
        />
        <input name="department" maxLength={60} placeholder="Bộ phận (không bắt buộc)" className={input} aria-label="Bộ phận" />
        <select name="role" defaultValue="staff" className={input} aria-label="Vai trò">
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {pending ? "Đang thêm…" : "Thêm nhân viên"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

function MemberEditor({ m, canEdit }: { m: MemberRow; canEdit: boolean }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(updateMember, {});
  const [pwState, pwAction, pwPending] = useActionState<StaffState, FormData>(resetMemberPassword, {});
  const [lockState, setLockState] = useState<StaffState>({});
  const [locking, startLock] = useTransition();
  const [showReset, setShowReset] = useState(false);

  return (
    <li className={cn("space-y-2 py-3", m.locked && "opacity-60")}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="font-semibold">{m.displayName ?? "(chưa đặt tên)"}</span>
        {m.isMe && <span className="text-xs text-primary">bạn</span>}
        <span className="text-muted-foreground">{m.email ?? "—"}</span>
        <span className="rounded bg-muted px-1.5 text-xs">{roleLabel(m.role)}</span>
        {m.department && <span className="text-xs text-muted-foreground">· {m.department}</span>}
        {m.locked && <span className="rounded bg-destructive/10 px-1.5 text-xs text-destructive">Đã khóa</span>}
        <span className="ml-auto text-xs text-muted-foreground">
          {m.lastSignIn ? `Đăng nhập gần nhất ${m.lastSignIn}` : "Chưa đăng nhập lần nào"}
        </span>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <form action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={m.userId} />
            <input name="displayName" defaultValue={m.displayName ?? ""} required maxLength={80} placeholder="Họ tên" className={cn(input, "w-44")} aria-label={`Họ tên ${m.email}`} />
            <input name="department" defaultValue={m.department ?? ""} maxLength={60} placeholder="Bộ phận" className={cn(input, "w-36")} aria-label={`Bộ phận ${m.email}`} />
            <select name="role" defaultValue={m.role} disabled={m.isMe} className={cn(input, "w-32")} aria-label={`Vai trò ${m.email}`}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {m.isMe && <input type="hidden" name="role" value={m.role} />}
            <button type="submit" disabled={pending} className={button}>
              Lưu
            </button>
            {!m.isMe && (
              <button
                type="button"
                disabled={locking}
                onClick={() => startLock(async () => setLockState(await setMemberLocked(m.userId, !m.locked)))}
                className={cn(button, !m.locked && "text-destructive")}
              >
                {m.locked ? "Mở khóa" : "Khóa (nghỉ việc)"}
              </button>
            )}
            {!m.isMe && m.role !== "owner" && (
              <button type="button" onClick={() => setShowReset((v) => !v)} className={button}>
                Đặt lại mật khẩu
              </button>
            )}
            <Message state={state} />
            <Message state={lockState} />
          </form>

          {showReset && (
            <form action={pwAction} className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2">
              <input type="hidden" name="userId" value={m.userId} />
              <input
                name="password"
                type="text"
                required
                minLength={PASSWORD_MIN}
                autoComplete="off"
                placeholder={`Mật khẩu mới (≥ ${PASSWORD_MIN} ký tự)`}
                className={cn(input, "w-56")}
                aria-label={`Mật khẩu mới cho ${m.email}`}
              />
              <button type="submit" disabled={pwPending} className={button}>
                Đặt mật khẩu
              </button>
              <Message state={pwState} />
            </form>
          )}
        </div>
      )}
    </li>
  );
}

/** Danh sách thành viên. Chủ shop sửa được; Quản lý chỉ xem. */
export function MemberList({ members, canEdit }: { members: MemberRow[]; canEdit: boolean }) {
  return (
    <ul className="divide-y">
      {members.map((m) => (
        <MemberEditor key={m.userId} m={m} canEdit={canEdit} />
      ))}
    </ul>
  );
}

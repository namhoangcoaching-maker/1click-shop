"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addLocation,
  addMember,
  copyStaffSettings,
  removeLocation,
  resetMemberPassword,
  saveStaffSettings,
  setMemberLocked,
  updateMember,
  type StaffState,
} from "@/lib/staff/actions";
import { ATTENDANCE_LABELS, DAY_LABELS, PAY_LABELS, type StaffSettings } from "@/lib/staff/settings";
import { PASSWORD_MIN } from "@/lib/staff/validate";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "staff";
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "staff", label: "Nhân viên" },
  { value: "manager", label: "Quản lý" },
  { value: "owner", label: "Chủ shop" },
];

export const inputCls =
  "h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-primary disabled:opacity-60";
const buttonCls = "h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60";
const primaryCls = "h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60";

export function Message({ state }: { state: StaffState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={cn("text-sm", state.ok ? "text-success" : "text-destructive")}>
      {state.message}
    </p>
  );
}

/** Thêm nhân sự. `roles`: vai trò được phép tạo (Quản lý chỉ có Nhân viên). */
export function AddMemberForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(addMember, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input name="displayName" required maxLength={80} placeholder="Họ tên" className={inputCls} aria-label="Họ tên" />
        <input name="email" type="email" required placeholder="Email đăng nhập" className={inputCls} aria-label="Email" />
        <input
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          placeholder={`Mật khẩu tạm (≥ ${PASSWORD_MIN} ký tự)`}
          autoComplete="off"
          className={inputCls}
          aria-label="Mật khẩu tạm"
        />
        <input name="department" maxLength={60} placeholder="Bộ phận (bán hàng, đóng gói…)" className={inputCls} aria-label="Bộ phận" />
        <select name="role" defaultValue="staff" className={inputCls} aria-label="Vai trò">
          {ROLE_OPTIONS.filter((o) => roles.includes(o.value)).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryCls}>
          {pending ? "Đang thêm…" : "Thêm nhân sự"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

/** Họ tên, bộ phận, vai trò. */
export function ProfileForm({
  userId,
  displayName,
  department,
  role,
  roles,
  isMe,
}: {
  userId: string;
  displayName: string | null;
  department: string | null;
  role: Role;
  roles: Role[];
  isMe: boolean;
}) {
  const [state, action, pending] = useActionState<StaffState, FormData>(updateMember, {});
  const lockedRole = isMe || !roles.includes(role);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-sm">
          Họ tên
          <input name="displayName" defaultValue={displayName ?? ""} required maxLength={80} className={cn(inputCls, "w-full")} />
        </label>
        <label className="text-sm">
          Bộ phận
          <input name="department" defaultValue={department ?? ""} maxLength={60} className={cn(inputCls, "w-full")} />
        </label>
        <label className="text-sm">
          Vai trò
          <select name="role" defaultValue={role} disabled={lockedRole} className={cn(inputCls, "w-full")}>
            {ROLE_OPTIONS.filter((o) => o.value === role || roles.includes(o.value)).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {lockedRole && <input type="hidden" name="role" value={role} />}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonCls}>
          Lưu thông tin
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

/** Khóa (nghỉ việc) / mở khóa + đặt lại mật khẩu. */
export function AccountActions({ userId, locked, canReset }: { userId: string; locked: boolean; canReset: boolean }) {
  const [lockState, setLockState] = useState<StaffState>({});
  const [locking, startLock] = useTransition();
  const [showReset, setShowReset] = useState(false);
  const [pwState, pwAction, pwPending] = useActionState<StaffState, FormData>(resetMemberPassword, {});
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={locking}
          onClick={() => {
            if (!locked && !window.confirm("Khóa tài khoản này? Người đó sẽ không vào được shop nữa (dữ liệu cũ vẫn giữ).")) return;
            startLock(async () => setLockState(await setMemberLocked(userId, !locked)));
          }}
          className={cn(buttonCls, !locked && "text-destructive")}
        >
          {locked ? "Mở khóa" : "Khóa (nghỉ việc)"}
        </button>
        {canReset && (
          <button type="button" onClick={() => setShowReset((v) => !v)} className={buttonCls}>
            Đặt lại mật khẩu
          </button>
        )}
        <Message state={lockState} />
      </div>
      {showReset && (
        <form action={pwAction} className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2">
          <input type="hidden" name="userId" value={userId} />
          <input
            name="password"
            type="text"
            required
            minLength={PASSWORD_MIN}
            autoComplete="off"
            placeholder={`Mật khẩu mới (≥ ${PASSWORD_MIN} ký tự)`}
            className={cn(inputCls, "w-56")}
            aria-label="Mật khẩu mới"
          />
          <button type="submit" disabled={pwPending} className={buttonCls}>
            Đặt mật khẩu
          </button>
          <Message state={pwState} />
        </form>
      )}
    </div>
  );
}

const money = (n: number) => (n ? n.toLocaleString("vi-VN") : "");

/** Cấu hình chấm công, ca làm, lương cứng. */
export function SettingsForm({
  userId,
  settings,
  locations,
}: {
  userId: string;
  settings: StaffSettings;
  locations: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StaffState, FormData>(saveStaffSettings, {});
  const [mode, setMode] = useState(settings.attendanceMode);
  const [payType, setPayType] = useState(settings.payType);
  const salaryLabel = payType === "monthly" ? "Lương tháng (đồng)" : payType === "daily" ? "Đơn giá một ngày công (đồng)" : "Đơn giá một giờ (đồng)";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Chấm công</legend>
        {(Object.keys(ATTENDANCE_LABELS) as (keyof typeof ATTENDANCE_LABELS)[]).map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="radio" name="attendanceMode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            {ATTENDANCE_LABELS[m]}
          </label>
        ))}
        {mode === "gps" && (
          <label className="block text-sm">
            Địa điểm
            {locations.length === 0 ? (
              <p className="text-warning">Chưa có địa điểm nào: thêm ở trang Cấu hình nhân sự (mục Địa điểm chấm công).</p>
            ) : (
              <select name="locationId" defaultValue={settings.locationId ?? locations[0].id} className={cn(inputCls, "block w-full max-w-xs")}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Ca làm (cố định trong tuần)</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((d, i) => (
            <label key={d} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm has-checked:border-primary has-checked:bg-primary/10">
              <input type="checkbox" name="workDays" value={i + 1} defaultChecked={settings.workDays.includes(i + 1)} />
              {d}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Vào ca
            <input type="time" name="shiftStart" defaultValue={settings.shiftStart} required className={cn(inputCls, "block")} />
          </label>
          <label className="text-sm">
            Ra ca
            <input type="time" name="shiftEnd" defaultValue={settings.shiftEnd} required className={cn(inputCls, "block")} />
          </label>
          <label className="text-sm">
            Cho phép trễ (phút)
            <input type="number" name="lateGraceMin" min={0} max={240} defaultValue={settings.lateGraceMin} className={cn(inputCls, "block w-28")} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Lương cứng</legend>
        <select name="payType" value={payType} onChange={(e) => setPayType(e.target.value as typeof payType)} className={cn(inputCls, "w-full max-w-xs")}>
          {(Object.keys(PAY_LABELS) as (keyof typeof PAY_LABELS)[]).map((p) => (
            <option key={p} value={p}>
              {PAY_LABELS[p]}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            {salaryLabel}
            <input name="baseSalary" inputMode="numeric" defaultValue={money(settings.baseSalary)} placeholder="7.000.000" className={cn(inputCls, "block w-40")} />
          </label>
          {payType === "monthly" && (
            <label className="text-sm">
              Ngày công chuẩn / tháng
              <input name="standardDays" inputMode="decimal" defaultValue={settings.standardDays} className={cn(inputCls, "block w-28")} />
            </label>
          )}
          <label className="text-sm">
            Phụ cấp / tháng (đồng)
            <input name="allowance" inputMode="numeric" defaultValue={money(settings.allowance)} placeholder="0" className={cn(inputCls, "block w-36")} />
          </label>
          <label className="text-sm">
            Phạt mỗi lần đi muộn (đồng)
            <input name="latePenalty" inputMode="numeric" defaultValue={money(settings.latePenalty)} placeholder="0" className={cn(inputCls, "block w-36")} />
          </label>
        </div>
        {payType === "monthly" && (
          <p className="text-xs text-muted-foreground">Lương = lương tháng ÷ ngày công chuẩn × số ngày công thực tế + phụ cấp − phạt đi muộn.</p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryCls}>
          {pending ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

/** Sao chép cấu hình từ người khác (cùng bộ phận khỏi điền lại). */
export function CopySettings({ toUserId, sources }: { toUserId: string; sources: { userId: string; label: string }[] }) {
  const [from, setFrom] = useState(sources[0]?.userId ?? "");
  const [state, setState] = useState<StaffState>({});
  const [pending, start] = useTransition();
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sao chép cấu hình từ</span>
      <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} aria-label="Sao chép từ">
        {sources.map((s) => (
          <option key={s.userId} value={s.userId}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !from}
        onClick={() => {
          if (!window.confirm("Ghi đè cấu hình chấm công, ca làm, lương của người này?")) return;
          start(async () => setState(await copyStaffSettings(from, toUserId)));
        }}
        className={buttonCls}
      >
        Sao chép
      </button>
      <Message state={state} />
    </div>
  );
}

/** Địa điểm chấm công GPS: lấy vị trí điện thoại khi đang đứng tại shop, hoặc dán tọa độ Google Maps. */
export function LocationsManager({
  locations,
}: {
  locations: { id: string; name: string; lat: number; lng: number; radiusM: number }[];
}) {
  const [state, action, pending] = useActionState<StaffState, FormData>(addLocation, {});
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [geoMsg, setGeoMsg] = useState("");
  const [delState, setDelState] = useState<StaffState>({});
  const [deleting, startDelete] = useTransition();

  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg("Trình duyệt không hỗ trợ định vị.");
    setGeoMsg("Đang lấy vị trí…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setGeoMsg(`Đã lấy vị trí (sai số khoảng ${Math.round(p.coords.accuracy)} m).`);
      },
      () => setGeoMsg("Không lấy được vị trí: cho phép trình duyệt dùng vị trí rồi thử lại."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  // Dán "21.0285, 105.8542" (Google Maps: bấm giữ vào bản đồ → chép tọa độ) vào ô Vĩ độ là tự tách.
  const onLatPaste = (text: string) => {
    const m = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) setCoords({ lat: m[1], lng: m[2] });
    else setCoords((c) => ({ ...c, lat: text }));
  };

  return (
    <div className="space-y-3">
      {locations.length > 0 && (
        <ul className="divide-y text-sm">
          {locations.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{l.name}</span>
              <span className="text-muted-foreground">
                bán kính {l.radiusM} m ·{" "}
                <a
                  href={`https://www.google.com/maps?q=${l.lat},${l.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  xem bản đồ
                </a>
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm(`Xóa địa điểm ${l.name}?`)) return;
                  startDelete(async () => setDelState(await removeLocation(l.id)));
                }}
                className="ml-auto text-xs text-destructive hover:underline"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
      <Message state={delState} />
      <form action={action} className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">Thêm địa điểm</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Tên
            <input name="name" required maxLength={80} placeholder="Shop, Kho…" className={cn(inputCls, "block w-36")} />
          </label>
          <label className="text-sm">
            Vĩ độ
            <input
              name="lat"
              value={coords.lat}
              onChange={(e) => onLatPaste(e.target.value)}
              placeholder="21.0285"
              className={cn(inputCls, "block w-32")}
            />
          </label>
          <label className="text-sm">
            Kinh độ
            <input
              name="lng"
              value={coords.lng}
              onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
              placeholder="105.8542"
              className={cn(inputCls, "block w-32")}
            />
          </label>
          <label className="text-sm">
            Bán kính (m)
            <input name="radius" type="number" min={20} max={2000} defaultValue={100} className={cn(inputCls, "block w-24")} />
          </label>
          <button type="button" onClick={locate} className={buttonCls}>
            Lấy vị trí hiện tại
          </button>
          <button type="submit" disabled={pending} className={primaryCls}>
            Thêm
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cách dễ nhất: mở trang này bằng điện thoại khi đang ở shop, bấm “Lấy vị trí hiện tại”. Hoặc trên Google Maps bấm
          giữ vào vị trí shop, chép tọa độ (dạng 21.0285, 105.8542) rồi dán vào ô Vĩ độ.
        </p>
        {geoMsg && <p className="text-xs">{geoMsg}</p>}
        <Message state={state} />
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { LogInIcon, LogOutIcon, MapPinIcon } from "lucide-react";
import { clock, type ClockState } from "@/lib/staff/attendance-actions";
import type { Position } from "@/lib/staff/attendance";

interface Props {
  mode: "online" | "gps";
  locationName: string | null;
  checkIn: string | null; // "HH:MM"
  checkOut: string | null;
  shift: string; // "08:00–17:30"
}

/** Lấy vị trí điện thoại (độ chính xác cao), tối đa 20 giây. */
function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Trình duyệt không hỗ trợ lấy vị trí."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Bạn chưa cho phép dùng vị trí. Mở cài đặt trình duyệt → Quyền vị trí cho trang này → Cho phép, rồi thử lại."
              : "Không lấy được vị trí, thử lại (bật Vị trí / GPS trên điện thoại).",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

/** Nút Vào ca / Ra ca ở trang Của tôi. Giờ ghi nhận là giờ máy chủ. */
export function ClockCard({ mode, locationName, checkIn, checkOut, shift }: Props) {
  const [state, setState] = useState<ClockState>({});
  const [pending, start] = useTransition();
  const [locating, setLocating] = useState(false);
  const kind: "in" | "out" = checkIn ? "out" : "in";

  const press = () =>
    start(async () => {
      setState({});
      let pos: Position | null = null;
      if (mode === "gps") {
        setLocating(true);
        try {
          pos = await getPosition();
        } catch (e) {
          setLocating(false);
          setState({ ok: false, message: (e as Error).message });
          return;
        }
        setLocating(false);
      }
      setState(await clock(kind, pos));
    });

  const busy = pending || locating;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md bg-muted px-2 py-2">
          <div className="text-xs text-muted-foreground">Ca hôm nay</div>
          <div className="font-medium tabular-nums">{shift}</div>
        </div>
        <div className="rounded-md bg-muted px-2 py-2">
          <div className="text-xs text-muted-foreground">Vào ca</div>
          <div className="font-semibold tabular-nums">{checkIn ?? "—"}</div>
        </div>
        <div className="rounded-md bg-muted px-2 py-2">
          <div className="text-xs text-muted-foreground">Ra ca</div>
          <div className="font-semibold tabular-nums">{checkOut ?? "—"}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={press}
        disabled={busy}
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-lg text-lg font-semibold text-white disabled:opacity-60 ${
          kind === "in" ? "bg-success" : "bg-primary"
        }`}
      >
        {kind === "in" ? <LogInIcon className="size-5" aria-hidden /> : <LogOutIcon className="size-5" aria-hidden />}
        {locating ? "Đang lấy vị trí…" : pending ? "Đang ghi…" : kind === "in" ? "Vào ca" : checkOut ? "Ra ca lại (ghi giờ mới)" : "Ra ca"}
      </button>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {mode === "gps" ? (
          <>
            <MapPinIcon className="size-3.5" aria-hidden />
            Chấm GPS tại {locationName ?? "shop"}: phải ở gần địa điểm. Giờ ghi theo máy chủ.
          </>
        ) : (
          "Chấm online tại nhà. Giờ ghi theo máy chủ."
        )}
      </p>

      {state.message && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}

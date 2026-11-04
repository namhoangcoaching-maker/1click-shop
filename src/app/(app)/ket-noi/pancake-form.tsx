"use client";

import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import {
  deletePancakeConnection,
  savePancakeConnection,
  type SaveState,
} from "@/lib/connections/actions";

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15";

export function PancakeForm({ connected, currentShopId }: { connected: boolean; currentShopId?: string }) {
  const [open, setOpen] = useState(!connected);
  const [state, save, saving] = useActionState<SaveState, FormData>(async (prev, fd) => {
    const result = await savePancakeConnection(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});
  const [delState, remove, removing] = useActionState<SaveState, FormData>(async () => {
    const result = await deletePancakeConnection();
    if (result.ok) setOpen(true);
    return result;
  }, {});
  const [show, setShow] = useState(false);
  // Thông báo mới nhất (lưu hoặc ngắt) hiện khi form đang đóng.
  const notice = !connected ? delState : state;

  if (!open) {
    return (
      <div className="space-y-2">
        {notice.message && <Notice state={notice} />}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-8 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            Đổi khóa API
          </button>
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm("Ngắt kết nối Pancake POS? Khóa đã lưu sẽ bị xóa, 1Click ngừng lấy dữ liệu.")) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              disabled={removing}
              className="h-8 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {removing ? "Đang ngắt…" : "Ngắt kết nối"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={save} className="space-y-3"
      autoComplete="off"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="space-y-1.5">
          <label htmlFor="apiKey" className="text-sm font-medium">
            Khóa API (API key)
          </label>
          <div className="relative">
            <input
              id="apiKey"
              name="apiKey"
              type={show ? "text" : "password"}
              placeholder="Dán khóa API của Pancake POS"
              spellCheck={false}
              autoComplete="off"
              className={`${inputClass} pr-10 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ẩn khóa" : "Hiện khóa"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="shopId" className="text-sm font-medium">
            Shop ID <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          </label>
          <input
            id="shopId"
            name="shopId"
            inputMode="numeric"
            placeholder="Ví dụ 6036602"
            defaultValue={state.shopId ?? currentShopId}
            key={state.shopId}
            className={inputClass}
          />
        </div>
      </div>

      {state.message && !state.ok && <Notice state={state} />}
      {!connected && delState.message && <Notice state={delState} />}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />}
          {saving ? "Đang kiểm tra với Pancake…" : "Kiểm tra & lưu"}
        </button>
        {connected && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Hủy
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        1Click gọi thử Pancake trước, khóa đúng mới lưu. Khóa được mã hóa và không bao giờ hiện lại đầy đủ.
      </p>
    </form>
  );
}

function Notice({ state }: { state: SaveState }) {
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
          : "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
      }
    >
      {state.message}
    </p>
  );
}

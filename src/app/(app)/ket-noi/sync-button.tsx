"use client";

import { useActionState } from "react";
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { syncPancakeNow, type SaveState } from "@/lib/connections/actions";

export function SyncButton() {
  const [state, run, pending] = useActionState<SaveState, FormData>(async () => syncPancakeNow(), {});
  return (
    <form action={run} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCwIcon className="size-4" aria-hidden />
        )}
        {pending ? "Đang lấy dữ liệu từ Pancake…" : "Đồng bộ ngay"}
      </button>
      {state.message && !pending && (
        <span role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {state.message}
        </span>
      )}
    </form>
  );
}

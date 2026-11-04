"use client";

import { useActionState, useState } from "react";
import { LoaderCircleIcon, PackagePlusIcon } from "lucide-react";
import { addIncoming, type IncomingState } from "@/lib/inventory/incoming-actions";

export interface OrderedFormVariant {
  id: string;
  label: string;
  suggested: number;
}

/**
 * Nút "Đã đặt" của một mẫu: nhập số lượng THỰC TẾ đã đặt xưởng từng size + ngày dự kiến về.
 * Mặc định điền sẵn số gợi ý và ngày về dự kiến; lưu xong 1Click tính hàng này vào kế hoạch.
 */
export function OrderedForm({
  productName,
  variants,
  defaultEta,
  minEta,
}: {
  productName: string;
  variants: OrderedFormVariant[];
  defaultEta: string;
  minEta: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<IncomingState, FormData>(async (prev, fd) => {
    const r = await addIncoming(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  if (!open) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-xs font-medium hover:bg-muted"
        >
          <PackagePlusIcon className="size-3.5" aria-hidden />
          Đã đặt
        </button>
        {state.ok && state.message && <span className="text-xs text-success">{state.message}</span>}
      </span>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 rounded-md border bg-card p-3" aria-label={`Đã đặt ${productName}`}>
      <p className="text-xs text-muted-foreground">
        Nhập số lượng thực tế đã đặt xưởng từng size và ngày hàng dự kiến về. 1Click sẽ tính số này vào kế hoạch.
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <label key={v.id} className="flex flex-col gap-0.5 text-xs">
            <span className="text-muted-foreground">{v.label}</span>
            <input
              name={`q:${v.id}`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={v.suggested || ""}
              className="h-8 w-20 rounded-md border border-input bg-card px-2 text-sm tabular-nums outline-none focus:border-primary"
            />
          </label>
        ))}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">Ngày về dự kiến</span>
          <input
            name="eta"
            type="date"
            min={minEta}
            defaultValue={defaultEta}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>
      <input
        name="note"
        placeholder="Ghi chú (xưởng, đợt…) – không bắt buộc"
        maxLength={300}
        className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      {state.message && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending && <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />}
          Lưu hàng sắp về
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted">
          Hủy
        </button>
      </div>
    </form>
  );
}

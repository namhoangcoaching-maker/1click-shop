"use client";

import { useActionState, useState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { addIncoming, type IncomingState } from "@/lib/inventory/incoming-actions";
import { cn } from "@/lib/utils";

/** Một size trong bảng gợi ý (dữ liệu đã tính sẵn ở máy chủ). */
export interface PlanVariantRow {
  id: string;
  label: string;
  sku: string;
  stock: number;
  incomingQty: number;
  /** Đã định dạng sẵn: "1,6", "<0,1". */
  velocity: string;
  /** "22/11" hoặc null. */
  stockout: string | null;
  stockoutSoon: boolean;
  short: number;
  suggested: number;
  slow: boolean;
}

const nf = new Intl.NumberFormat("vi-VN");

/**
 * Bảng từng size của một mẫu + (Chủ shop/Quản lý) cột "Đặt thực tế" và ngày về THỰC TẾ xưởng hẹn.
 * Nhập xong mới bấm "Đã đặt": 1Click ghi thành hàng sắp về, các lần đặt sau trừ đi số này.
 */
export function PlanVariants({
  productName,
  rows,
  untilLabel,
  estimatedArrival,
  minEta,
  canEdit,
}: {
  productName: string;
  rows: PlanVariantRow[];
  /** "07/12" */
  untilLabel: string;
  /** "26/11" – ngày về ước tính theo thời gian sản xuất. */
  estimatedArrival: string;
  /** Ngày nhỏ nhất được chọn (hôm nay), dạng YYYY-MM-DD. */
  minEta: string;
  canEdit: boolean;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const [state, action, pending] = useActionState<IncomingState, FormData>(async (prev, fd) => {
    const r = await addIncoming(prev, fd);
    if (r.ok) setSaved(r.message ?? "Đã lưu");
    return r;
  }, {});

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm whitespace-nowrap">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 text-left font-normal">Màu / Size</th>
            <th className="px-3 py-1.5 text-right font-normal">Có thể bán</th>
            <th className="px-3 py-1.5 text-right font-normal">Sắp về</th>
            <th className="px-3 py-1.5 text-right font-normal">Bán / ngày</th>
            <th className="px-3 py-1.5 text-right font-normal">Hết hàng</th>
            <th className="px-3 py-1.5 text-right font-normal">Thiếu tới {untilLabel}</th>
            <th className="px-3 py-1.5 text-right font-normal">Gợi ý đặt</th>
            {canEdit && <th className="py-1.5 pl-3 text-right font-normal text-foreground">Đặt thực tế</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-border/60">
              <td className="py-1.5 pr-3">
                <span className={cn(v.suggested > 0 && "font-medium")}>{v.label}</span>{" "}
                <span className="text-xs text-muted-foreground">{v.sku}</span>
                {v.slow && v.suggested > 0 && <span className="ml-1 text-xs text-warning">bán chậm</span>}
              </td>
              <td className={cn("px-3 py-1.5 text-right font-semibold", v.stock < 0 && "text-destructive")}>
                {nf.format(v.stock)}
              </td>
              <td className="px-3 py-1.5 text-right">{v.incomingQty > 0 ? nf.format(v.incomingQty) : "—"}</td>
              <td className="px-3 py-1.5 text-right">{v.velocity}</td>
              <td className={cn("px-3 py-1.5 text-right", v.stockoutSoon && "text-destructive")}>{v.stockout ?? "—"}</td>
              <td className="px-3 py-1.5 text-right">{v.short > 0 ? nf.format(v.short) : "—"}</td>
              <td className="px-3 py-1.5 text-right font-semibold">{v.suggested > 0 ? nf.format(v.suggested) : "—"}</td>
              {canEdit && (
                <td className="py-1 pl-3 text-right">
                  <input
                    name={`q:${v.id}`}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder={v.suggested > 0 ? String(v.suggested) : "0"}
                    aria-label={`Đặt thực tế ${productName} ${v.label}`}
                    className="h-8 w-20 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!canEdit) return table;

  return (
    <form action={action} className="space-y-2">
      {table}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-2.5">
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">
            Ngày về thực tế (xưởng hẹn) · ước tính {estimatedArrival}
          </span>
          <input
            name="eta"
            type="date"
            min={minEta}
            required
            className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">Ghi chú (xưởng, đợt…)</span>
          <input
            name="note"
            maxLength={300}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" aria-hidden /> : <CheckIcon className="size-4" aria-hidden />}
          Đã đặt
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Nhập số lượng THỰC TẾ đã chốt với xưởng từng size (để trống = không đặt size đó) và ngày xưởng hẹn giao, rồi
        bấm “Đã đặt”. Số này vào mục Hàng sắp về và được trừ khỏi các lần gợi ý sau.
      </p>
      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {saved}
        </p>
      )}
    </form>
  );
}

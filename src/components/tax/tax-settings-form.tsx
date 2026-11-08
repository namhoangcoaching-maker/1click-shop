"use client";

import { useActionState, useRef } from "react";
import { saveTaxSettings, type TaxState } from "@/lib/tax/actions";

const input = "h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary";

/** Loại hình + doanh thu năm trước (chỉ Chủ shop). Có gợi ý số lấy từ Pancake. */
export function TaxSettingsForm({
  businessType,
  priorYearRevenue,
  pancake,
}: {
  businessType: string;
  priorYearRevenue: number;
  /** Doanh thu Pancake + phí sàn của năm trước (null = không lấy được). */
  pancake?: { year: number; revenue: number } | null;
}) {
  const [state, action, pending] = useActionState<TaxState, FormData>(saveTaxSettings, {});
  const revenueRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Loại hình</span>
          <select name="businessType" defaultValue={businessType} className={input}>
            <option value="household">Hộ kinh doanh</option>
            <option value="company">Công ty</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Doanh thu năm trước (₫)</span>
          <input
            ref={revenueRef}
            name="priorYearRevenue"
            inputMode="numeric"
            required
            defaultValue={priorYearRevenue.toLocaleString("vi-VN")}
            className={`${input} w-48 text-right tabular-nums`}
          />
        </label>
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        {state.message && <span className={`text-xs ${state.ok ? "text-success" : "text-destructive"}`}>{state.message}</span>}
      </div>
      {pancake && (
        <p className="text-xs text-muted-foreground">
          Theo Pancake, năm {pancake.year}: <b className="tabular-nums text-foreground">{pancake.revenue.toLocaleString("vi-VN")} ₫</b> (Doanh thu + phí sàn
          {pancake.revenue === 0 ? "; có thể shop chưa bán trên Pancake cả năm đó" : ""}).{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => {
              if (revenueRef.current) revenueRef.current.value = pancake.revenue.toLocaleString("vi-VN");
            }}
          >
            Dùng số này
          </button>{" "}
          rồi bấm Lưu. Nên đối chiếu với số kế toán đã khai.
        </p>
      )}
    </form>
  );
}

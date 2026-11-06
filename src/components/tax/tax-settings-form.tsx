"use client";

import { useActionState } from "react";
import { saveTaxSettings, type TaxState } from "@/lib/tax/actions";

const input = "h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary";

/** Loại hình + doanh thu năm trước (chỉ Chủ shop). */
export function TaxSettingsForm({ businessType, priorYearRevenue }: { businessType: string; priorYearRevenue: number }) {
  const [state, action, pending] = useActionState<TaxState, FormData>(saveTaxSettings, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
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
    </form>
  );
}

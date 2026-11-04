"use client";

import { useActionState, useState } from "react";
import { LoaderCircleIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { SETTING_FIELDS } from "@/lib/inventory/settings";
import { saveStockRules, type SettingsState } from "@/lib/inventory/settings-actions";
import type { ShopRules } from "@/lib/inventory/settings";
import { cn } from "@/lib/utils";

/** Nút "Cấu hình" + khung chỉnh các con số tồn kho. Không phải Chủ shop thì chỉ xem. */
export function StockSettings({
  rules,
  canEdit,
  isDefault,
}: {
  rules: ShopRules;
  canEdit: boolean;
  isDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, save, saving] = useActionState<SettingsState, FormData>(async (prev, fd) => {
    const result = await saveStockRules(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.ok && !open && (
          <span role="status" className="text-sm text-success">
            {state.message}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted"
        >
          <SlidersHorizontalIcon className="size-4" aria-hidden />
          Cấu hình
        </button>
      </div>

      {open && (
        <section aria-label="Cấu hình tồn kho" className="rounded-lg border bg-card p-4">
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Cấu hình tồn kho</h2>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Các con số dùng để lập kế hoạch đặt hàng (cuối tháng, ngày 16, ngày 10, ngày 20) và báo cần sản xuất ngay."
                  : "Chỉ Chủ shop mới sửa được các con số này."}
                {isDefault && " Shop đang dùng số mặc định."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng cấu hình"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-4" />
            </button>
          </header>

          <form action={save} noValidate>
            <fieldset disabled={!canEdit || saving} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SETTING_FIELDS.map((f) => {
                const error = state.errors?.[f.key];
                return (
                  <div key={f.key} className="space-y-1 rounded-md bg-muted px-3 py-2.5">
                    <label htmlFor={f.key} className="text-sm font-medium">
                      {f.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={f.key}
                        name={f.key}
                        type="number"
                        inputMode="numeric"
                        min={f.min}
                        max={f.max}
                        step={1}
                        defaultValue={state.values?.[f.key] ?? rules[f.key]}
                        key={state.values?.[f.key] ?? rules[f.key]}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${f.key}-help`}
                        className={cn(
                          "h-9 w-24 rounded-lg border border-input bg-card px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-70",
                          error && "border-destructive",
                        )}
                      />
                      <span className="text-sm text-muted-foreground">{f.unit}</span>
                    </div>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <p id={`${f.key}-help`} className="text-xs text-muted-foreground">
                      {f.help}
                    </p>
                  </div>
                );
              })}
            </fieldset>

            {state.message && !state.ok && (
              <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.message}
              </p>
            )}

            {canEdit && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />}
                  {saving ? "Đang lưu…" : "Lưu cấu hình"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
                >
                  Hủy
                </button>
              </div>
            )}
          </form>
        </section>
      )}
    </div>
  );
}

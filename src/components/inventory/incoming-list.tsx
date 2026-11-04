"use client";

import { useTransition } from "react";
import { TruckIcon } from "lucide-react";
import { removeIncoming } from "@/lib/inventory/incoming-actions";

export interface IncomingView {
  id: string;
  product: string;
  variant: string;
  quantity: number;
  /** "20/11/2026" */
  eta: string;
  overdue: boolean;
  note: string | null;
}

/** Danh sách hàng sắp về; "Đã về" xóa dòng (tồn Pancake sẽ tự tăng khi nhập kho). */
export function IncomingList({ rows, canEdit }: { rows: IncomingView[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <TruckIcon className="size-4 text-primary" aria-hidden />
        <span className="font-semibold">Hàng sắp về</span>
        <span className="text-sm text-muted-foreground">
          {rows.length} dòng · đã tính vào kế hoạch đặt hàng. Hàng về và nhập kho trên Pancake xong thì bấm “Đã về”.
        </span>
      </header>
      <div className="overflow-x-auto px-4 pb-2">
        <table className="w-full min-w-[560px] text-sm whitespace-nowrap">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 text-left font-normal">Mẫu</th>
              <th className="px-3 py-1.5 text-left font-normal">Màu / Size</th>
              <th className="px-3 py-1.5 text-right font-normal">Số lượng</th>
              <th className="px-3 py-1.5 text-left font-normal">Ngày về</th>
              <th className="px-3 py-1.5 text-left font-normal">Ghi chú</th>
              {canEdit && <th className="py-1.5 pl-3" />}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-1.5 pr-3 font-medium">{r.product}</td>
                <td className="px-3 py-1.5">{r.variant}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{r.quantity}</td>
                <td className="px-3 py-1.5">
                  {r.eta}
                  {r.overdue && <span className="ml-1 text-xs text-warning">quá hạn, không còn tính</span>}
                </td>
                <td className="max-w-56 truncate px-3 py-1.5 text-muted-foreground">{r.note ?? ""}</td>
                {canEdit && (
                  <td className="py-1.5 pl-3 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => start(async () => void (await removeIncoming(r.id)))}
                      className="h-7 rounded-md border bg-card px-2 text-xs hover:bg-muted disabled:opacity-60"
                    >
                      Đã về
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

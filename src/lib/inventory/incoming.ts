/**
 * Hàng sắp về (shop nhập trên 1Click) – phần thuần tính toán, có unit test.
 */
import { addDays, type DateString } from "@/lib/date-range";
import type { PlanItem } from "./plan";
import type { RealStockItem } from "./real-stock";

export interface IncomingRow {
  id: string;
  variation_id: string;
  quantity: number;
  eta: DateString;
  note: string | null;
}

/** Quá ngày về chừng này ngày mà chưa bấm "Đã về": thôi cộng vào dự báo (coi như đã về, tồn Pancake đã tăng). */
export const INCOMING_GRACE_DAYS = 3;

export function isOverdue(row: Pick<IncomingRow, "eta">, today: DateString): boolean {
  return row.eta < addDays(today, -INCOMING_GRACE_DAYS);
}

/** Danh sách tồn kho → dữ liệu cho kế hoạch đặt hàng (tốc độ bán + hàng sắp về). */
export function toPlanItems(
  items: RealStockItem[],
  incoming: IncomingRow[],
  velocityWindowDays: number,
  today: DateString,
): PlanItem[] {
  const byVariation = new Map<string, IncomingRow[]>();
  for (const r of incoming) {
    if (isOverdue(r, today)) continue;
    byVariation.set(r.variation_id, [...(byVariation.get(r.variation_id) ?? []), r]);
  }
  return items.map((i) => ({
    ...i,
    velocity: i.soldInWindow / velocityWindowDays,
    incoming: (byVariation.get(i.id ?? "") ?? []).map((r) => ({ quantity: r.quantity, eta: r.eta })),
  }));
}

export interface IncomingEntry {
  variationId: string;
  quantity: number;
}

export type IncomingCheck =
  | { ok: true; eta: DateString; entries: IncomingEntry[] }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kiểm tra form "Đã đặt": ngày về hợp lệ (từ hôm nay tới 180 ngày nữa), số lượng từng size là số nguyên 0–100.000.
 * Size để trống hoặc 0 thì bỏ qua; phải có ít nhất một size.
 */
export function checkIncomingForm(
  eta: unknown,
  quantities: Record<string, unknown>,
  today: DateString,
): IncomingCheck {
  if (typeof eta !== "string" || !DATE_RE.test(eta) || Number.isNaN(Date.parse(eta))) {
    return { ok: false, error: "Chọn ngày hàng dự kiến về." };
  }
  if (eta < today) return { ok: false, error: "Ngày về không được trước hôm nay." };
  if (eta > addDays(today, 180)) return { ok: false, error: "Ngày về quá xa (hơn 180 ngày)." };

  const entries: IncomingEntry[] = [];
  for (const [variationId, raw] of Object.entries(quantities)) {
    const text = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (text === "" || text === "0") continue;
    if (!/^\d+$/.test(text) || Number(text) > 100_000) {
      return { ok: false, error: "Số lượng mỗi size phải là số nguyên, tối đa 100.000." };
    }
    entries.push({ variationId, quantity: Number(text) });
  }
  if (entries.length === 0) return { ok: false, error: "Nhập số lượng cho ít nhất một size." };
  return { ok: true, eta, entries };
}

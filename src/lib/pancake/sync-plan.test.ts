import { describe, expect, it } from "vitest";
import {
  einvoicePlan,
  einvoiceWindows,
  backfillProgress,
  incrementalRange,
  initialState,
  needsProducts,
  nextBackfillWindow,
  type SyncStateLike,
} from "./sync-plan";

const now = new Date("2026-11-04T14:00:00Z");
const fresh: SyncStateLike = { products_synced_at: null, ...initialState(now) };

describe("lần đầu đồng bộ", () => {
  it("lịch sử lùi về 90 ngày, đơn mới lấy từ bây giờ", () => {
    expect(fresh.backfill_target).toBe("2026-08-06T14:00:00.000Z");
    expect(fresh.backfill_next_end).toBe(now.toISOString());
    expect(fresh.orders_cursor).toBe(now.toISOString());
    expect(backfillProgress(fresh)).toBe(0);
  });

  it("chưa có sản phẩm thì lấy sản phẩm", () => {
    expect(needsProducts(fresh, now)).toBe(true);
  });
});

describe("lấy lịch sử theo từng đợt 7 ngày, lùi dần", () => {
  it("đợt đầu: 7 ngày gần nhất", () => {
    expect(nextBackfillWindow(fresh)).toEqual({
      start: new Date("2026-10-28T14:00:00Z"),
      end: now,
    });
  });

  it("đợt cuối không lùi quá mốc 90 ngày", () => {
    const s = { ...fresh, backfill_next_end: "2026-08-09T14:00:00.000Z" };
    expect(nextBackfillWindow(s)!.start).toEqual(new Date("2026-08-06T14:00:00Z"));
  });

  it("đã tới mốc 90 ngày thì xong, tiến độ 100%", () => {
    const s = { ...fresh, backfill_next_end: fresh.backfill_target };
    expect(nextBackfillWindow(s)).toBeNull();
    expect(backfillProgress(s)).toBe(100);
  });

  it("tiến độ theo số ngày đã lấy", () => {
    const s = { ...fresh, backfill_next_end: "2026-09-20T14:00:00.000Z" }; // đã lấy 45/90 ngày
    expect(backfillProgress(s)).toBe(50);
  });
});

describe("đơn mới / vừa đổi trạng thái", () => {
  it("lấy từ mốc trước lùi 10 phút tới bây giờ (giây unix)", () => {
    const s = { ...fresh, orders_cursor: "2026-11-04T13:30:00.000Z" };
    expect(incrementalRange(s, now)).toEqual({
      start: Date.parse("2026-11-04T13:20:00Z") / 1000,
      end: now.getTime() / 1000,
    });
  });
});

describe("sản phẩm / tồn kho", () => {
  it("lấy lại khi lần trước cũ hơn 10 phút", () => {
    expect(needsProducts({ ...fresh, products_synced_at: "2026-11-04T13:55:00Z" }, now)).toBe(false);
    expect(needsProducts({ ...fresh, products_synced_at: "2026-11-04T13:50:00Z" }, now)).toBe(true);
  });
});

describe("đồng bộ hóa đơn điện tử", () => {
  const now = new Date("2026-11-06T15:00:00Z");
  const base = { products_synced_at: null, orders_cursor: null, backfill_target: null, backfill_next_end: null };
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  it("lần đầu: lấy 120 ngày, chia đợt 10 ngày, đợt cuối tới hiện tại", () => {
    const p = einvoicePlan(base, now);
    expect(p).toEqual({ start: new Date(daysAgo(120)), refresh: true });
    const w = einvoiceWindows(p.start, now);
    expect(w).toHaveLength(12);
    expect(w.at(-1)!.end).toEqual(now);
  });

  it("đang lấy dở thì làm tiếp từ mốc", () => {
    expect(einvoicePlan({ ...base, einvoices_synced_at: daysAgo(50), einvoices_full_at: daysAgo(0.5) }, now)).toEqual({ start: new Date(daysAgo(50)), refresh: false });
  });

  it("đã đủ: lấy lại 3 ngày; quá 24 giờ thì lấy lại 45 ngày", () => {
    expect(einvoicePlan({ ...base, einvoices_synced_at: daysAgo(0.01), einvoices_full_at: daysAgo(0.5) }, now).start).toEqual(
      new Date(Date.parse(daysAgo(0.01)) - 3 * 86_400_000),
    );
    expect(einvoicePlan({ ...base, einvoices_synced_at: daysAgo(0.01), einvoices_full_at: daysAgo(1.1) }, now)).toEqual({ start: new Date(daysAgo(45)), refresh: true });
  });
});

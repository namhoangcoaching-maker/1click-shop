/**
 * Kế hoạch đồng bộ (thuần tính toán, có unit test): khi nào lấy lại sản phẩm, lấy đơn mới từ đâu,
 * đợt lấy lịch sử tiếp theo là khoảng nào.
 */

export const SYNC_RULES = {
  /** Lần đầu lấy lịch sử đơn bao nhiêu ngày (chủ dự án chốt 90). */
  backfillDays: 90,
  /** Mỗi đợt lấy lịch sử bao nhiêu ngày (≈ 1.000 đơn với shop 140 đơn/ngày). */
  backfillWindowDays: 7,
  /** Lấy lại danh sách sản phẩm/tồn kho nếu lần trước cũ hơn chừng này phút. */
  productsEveryMinutes: 10,
  /** Lấy đơn cập nhật lùi lại thêm chừng này phút so với mốc trước, phòng lệch giờ. */
  cursorOverlapMinutes: 10,
  /** Một lần đồng bộ bị coi là treo nếu chạy quá chừng này phút: cho lần sau chạy. */
  lockMinutes: 5,
} as const;

const DAY = 86_400_000;
const MIN = 60_000;

export interface SyncStateLike {
  products_synced_at: string | null;
  orders_cursor: string | null;
  backfill_target: string | null;
  backfill_next_end: string | null;
}

/** Shop lần đầu đồng bộ: lấy đơn mới từ bây giờ, lịch sử lùi dần từ bây giờ về 90 ngày trước. */
export function initialState(now: Date) {
  return {
    orders_cursor: now.toISOString(),
    backfill_target: new Date(now.getTime() - SYNC_RULES.backfillDays * DAY).toISOString(),
    backfill_next_end: now.toISOString(),
  };
}

export function needsProducts(state: SyncStateLike, now: Date): boolean {
  if (!state.products_synced_at) return true;
  return now.getTime() - new Date(state.products_synced_at).getTime() >= SYNC_RULES.productsEveryMinutes * MIN;
}

/** Khoảng lấy đơn đã cập nhật (theo giờ cập nhật trên Pancake), tính bằng giây unix. */
export function incrementalRange(state: SyncStateLike, now: Date): { start: number; end: number } {
  const cursor = state.orders_cursor ? new Date(state.orders_cursor).getTime() : now.getTime();
  return {
    start: Math.floor((cursor - SYNC_RULES.cursorOverlapMinutes * MIN) / 1000),
    end: Math.floor(now.getTime() / 1000),
  };
}

/** Đợt lấy lịch sử tiếp theo (theo ngày tạo đơn), null nếu đã lấy đủ. */
export function nextBackfillWindow(state: SyncStateLike): { start: Date; end: Date } | null {
  if (!state.backfill_target || !state.backfill_next_end) return null;
  const target = new Date(state.backfill_target).getTime();
  const end = new Date(state.backfill_next_end).getTime();
  if (end <= target) return null;
  return { start: new Date(Math.max(target, end - SYNC_RULES.backfillWindowDays * DAY)), end: new Date(end) };
}

/** Phần trăm lịch sử đã lấy xong (0–100), để hiện cho người dùng. */
export function backfillProgress(state: SyncStateLike): number {
  if (!state.backfill_target || !state.backfill_next_end) return 0;
  const target = new Date(state.backfill_target).getTime();
  const end = new Date(state.backfill_next_end).getTime();
  const total = SYNC_RULES.backfillDays * DAY;
  const left = Math.max(0, end - target);
  return Math.round(Math.min(100, Math.max(0, (1 - left / total) * 100)));
}

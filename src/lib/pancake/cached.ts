import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPancakeCredentials } from "@/lib/connections/credentials";
import { fetchOrderSources, fetchPancakeUsers, fetchSaleStats, type SaleRow, type SplitBy } from "./analytics";
import { PancakeError } from "./client";

/**
 * Nhớ tạm kết quả thống kê Pancake (chủ dự án đồng ý 05/11/2026, để trang mở nhanh):
 * - Lưu ở bộ nhớ dùng chung của Vercel ("use cache: remote"), vì bộ nhớ thường của máy chủ Vercel
 *   mất sau mỗi lượt và gần như không bao giờ trúng.
 * - Số được dùng lại tối đa ~2 phút; sau đó lần mở kế tiếp vẫn hiện ngay số cũ và lấy số mới ở nền.
 * - Nút "Tải lại" xóa nhớ tạm của shop (updateTag) để lấy số mới ngay.
 * Khóa nhớ = mã shop + khoảng ngày (+ cách chia), KHÔNG gồm khóa API. Người gọi phải bảo đảm orgId là
 * shop của người đang đăng nhập (getCurrentOrg) hoặc là việc nền.
 */

/** Nhãn nhớ tạm của một shop (xóa bằng updateTag/revalidateTag). */
export const pancakeStatsTag = (orgId: string) => `pancake-stats-${orgId}`;

const STATS_LIFE = { stale: 60, revalidate: 120, expire: 900 };

export async function cachedSaleStats(
  orgId: string,
  range: { since: string; until: string },
  splitBy?: SplitBy,
): Promise<SaleRow[]> {
  "use cache: remote";
  cacheLife(STATS_LIFE);
  cacheTag(pancakeStatsTag(orgId));
  const creds = await getPancakeCredentials(orgId);
  if (!creds) throw new PancakeError("Shop chưa kết nối Pancake POS.", 0);
  return fetchSaleStats(creds, range, splitBy);
}

/** Tên nguồn đơn (ít thay đổi: nhớ lâu hơn). Trả dạng cặp [mã, tên] để lưu được. */
export async function cachedOrderSourceEntries(orgId: string): Promise<[string, string][]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(pancakeStatsTag(orgId));
  const creds = await getPancakeCredentials(orgId);
  if (!creds) throw new PancakeError("Shop chưa kết nối Pancake POS.", 0);
  return [...(await fetchOrderSources(creds)).entries()];
}

/** Nhân viên trên Pancake [mã, tên] (để nối với nhân sự 1Click – KPI doanh thu đơn gán). */
export async function cachedPancakeUsers(orgId: string): Promise<[string, string][]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(pancakeStatsTag(orgId));
  const creds = await getPancakeCredentials(orgId);
  if (!creds) return [];
  return fetchPancakeUsers(creds);
}

export async function cachedOrderSources(orgId: string): Promise<Map<string, string>> {
  return new Map(await cachedOrderSourceEntries(orgId));
}

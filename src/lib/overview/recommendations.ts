/**
 * Đề xuất hành động dựa trên dữ liệu.
 *
 * Mọi con số trong đề xuất do code tính (tồn kho, tỷ lệ, chi phí). Mỗi đề xuất kèm lý do
 * bằng con số để chủ shop tự kiểm tra. Ở giai đoạn sau, AI (Claude) chỉ viết lời khuyên
 * chi tiết hơn dựa trên chính các đề xuất này, không tự tính lại.
 */
import { formatDateVN } from "@/lib/date-range";
import { groupStockAlarms } from "@/lib/inventory/alarms";
import type { StockAnalysis } from "@/lib/inventory/stock";
import { formatDecimal, formatNumber, formatPercent, formatVND, ratio } from "@/lib/format";
import type { AdChannelCost, TopProduct } from "./types";

/** Ngưỡng mặc định. Sau này mỗi doanh nghiệp tự chỉnh trong phần cấu hình. */
export const RECOMMENDATION_RULES = {
  /** Tổng chi phí quảng cáo vượt % này của tổng doanh thu thì cảnh báo. */
  maxAdSpendRatio: 12,
  /** Chi phí quảng cáo một kênh vượt % này của doanh thu chính kênh đó thì cảnh báo. */
  maxChannelAdRatio: 25,
  /** Sản phẩm bán chạy nhất chiếm từ % doanh thu này trở lên thì đề xuất tập trung content. */
  minTopProductShare: 10,
  /** Liệt kê tối đa chừng này mã trong một đề xuất. */
  maxListed: 3,
} as const;

export type RecommendationPriority = "urgent" | "important" | "opportunity";

export type RecommendationCategory = "restock" | "content" | "clearance" | "ads";

export interface Recommendation {
  id: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  title: string;
  /** Lý do bằng con số. */
  reasons: string[];
  actions: string[];
  /** Trang chi tiết liên quan. */
  link?: { href: string; label: string };
}

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  urgent: 0,
  important: 1,
  opportunity: 2,
};

export interface RecommendationInput {
  totalRevenue: number;
  topProducts: TopProduct[];
  adCosts: AdChannelCost[];
  stock: StockAnalysis[];
  /** Đường dẫn trang chi tiết tồn kho. */
  inventoryHref: string;
}

function stockReason(a: StockAnalysis): string {
  const { item } = a;
  if (a.status === "out") {
    return `${item.name}: đã hết hàng, đang bán ${formatDecimal(a.velocity)} cái/ngày`;
  }
  return (
    `${item.name}: còn ${formatNumber(item.stock)}, bán ${formatDecimal(a.velocity)} cái/ngày → ` +
    `đủ bán ${formatDecimal(a.daysOfStock)} ngày, ít hơn ${a.requiredDays} ngày cần có ` +
    `(sản xuất ${a.leadTimeDays}${a.leadTimeIsDefault ? " – số mặc định" : ""} + dự phòng ${a.requiredDays - a.leadTimeDays})`
  );
}

function moreSuffix(total: number, shown: number): string[] {
  return total > shown ? [`và ${total - shown} mã khác – xem trang Tồn kho`] : [];
}

export function buildRecommendations(
  input: RecommendationInput,
  rules = RECOMMENDATION_RULES,
): Recommendation[] {
  const result: Recommendation[] = [];
  const stockLink = { href: input.inventoryHref, label: "Xem trang Tồn kho" };

  // 1. Sắp hết hàng: gom theo MẪU (một size thiếu là báo cả mẫu), giống trang Tồn kho.
  const groups = groupStockAlarms(input.stock);
  if (groups.length > 0) {
    const shown = groups.slice(0, rules.maxListed);
    const sizes = groups.reduce((n, g) => n + g.alarmCount, 0);
    result.push({
      id: "restock-urgent",
      priority: "urgent",
      category: "restock",
      title:
        sizes === groups.length
          ? `${groups.length} mã cần sản xuất ngay`
          : `${groups.length} mẫu cần sản xuất ngay (${sizes} màu/size thiếu)`,
      reasons: [
        ...shown.map((g) =>
          g.variants.length === 1
            ? stockReason(g.variants[0])
            : `${g.name}: ${g.alarmCount}/${g.variants.length} size thiếu – ` +
              g.variants
                .filter((v) => v.status === "out" || v.status === "urgent")
                .map((v) =>
                  v.status === "out"
                    ? `${v.item.variant ?? v.item.sku} đã hết`
                    : `${v.item.variant ?? v.item.sku} đủ bán ${formatDecimal(v.daysOfStock)} ngày`,
                )
                .join(", "),
        ),
        ...(groups.length > shown.length ? [`và ${groups.length - shown.length} mẫu khác – xem trang Tồn kho`] : []),
      ],
      actions: shown.map((g) =>
        g.variants.length === 1
          ? `Đặt sản xuất ngay ${formatNumber(g.totalSuggested)} cái ${g.name} (${g.variants[0].item.sku})`
          : `Đặt sản xuất ngay ${formatNumber(g.totalSuggested)} cái ${g.name} (` +
            g.variants
              .filter((v) => v.suggestedQuantity > 0)
              .map((v) => `${v.item.variant ?? v.item.sku}: ${formatNumber(v.suggestedQuantity)}`)
              .join(", ") +
            ")",
      ),
      link: stockLink,
    });
  }

  const soon = input.stock.filter((a) => a.status === "soon");
  if (soon.length > 0) {
    const shown = soon.slice(0, rules.maxListed);
    result.push({
      id: "restock-soon",
      priority: "important",
      category: "restock",
      title: `${soon.length} mã sắp đến hạn đặt sản xuất`,
      reasons: [
        ...shown.map(
          (a) =>
            `${a.item.name}: đủ bán ${formatDecimal(a.daysOfStock)} ngày, ` +
            `phải đặt chậm nhất ${a.orderBy ? formatDateVN(a.orderBy) : "—"}`,
        ),
        ...moreSuffix(soon.length, shown.length),
      ],
      actions: ["Lên kế hoạch sản xuất trong tuần này để không bị đứt hàng"],
      link: stockLink,
    });
  }

  // 2. Sản phẩm bán chạy nhất: tập trung content, phát triển sản phẩm tương tự.
  const top = input.topProducts.find((p) => p.linked);
  const topShare = top ? ratio(top.revenue, input.totalRevenue) : 0;
  if (top && topShare >= rules.minTopProductShare) {
    // Dữ liệu thật: so theo mẫu (mọi size); dữ liệu giả: so theo mã.
    const topStock = input.stock.filter((a) =>
      top.productId ? a.item.productId === top.productId : a.item.sku === top.sku,
    );
    const runningOut = topStock.some((a) => a.status === "out" || a.status === "urgent");
    result.push({
      id: "content-top-product",
      priority: "opportunity",
      category: "content",
      title: `Tập trung content cho “${top.name}”`,
      reasons: [
        `Bán chạy nhất kỳ này: ${formatNumber(top.quantity)} SP, ${formatVND(top.revenue)} ` +
          `(${formatPercent(topShare, 1)} doanh thu)`,
        ...(runningOut ? ["Lưu ý: mã này đang sắp hết hàng – sản xuất trước rồi mới đẩy mạnh content"] : []),
      ],
      actions: [
        "Tăng số video và hình ảnh về sản phẩm này trong kế hoạch content tháng tới",
        "Phát triển thêm sản phẩm tương tự: thêm kích thước, màu, hoặc combo đi kèm",
      ],
    });
  }

  // 3. Bán chậm: kế hoạch đẩy tồn kho.
  const slow = input.stock.filter((a) => a.status === "slow");
  if (slow.length > 0) {
    const shown = slow.slice(0, rules.maxListed);
    const lockedCost = slow.reduce((sum, a) => sum + (a.costValue ?? 0), 0);
    const missingCost = slow.filter((a) => a.costValue === null).length;
    result.push({
      id: "clearance",
      priority: "important",
      category: "clearance",
      title: `${slow.length} mã bán chậm, cần kế hoạch đẩy tồn kho`,
      reasons: [
        `Đang giữ ${formatVND(lockedCost)} tiền vốn trong kho` +
          (missingCost > 0 ? ` (chưa tính ${missingCost} mã thiếu giá vốn)` : ""),
        ...shown.map((a) =>
          a.velocity === 0
            ? `${a.item.name}: còn ${formatNumber(a.item.stock)}, 30 ngày qua không bán được cái nào`
            : `${a.item.name}: còn ${formatNumber(a.item.stock)}, đủ bán ${formatNumber(a.daysOfStock)} ngày`,
        ),
        ...moreSuffix(slow.length, shown.length),
      ],
      actions: [
        "Giảm giá hoặc làm combo đi kèm sản phẩm bán chạy",
        "Làm content xả kho: video giá sốc, livestream, bài “deal cuối mùa”",
        "Nếu bán dưới giá vốn hoặc phải hủy hàng: hỏi kế toán về chứng từ và cách khai thuế",
      ],
      link: stockLink,
    });
  }

  // 4. Chi phí quảng cáo cao.
  const totalAds = input.adCosts.reduce((sum, c) => sum + c.cost.value, 0);
  const totalAdRatio = ratio(totalAds, input.totalRevenue);
  const expensiveChannels = input.adCosts.filter(
    (c) => ratio(c.cost.value, c.channelRevenue) >= rules.maxChannelAdRatio,
  );
  if (totalAdRatio > rules.maxAdSpendRatio || expensiveChannels.length > 0) {
    result.push({
      id: "ads",
      priority: "important",
      category: "ads",
      title: "Chi phí quảng cáo đang cao, cần tối ưu",
      reasons: [
        `Tổng chi phí quảng cáo ${formatVND(totalAds)} = ${formatPercent(totalAdRatio, 1)} doanh thu ` +
          `(ngưỡng ${rules.maxAdSpendRatio}%)`,
        ...expensiveChannels.map(
          (c) =>
            `${c.channel}: ${formatPercent(ratio(c.cost.value, c.channelRevenue), 1)} doanh thu của kênh ` +
            `(ngưỡng ${rules.maxChannelAdRatio}%)`,
        ),
      ],
      actions: [
        "Làm lại nội dung quảng cáo theo các mẫu content có lượt xem cao nhất",
        "Dồn ngân sách cho sản phẩm bán chạy, lợi nhuận tốt; tạm dừng nhóm quảng cáo kém hiệu quả",
      ],
    });
  }

  return result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

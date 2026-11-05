/**
 * Hình dạng dữ liệu của trang Tổng quan.
 * Giao diện chỉ đọc các kiểu này; nguồn số liệu (bản mẫu hoặc Pancake thật) có thể thay mà không sửa giao diện.
 * Mọi con số tiền ở đây do code tính, không do AI tính.
 */
import type { DateString } from "@/lib/date-range";
import type { ValueFormat } from "@/lib/format";
import type { StockItem } from "@/lib/inventory/stock";

/** Giá trị kỳ này và kỳ trước (null khi không so sánh). */
export interface Compared {
  value: number;
  previous: number | null;
}

export interface SeriesPoint {
  /** Nhãn trục ngang: "14h" hoặc "27/10". */
  label: string;
  current: number;
  previous: number | null;
}

export type MetricKey =
  | "grossSales"
  | "revenue"
  | "profit"
  | "orders"
  | "aov"
  | "adSpend"
  | "platformFees";

export interface Metric extends Compared {
  key: MetricKey;
  label: string;
  format: ValueFormat;
  /** false nếu tăng là xấu (chi phí). */
  positiveIsGood: boolean;
  /** Giải thích ngắn hiện khi rê chuột vào tên chỉ số. */
  hint?: string;
  series: SeriesPoint[];
}

export interface OrderTotals {
  amount: Compared;
  count: Compared;
}

export interface OrderSourceRow {
  source: string;
  /** Doanh số (để tính GTTB giống chỉ số GTTB ở dải Kinh doanh). */
  gross: number;
  revenue: Compared;
  /** Phí sàn (Shopee, TikTok…); Doanh thu Pancake đã trừ khoản này. */
  fee: Compared;
  profit: number;
  orders: number;
}

export interface TopProduct {
  /** Mã mẫu trên Pancake (gộp mọi màu/size); không có với dữ liệu giả hoặc hàng chưa liên kết. */
  productId?: string;
  name: string;
  sku: string | null;
  quantity: number;
  revenue: number;
  /** Ảnh sản phẩm (Pancake), https. */
  imageUrl?: string;
  /** false: dòng sản phẩm sàn chưa liên kết với sản phẩm trên Pancake. */
  linked: boolean;
}

export interface AdChannelCost {
  channel: string;
  cost: Compared;
  /** Doanh thu của kênh bán tương ứng, để tính chi phí / doanh thu. */
  channelRevenue: number;
}

export type ContentPlatform = "facebook" | "tiktok" | "instagram" | "youtube";

export interface ContentItem {
  title: string;
  platform: ContentPlatform;
  kind: "video" | "image";
  views: number;
  likes: number;
  url: string;
}

export interface TaxDeadline {
  title: string;
  date: DateString;
}

export interface TaxSummary {
  /** Ví dụ "Hộ kinh doanh · khai thuế GTGT theo quý". */
  profile: string;
  totalOrders: number;
  invoicedOrders: number;
  invoicesToAdjust: number;
  deadlines: TaxDeadline[];
}

export interface CashflowSummary {
  income: Compared;
  expense: Compared;
  expenseBreakdown: { label: string; amount: number }[];
  /** Tiền COD đã giao hàng nhưng chưa đối soát với đơn vị vận chuyển. */
  unreconciledCod: number;
}

export type AttendanceStatus = "on_time" | "late" | "absent";

export interface StaffSummary {
  attendance: {
    name: string;
    status: AttendanceStatus;
    checkIn: string | null;
    lateMinutes?: number;
  }[];
  kpi: {
    name: string;
    /** % chỉ tiêu tháng đã đạt. */
    progress: number;
    /** Còn thiếu bao nhiêu (tiền) để lên bậc thưởng tiếp theo, null nếu đã ở bậc cao nhất. */
    gapToNextTier: number | null;
  }[];
  /** Tổng lương tạm tính từ đầu tháng đến hôm nay. */
  payrollToDate: number;
  performance: { name: string; orders: number; revenue: number; closeRate: number }[];
  /** Số đơn chỉ có "Hệ thống", chưa gán nhân viên. */
  unassignedOrders: number;
}

export interface OverviewData {
  metrics: Metric[];
  closedOrders: OrderTotals;
  returnedOrders: OrderTotals;
  /** Tồn kho theo từng mã. Thẻ Tồn kho, trang Tồn kho và đề xuất đều tính từ danh sách này. */
  stock: StockItem[];
  sources: OrderSourceRow[];
  topProducts: TopProduct[];
  adCosts: AdChannelCost[];
  topContent: ContentItem[];
  tax: TaxSummary;
  cashflow: CashflowSummary;
  staff: StaffSummary;
}

import { PLAN_RULES, type PlanRules } from "./plan";
import { STOCK_RULES, type StockRules } from "./stock";

/**
 * Cấu hình tồn kho của từng shop: mô tả từng ô nhập, giới hạn hợp lệ, cách đọc/ghi database.
 * Giới hạn ở đây PHẢI khớp ràng buộc check trong supabase/migrations/0003 và 0008.
 */

/** Toàn bộ con số tồn kho của shop: kế hoạch đặt hàng + phân tích tồn (bán chậm, tốc độ bán). */
export type ShopRules = StockRules & PlanRules;
export type StockRuleKey = keyof ShopRules;

export const DEFAULT_RULES: Readonly<ShopRules> = Object.freeze({ ...STOCK_RULES, ...PLAN_RULES });

export interface SettingField {
  key: StockRuleKey;
  /** Tên cột trong bảng inventory_settings. */
  column: string;
  label: string;
  help: string;
  unit: "ngày" | "cái";
  min: number;
  max: number;
}

/** Các ô hiện trong khung Cấu hình (theo thứ tự). */
export const SETTING_FIELDS: readonly SettingField[] = [
  { key: "moqPerSize", column: "moq_per_size", label: "Đặt tối thiểu mỗi size", unit: "cái", min: 1, max: 1000, help: "Mỗi lần đặt, size nào cần đặt thì đặt ít nhất chừng này cái." },
  { key: "tier1Qty", column: "tier1_qty", label: "Mức 1: đặt tới", unit: "cái", min: 1, max: 10000, help: "Cả mẫu đặt tới chừng này cái thì dùng thời gian sản xuất mức 1." },
  { key: "tier1Days", column: "tier1_days", label: "Mức 1: sản xuất", unit: "ngày", min: 1, max: 120, help: "Thời gian từ lúc đặt xưởng tới lúc hàng về, khi đặt ít." },
  { key: "tier2Qty", column: "tier2_qty", label: "Mức 2: đặt tới", unit: "cái", min: 1, max: 10000, help: "Cả mẫu đặt tới chừng này cái thì dùng mức 2; nhiều hơn dùng mức 3." },
  { key: "tier2Days", column: "tier2_days", label: "Mức 2: sản xuất", unit: "ngày", min: 1, max: 120, help: "Thời gian sản xuất khi đặt số lượng vừa." },
  { key: "tier3Days", column: "tier3_days", label: "Mức 3: sản xuất", unit: "ngày", min: 1, max: 120, help: "Thời gian sản xuất khi đặt nhiều (trên mức 2)." },
  { key: "maxNegativeDays", column: "max_negative_days", label: "Bán âm kho tối đa", unit: "ngày", min: 0, max: 60, help: "Đợi tới ngày đặt kế tiếp mà phải bán âm lâu hơn chừng này ngày thì báo \"Cần sản xuất ngay\"." },
  { key: "extraCoverDays", column: "extra_cover_days", label: "Đủ bán thêm sau lần đặt chính kế tiếp", unit: "ngày", min: 0, max: 60, help: "Ví dụ 7: đặt ngày 16 phải đủ bán tới mùng 7 tháng sau." },
  { key: "slowCoverDays", column: "slow_cover_days", label: "Ẩn mã bán chậm khi", unit: "ngày", min: 7, max: 365, help: "Đặt tối thiểu mà lâu hơn chừng này ngày mới bán hết thì coi là bán chậm, ẩn khỏi gợi ý đặt." },
  { key: "velocityWindowDays", column: "velocity_window_days", label: "Tính tốc độ bán trên", unit: "ngày", min: 7, max: 180, help: "Bán trung bình mỗi ngày = số bán thực trong chừng này ngày gần nhất ÷ số ngày." },
  { key: "slowMovingDays", column: "slow_moving_days", label: "Tồn nhiều khi đủ bán quá", unit: "ngày", min: 7, max: 730, help: "Hàng còn đủ bán lâu hơn chừng này ngày là tồn nhiều, nên có kế hoạch xả (Đề xuất ở Tổng quan)." },
];

/** Cột cũ (không còn hiện trong Cấu hình) vẫn đọc để không mất dữ liệu đã lưu. */
const LEGACY_FIELDS: readonly Pick<SettingField, "key" | "column" | "min" | "max">[] = [
  { key: "safetyDays", column: "safety_days", min: 0, max: 60 },
  { key: "targetCoverDays", column: "target_cover_days", min: 1, max: 365 },
  { key: "defaultLeadTimeDays", column: "default_lead_time_days", min: 1, max: 180 },
  { key: "warningWindowDays", column: "warning_window_days", min: 0, max: 60 },
];

const ALL_FIELDS = [...SETTING_FIELDS, ...LEGACY_FIELDS];

export const SETTING_COLUMNS = ALL_FIELDS.map((f) => f.column);

export type SettingsCheck =
  | { ok: true; value: ShopRules }
  | { ok: false; errors: Partial<Record<StockRuleKey, string>> };

/** Kiểm tra số người dùng nhập (chuỗi từ form). Chỉ nhận số nguyên trong giới hạn. */
export function checkStockRules(input: Partial<Record<StockRuleKey, unknown>>): SettingsCheck {
  const value = { ...DEFAULT_RULES } as ShopRules;
  const errors: Partial<Record<StockRuleKey, string>> = {};
  for (const f of SETTING_FIELDS) {
    const raw = input[f.key];
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    if (!/^\d+$/.test(text)) {
      errors[f.key] = text === "" ? "Vui lòng nhập số." : "Chỉ nhập số nguyên, ví dụ 7.";
      continue;
    }
    const n = Number(text);
    if (n < f.min || n > f.max) {
      errors[f.key] = `Nhập từ ${f.min} đến ${f.max} ${f.unit}.`;
      continue;
    }
    value[f.key] = n;
  }
  if (!errors.tier1Qty && !errors.tier2Qty && value.tier1Qty >= value.tier2Qty) {
    errors.tier2Qty = "Mức 2 phải lớn hơn mức 1.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Dòng database → cấu hình; chưa có dòng (shop chưa cấu hình) thì dùng mặc định. */
export function rowToStockRules(row: Record<string, unknown> | null | undefined): ShopRules {
  const rules = { ...DEFAULT_RULES } as ShopRules;
  if (!row) return rules;
  for (const f of ALL_FIELDS) {
    const v = row[f.column];
    if (typeof v === "number" && Number.isInteger(v) && v >= f.min && v <= f.max) rules[f.key] = v;
  }
  return rules;
}

/** Cấu hình → các cột để ghi (chỉ các ô đang hiện). */
export function stockRulesToRow(rules: ShopRules): Record<string, number> {
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.column, rules[f.key]]));
}

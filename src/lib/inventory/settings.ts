import { STOCK_RULES, type StockRules } from "./stock";

/**
 * Cấu hình tồn kho của từng shop: mô tả từng ô nhập, giới hạn hợp lệ, cách đọc/ghi database.
 * Giới hạn ở đây PHẢI khớp với ràng buộc check trong supabase/migrations/0003_inventory_settings.sql.
 */

export type StockRuleKey = keyof StockRules;

export interface SettingField {
  key: StockRuleKey;
  /** Tên cột trong bảng inventory_settings. */
  column: string;
  label: string;
  help: string;
  min: number;
  max: number;
}

export const SETTING_FIELDS: readonly SettingField[] = [
  {
    key: "safetyDays",
    column: "safety_days",
    label: "Dự phòng",
    help: "Thêm vài ngày phòng xưởng trễ, vận chuyển chậm. Báo động khi đủ bán < thời gian sản xuất + số ngày này.",
    min: 0,
    max: 60,
  },
  {
    key: "targetCoverDays",
    column: "target_cover_days",
    label: "Sản xuất đủ bán",
    help: "Mỗi lần đặt sản xuất, đặt đủ hàng bán chừng này ngày sau khi hàng về. Số nhỏ để tránh tồn.",
    min: 1,
    max: 365,
  },
  {
    key: "defaultLeadTimeDays",
    column: "default_lead_time_days",
    label: "Thời gian sản xuất mặc định",
    help: "Dùng cho sản phẩm chưa ghi \"SX: …\" trong Ghi chú nội bộ trên Pancake.",
    min: 1,
    max: 180,
  },
  {
    key: "warningWindowDays",
    column: "warning_window_days",
    label: "Báo sớm",
    help: "Còn ít hơn chừng này ngày nữa là đến hạn đặt sản xuất thì báo \"Sắp đến hạn đặt\".",
    min: 0,
    max: 60,
  },
  {
    key: "slowMovingDays",
    column: "slow_moving_days",
    label: "Bán chậm khi đủ bán quá",
    help: "Hàng còn đủ bán lâu hơn chừng này ngày là đang tồn nhiều, nên có kế hoạch xả.",
    min: 7,
    max: 730,
  },
  {
    key: "velocityWindowDays",
    column: "velocity_window_days",
    label: "Tính tốc độ bán trên",
    help: "Bán trung bình mỗi ngày = số bán trong chừng này ngày gần nhất ÷ số ngày.",
    min: 7,
    max: 180,
  },
];

export type SettingsCheck =
  | { ok: true; value: StockRules }
  | { ok: false; errors: Partial<Record<StockRuleKey, string>> };

/** Kiểm tra số người dùng nhập (chuỗi từ form). Chỉ nhận số nguyên trong giới hạn. */
export function checkStockRules(input: Partial<Record<StockRuleKey, unknown>>): SettingsCheck {
  const value = { ...STOCK_RULES } as StockRules;
  const errors: Partial<Record<StockRuleKey, string>> = {};
  for (const f of SETTING_FIELDS) {
    const raw = input[f.key];
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    if (!/^\d+$/.test(text)) {
      errors[f.key] = text === "" ? "Vui lòng nhập số ngày." : "Chỉ nhập số nguyên, ví dụ 3.";
      continue;
    }
    const n = Number(text);
    if (n < f.min || n > f.max) {
      errors[f.key] = `Nhập từ ${f.min} đến ${f.max} ngày.`;
      continue;
    }
    value[f.key] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Dòng database → cấu hình; chưa có dòng (shop chưa cấu hình) thì dùng mặc định. */
export function rowToStockRules(row: Record<string, unknown> | null | undefined): StockRules {
  const rules = { ...STOCK_RULES } as StockRules;
  if (!row) return rules;
  for (const f of SETTING_FIELDS) {
    const v = row[f.column];
    if (typeof v === "number" && Number.isInteger(v) && v >= f.min && v <= f.max) rules[f.key] = v;
  }
  return rules;
}

/** Cấu hình → các cột để ghi vào database. */
export function stockRulesToRow(rules: StockRules): Record<string, number> {
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.column, rules[f.key]]));
}

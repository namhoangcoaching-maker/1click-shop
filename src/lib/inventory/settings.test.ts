import { describe, expect, it } from "vitest";
import { checkStockRules, DEFAULT_RULES, rowToStockRules, SETTING_FIELDS, stockRulesToRow } from "./settings";

const valid = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, String(DEFAULT_RULES[f.key])]));

describe("mặc định theo chủ shop", () => {
  it("tối thiểu 20/size; SX 7/10/14 ngày theo mức 50/150 cái; âm kho tối đa 7; đủ bán thêm 7 ngày", () => {
    expect(DEFAULT_RULES).toMatchObject({
      moqPerSize: 20,
      tier1Qty: 50,
      tier1Days: 7,
      tier2Qty: 150,
      tier2Days: 10,
      tier3Days: 14,
      maxNegativeDays: 7,
      extraCoverDays: 7,
      velocityWindowDays: 30,
    });
  });
});

describe("checkStockRules", () => {
  it("nhận số hợp lệ (cả khoảng trắng hai đầu)", () => {
    const r = checkStockRules({ ...valid, moqPerSize: " 30 " });
    expect(r).toEqual({ ok: true, value: { ...DEFAULT_RULES, moqPerSize: 30 } });
  });

  it("từ chối số âm, số lẻ, chữ, ô trống, vượt giới hạn — báo lỗi đúng ô, đúng đơn vị", () => {
    const r = checkStockRules({
      ...valid,
      moqPerSize: "-1",
      tier1Days: "2.5",
      tier3Days: "abc",
      maxNegativeDays: "",
      velocityWindowDays: "0",
      slowCoverDays: "999",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.moqPerSize).toContain("số nguyên");
    expect(r.errors.tier1Days).toContain("số nguyên");
    expect(r.errors.tier3Days).toContain("số nguyên");
    expect(r.errors.maxNegativeDays).toBe("Vui lòng nhập số.");
    expect(r.errors.velocityWindowDays).toBe("Nhập từ 7 đến 180 ngày.");
    expect(r.errors.slowCoverDays).toBe("Nhập từ 7 đến 365 ngày.");
  });

  it("mức 2 phải lớn hơn mức 1", () => {
    const r = checkStockRules({ ...valid, tier1Qty: "200", tier2Qty: "150" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.tier2Qty).toBe("Mức 2 phải lớn hơn mức 1.");
  });
});

describe("đọc / ghi database", () => {
  it("chưa có dòng cấu hình → dùng mặc định", () => {
    expect(rowToStockRules(null)).toEqual(DEFAULT_RULES);
  });

  it("ghi rồi đọc lại ra đúng cấu hình", () => {
    const rules = { ...DEFAULT_RULES, moqPerSize: 30, tier3Days: 15 };
    expect(rowToStockRules(stockRulesToRow(rules))).toEqual(rules);
    expect(stockRulesToRow(rules)).toMatchObject({ moq_per_size: 30, tier3_days: 15 });
  });

  it("giá trị hỏng bị bỏ qua; cột cũ vẫn đọc được", () => {
    expect(rowToStockRules({ moq_per_size: -4, tier1_days: "x", safety_days: 5 })).toEqual({
      ...DEFAULT_RULES,
      safetyDays: 5,
    });
  });
});

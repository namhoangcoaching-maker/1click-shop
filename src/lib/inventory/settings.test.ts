import { describe, expect, it } from "vitest";
import { checkStockRules, rowToStockRules, SETTING_FIELDS, stockRulesToRow } from "./settings";
import { STOCK_RULES, analyzeStock, type StockItem } from "./stock";

const valid = {
  safetyDays: "3",
  targetCoverDays: "21",
  defaultLeadTimeDays: "7",
  warningWindowDays: "7",
  slowMovingDays: "90",
  velocityWindowDays: "30",
};

describe("mặc định", () => {
  it("dự phòng 3 ngày, sản xuất đủ bán 21 ngày, sản xuất mặc định 7 ngày", () => {
    expect(STOCK_RULES).toMatchObject({ safetyDays: 3, targetCoverDays: 21, defaultLeadTimeDays: 7 });
  });

  it("mỗi con số đều có ô nhập trên trang cấu hình", () => {
    expect(SETTING_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(STOCK_RULES).sort());
  });
});

describe("checkStockRules", () => {
  it("nhận số hợp lệ (cả khoảng trắng hai đầu)", () => {
    const r = checkStockRules({ ...valid, safetyDays: " 5 " });
    expect(r).toEqual({ ok: true, value: { ...STOCK_RULES, safetyDays: 5 } });
  });

  it("dự phòng 0 ngày là hợp lệ", () => {
    expect(checkStockRules({ ...valid, safetyDays: "0" }).ok).toBe(true);
  });

  it("từ chối số âm, số lẻ, chữ, ô trống, vượt giới hạn — báo lỗi đúng ô", () => {
    const r = checkStockRules({
      ...valid,
      safetyDays: "-1",
      targetCoverDays: "2.5",
      defaultLeadTimeDays: "abc",
      warningWindowDays: "",
      slowMovingDays: "5",
      velocityWindowDays: "999",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.safetyDays).toContain("số nguyên");
    expect(r.errors.targetCoverDays).toContain("số nguyên");
    expect(r.errors.defaultLeadTimeDays).toContain("số nguyên");
    expect(r.errors.warningWindowDays).toBe("Vui lòng nhập số ngày.");
    expect(r.errors.slowMovingDays).toBe("Nhập từ 7 đến 730 ngày.");
    expect(r.errors.velocityWindowDays).toBe("Nhập từ 7 đến 180 ngày.");
  });

  it("tốc độ bán không được tính trên 0 ngày (tránh chia cho 0)", () => {
    expect(checkStockRules({ ...valid, velocityWindowDays: "0" }).ok).toBe(false);
  });
});

describe("đọc / ghi database", () => {
  it("chưa có dòng cấu hình → dùng mặc định", () => {
    expect(rowToStockRules(null)).toEqual(STOCK_RULES);
  });

  it("ghi rồi đọc lại ra đúng cấu hình", () => {
    const rules = { ...STOCK_RULES, safetyDays: 5, targetCoverDays: 14 };
    expect(rowToStockRules(stockRulesToRow(rules))).toEqual(rules);
    expect(stockRulesToRow(rules)).toMatchObject({ safety_days: 5, target_cover_days: 14 });
  });

  it("giá trị hỏng trong database bị bỏ qua, dùng mặc định cho ô đó", () => {
    expect(rowToStockRules({ safety_days: -4, target_cover_days: "x", slow_moving_days: 60 })).toEqual({
      ...STOCK_RULES,
      slowMovingDays: 60,
    });
  });
});

describe("cấu hình thay đổi kết quả báo động", () => {
  // Váy size M: bán 5 cái/ngày (150 cái/30 ngày), còn 40 cái → đủ bán 8 ngày; xưởng may 10 ngày.
  const dress: StockItem = {
    sku: "SC-VH-M",
    name: "Váy hoa size M",
    stock: 40,
    soldInWindow: 150,
    leadTimeDays: 10,
    costPrice: 150_000,
    price: 390_000,
  };

  it("dự phòng 3, đủ bán 21: báo động, nên đặt 130 cái", () => {
    const a = analyzeStock(dress, "2026-11-04");
    expect(a.requiredDays).toBe(13);
    expect(a.status).toBe("urgent");
    // Cần đủ hàng cho 10 ngày chờ xưởng + 3 dự phòng + 21 ngày sau khi về: 5 × 34 = 170, trừ 40 đang có.
    expect(a.suggestedQuantity).toBe(130);
  });

  it("sản xuất đủ bán 14 ngày thì đặt ít hơn", () => {
    const a = analyzeStock(dress, "2026-11-04", { ...STOCK_RULES, targetCoverDays: 14 });
    expect(a.suggestedQuantity).toBe(95);
  });

  it("sản phẩm chưa ghi SX dùng thời gian sản xuất mặc định của shop", () => {
    const a = analyzeStock({ ...dress, leadTimeDays: null }, "2026-11-04", {
      ...STOCK_RULES,
      defaultLeadTimeDays: 3,
    });
    expect(a.leadTimeDays).toBe(3);
    expect(a.leadTimeIsDefault).toBe(true);
    expect(a.status).toBe("soon"); // đủ bán 8 ngày ≥ 3 + 3, nhưng < 6 + 7 báo sớm
  });
});

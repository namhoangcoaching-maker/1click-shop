import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatVelocity,
  formatNumber,
  formatPercent,
  formatVND,
  percentChange,
  ratio,
} from "./format";

describe("formatVND", () => {
  it("ngăn hàng nghìn bằng dấu chấm và thêm ₫", () => {
    expect(formatVND(1250000)).toBe("1.250.000 ₫");
    expect(formatVND(0)).toBe("0 ₫");
    expect(formatVND(999)).toBe("999 ₫");
  });

  it("làm tròn về đồng, không có phần lẻ", () => {
    expect(formatVND(1250000.6)).toBe("1.250.001 ₫");
    expect(formatVND(1250000.4)).toBe("1.250.000 ₫");
  });

  it("hiển thị số âm và không bao giờ hiện -0", () => {
    expect(formatVND(-2500000)).toBe("-2.500.000 ₫");
    expect(formatVND(-0.4)).toBe("0 ₫");
  });
});

describe("formatNumber", () => {
  it("ngăn hàng nghìn", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(12)).toBe("12");
  });
});

describe("formatPercent", () => {
  it("mặc định 2 chữ số lẻ, dấu phẩy thập phân", () => {
    expect(formatPercent(42.3712)).toBe("42,37%");
    expect(formatPercent(50)).toBe("50%");
    expect(formatPercent(-8.256)).toBe("-8,26%");
  });

  it("cho phép chọn số chữ số lẻ", () => {
    expect(formatPercent(12.345, 1)).toBe("12,3%");
    expect(formatPercent(12.6, 0)).toBe("13%");
  });
});

describe("formatCompact", () => {
  it("viết gọn cho trục biểu đồ", () => {
    expect(formatCompact(35_000_000)).toBe("35 tr");
    expect(formatCompact(1_250_000_000)).toBe("1,3 tỷ");
    expect(formatCompact(350_000)).toBe("350 k");
    expect(formatCompact(140)).toBe("140");
    expect(formatCompact(0)).toBe("0");
  });
});

describe("percentChange", () => {
  it("tính phần trăm tăng giảm so với kỳ trước", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(100, 100)).toBe(0);
  });

  it("trả về null khi kỳ trước bằng 0", () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("kỳ trước âm (ví dụ lợi nhuận lỗ) vẫn cho chiều đúng", () => {
    // Từ lỗ 100 lên lãi 50 là tăng
    expect(percentChange(50, -100)).toBe(150);
    // Từ lỗ 100 xuống lỗ 200 là giảm
    expect(percentChange(-200, -100)).toBe(-100);
  });
});

describe("ratio", () => {
  it("tính tỷ lệ phần trăm, mẫu bằng 0 thì trả về 0", () => {
    expect(ratio(112, 140)).toBe(80);
    expect(ratio(5, 0)).toBe(0);
  });
});

describe("formatVelocity", () => {
  it("bán rất chậm không bị làm tròn thành 0", () => {
    expect(formatVelocity(0)).toBe("0");
    expect(formatVelocity(1 / 30)).toBe("<0,1");
    expect(formatVelocity(0.1)).toBe("0,1");
    expect(formatVelocity(1.45)).toBe("1,5");
  });
});

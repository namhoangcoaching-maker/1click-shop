import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent, formatVND, percentChange } from "./format";

describe("formatVND", () => {
  it("ngăn hàng nghìn bằng dấu chấm và thêm đ", () => {
    expect(formatVND(1250000)).toBe("1.250.000 đ");
    expect(formatVND(0)).toBe("0 đ");
    expect(formatVND(999)).toBe("999 đ");
  });

  it("làm tròn về đồng, không có phần lẻ", () => {
    expect(formatVND(1250000.6)).toBe("1.250.001 đ");
    expect(formatVND(1250000.4)).toBe("1.250.000 đ");
  });

  it("hiển thị số âm và không bao giờ hiện -0", () => {
    expect(formatVND(-2500000)).toBe("-2.500.000 đ");
    expect(formatVND(-0.4)).toBe("0 đ");
  });
});

describe("formatNumber", () => {
  it("ngăn hàng nghìn", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(12)).toBe("12");
  });
});

describe("formatPercent", () => {
  it("dùng dấu phẩy thập phân, tối đa 1 chữ số lẻ", () => {
    expect(formatPercent(12.345)).toBe("12,3%");
    expect(formatPercent(50)).toBe("50%");
    expect(formatPercent(-8.25)).toBe("-8,3%");
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

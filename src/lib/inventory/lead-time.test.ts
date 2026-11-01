import { describe, expect, it } from "vitest";
import { parseLeadTime } from "./lead-time";

describe("parseLeadTime", () => {
  it("hiểu các cách ghi theo quy ước", () => {
    expect(parseLeadTime("SX: 8")).toBe(8);
    expect(parseLeadTime("sx 8 ngày")).toBe(8);
    expect(parseLeadTime("Sản xuất: 12 ngày")).toBe(12);
    expect(parseLeadTime("san xuat=5")).toBe(5);
    expect(parseLeadTime("SX-10")).toBe(10);
  });

  it("tìm được trong ghi chú có chữ khác", () => {
    expect(parseLeadTime("Hàng xưởng Bình Dương\nSX: 9 ngày, đặt tối thiểu 50")).toBe(9);
  });

  it("ghi chú chỉ có một con số", () => {
    expect(parseLeadTime("8")).toBe(8);
    expect(parseLeadTime(" 14 ngày ")).toBe(14);
  });

  it("không lấy bừa con số khác trong ghi chú", () => {
    expect(parseLeadTime("Bảo hành 12 tháng")).toBeNull();
    expect(parseLeadTime("Size: S M L, giá sỉ 120000")).toBeNull();
    // Mã sản phẩm dính liền "SX" không phải thời gian sản xuất
    expect(parseLeadTime("Mã SX098")).toBeNull();
    expect(parseLeadTime("SC098 – Summer Set")).toBeNull();
  });

  it("bỏ qua ghi chú trống và giá trị vô lý", () => {
    expect(parseLeadTime("")).toBeNull();
    expect(parseLeadTime(null)).toBeNull();
    expect(parseLeadTime("SX: 0")).toBeNull();
    expect(parseLeadTime("SX: 800")).toBeNull();
  });
});

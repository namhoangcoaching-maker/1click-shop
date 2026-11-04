import { describe, expect, it } from "vitest";
import {
  addMonths,
  compareLabel,
  compareRange,
  daysUntil,
  formatDateTimeVN,
  formatRangeVN,
  listDays,
  presetRange,
  rangeLength,
  resolveFilter,
  todayInVN,
} from "./date-range";

describe("todayInVN", () => {
  it("dùng giờ Việt Nam (UTC+7), không dùng giờ server", () => {
    // 17:30 UTC ngày 31/10 = 00:30 sáng 01/11 ở Việt Nam
    expect(todayInVN(new Date("2026-10-31T17:30:00Z"))).toBe("2026-11-01");
    // 16:59 UTC ngày 31/10 = 23:59 ngày 31/10 ở Việt Nam
    expect(todayInVN(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10-31");
  });
});

describe("presetRange", () => {
  const today = "2026-11-01";

  it("Hôm nay, Hôm qua", () => {
    expect(presetRange("today", today)).toEqual({ from: "2026-11-01", to: "2026-11-01" });
    expect(presetRange("yesterday", today)).toEqual({ from: "2026-10-31", to: "2026-10-31" });
  });

  it("7 ngày và 30 ngày tính cả hôm nay", () => {
    expect(presetRange("last7", today)).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(rangeLength(presetRange("last30", today))).toBe(30);
  });

  it("Tháng này và Tháng trước", () => {
    expect(presetRange("thisMonth", "2026-11-15")).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(presetRange("lastMonth", "2026-03-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetRange("lastMonth", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});

describe("compareRange", () => {
  it("kỳ liền trước có cùng số ngày, nằm ngay trước", () => {
    expect(compareRange({ from: "2026-11-01", to: "2026-11-01" }, "previous")).toEqual({
      from: "2026-10-31",
      to: "2026-10-31",
    });
    expect(compareRange({ from: "2026-10-26", to: "2026-11-01" }, "previous")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
  });

  it("cùng kỳ tháng trước, kẹp về ngày cuối tháng khi tháng trước ngắn hơn", () => {
    expect(compareRange({ from: "2026-03-01", to: "2026-03-31" }, "previousMonth")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(addMonths("2024-03-31", -1)).toBe("2024-02-29"); // năm nhuận
  });

  it("không so sánh thì trả về null", () => {
    expect(compareRange({ from: "2026-11-01", to: "2026-11-01" }, "none")).toBeNull();
  });
});

describe("nhãn hiển thị", () => {
  it("nhãn so sánh giống Pancake", () => {
    expect(compareLabel({ from: "2026-11-01", to: "2026-11-01" }, "previous")).toBe("Trước đó 1 ngày");
    expect(compareLabel({ from: "2026-10-26", to: "2026-11-01" }, "previous")).toBe("Trước đó 7 ngày");
    expect(compareLabel({ from: "2026-11-01", to: "2026-11-01" }, "previousMonth")).toBe(
      "Cùng kỳ tháng trước",
    );
  });

  it("định dạng ngày dd/mm/yyyy", () => {
    expect(formatRangeVN({ from: "2026-11-01", to: "2026-11-01" })).toBe("01/11/2026");
    expect(formatRangeVN({ from: "2026-10-26", to: "2026-11-01" })).toBe("26/10/2026 – 01/11/2026");
  });
});

describe("listDays và daysUntil", () => {
  it("liệt kê từng ngày, qua cả ranh giới tháng", () => {
    expect(listDays({ from: "2026-10-30", to: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("đếm số ngày còn lại đến hạn", () => {
    expect(daysUntil("2026-11-05", "2026-11-02")).toBe(3);
    expect(daysUntil("2026-11-02", "2026-11-02")).toBe(0);
    expect(daysUntil("2026-10-31", "2026-11-02")).toBe(-2);
    expect(daysUntil("2027-01-31", "2026-11-02")).toBe(90);
  });
});

describe("resolveFilter", () => {
  it("mặc định là Hôm nay, so với kỳ liền trước", () => {
    const f = resolveFilter({}, "2026-11-01");
    expect(f.preset).toBe("today");
    expect(f.compare).toBe("previous");
    expect(f.previousRange).toEqual({ from: "2026-10-31", to: "2026-10-31" });
    expect(f.compareLabel).toBe("Trước đó 1 ngày");
  });

  it("bỏ qua giá trị lạ trên thanh địa chỉ", () => {
    const f = resolveFilter({ range: "toString", compare: ["x", "y"] }, "2026-11-01");
    expect(f.preset).toBe("today");
    expect(f.compare).toBe("previous");
  });

  it("đọc đúng tham số hợp lệ", () => {
    const f = resolveFilter({ range: "last7", compare: "none" }, "2026-11-01");
    expect(f.range).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(f.previousRange).toBeNull();
  });
});

describe("formatDateTimeVN", () => {
  it("đổi giờ quốc tế sang giờ Việt Nam (+7)", () => {
    expect(formatDateTimeVN("2026-11-04T12:44:53.226Z")).toBe("04/11/2026 19:44");
    expect(formatDateTimeVN("2026-12-31T17:30:00Z")).toBe("01/01/2027 00:30");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, checkSettings, dailyRate, describeShift, fromRow, parseMoney, toRow } from "./settings";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const ok = {
  attendanceMode: "gps",
  locationId: "loc-1",
  workDays: ["1", "2", "3", "4", "5", "6"],
  shiftStart: "08:00",
  shiftEnd: "17:30",
  lateGraceMin: "10",
  payType: "monthly",
  baseSalary: "7.000.000",
  standardDays: "26",
  allowance: "500.000",
  latePenalty: "50.000",
};

describe("parseMoney", () => {
  it("đọc số tiền có dấu chấm/khoảng trắng/₫; trống = 0; chữ = sai", () => {
    expect(parseMoney("7.000.000")).toBe(7_000_000);
    expect(parseMoney("7 000 000 ₫")).toBe(7_000_000);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("bảy triệu")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });
});

describe("checkSettings", () => {
  it("hợp lệ: đọc đủ các ô", () => {
    expect(checkSettings(form(ok))).toEqual({
      ok: true,
      value: {
        attendanceMode: "gps", locationId: "loc-1", workDays: [1, 2, 3, 4, 5, 6], shiftStart: "08:00", shiftEnd: "17:30",
        lateGraceMin: 10, payType: "monthly", baseSalary: 7_000_000, standardDays: 26, allowance: 500_000, latePenalty: 50_000,
      },
    });
  });

  it("online tại nhà: không cần địa điểm (bỏ địa điểm đã chọn)", () => {
    const r = checkSettings(form({ ...ok, attendanceMode: "online" }));
    expect(r.ok && r.value.locationId).toBeNull();
  });

  it("từ chối: GPS chưa chọn địa điểm, không chọn ngày, giờ ra trước giờ vào, giờ sai dạng, tiền sai", () => {
    expect(checkSettings(form({ ...ok, locationId: "" }))).toMatchObject({ ok: false, message: /địa điểm/ });
    expect(checkSettings(form({ ...ok, workDays: [] }))).toMatchObject({ ok: false, message: /ngày làm/ });
    expect(checkSettings(form({ ...ok, shiftEnd: "07:00" }))).toMatchObject({ ok: false, message: /sau giờ vào/ });
    expect(checkSettings(form({ ...ok, shiftStart: "8h" }))).toMatchObject({ ok: false, message: /HH:MM/ });
    expect(checkSettings(form({ ...ok, baseSalary: "7tr" }))).toMatchObject({ ok: false, message: /chữ số/ });
    expect(checkSettings(form({ ...ok, standardDays: "0" }))).toMatchObject({ ok: false, message: /công chuẩn/ });
  });
});

describe("dailyRate – tiền một ngày công đủ", () => {
  const s = { ...DEFAULT_SETTINGS, baseSalary: 7_800_000 };
  it("lương tháng ÷ ngày công chuẩn", () => expect(dailyRate(s)).toBe(300_000));
  it("lương theo ngày", () => expect(dailyRate({ ...s, payType: "daily", baseSalary: 250_000 })).toBe(250_000));
  it("lương theo giờ × số giờ ca (08:00–17:30 = 9,5 giờ)", () =>
    expect(dailyRate({ ...s, payType: "hourly", baseSalary: 30_000 })).toBe(285_000));
});

describe("describeShift", () => {
  it("ngày liền nhau gộp, rời rạc liệt kê, đủ 7 ngày = Cả tuần", () => {
    expect(describeShift(DEFAULT_SETTINGS)).toBe("T2–T7 · 08:00–17:30");
    expect(describeShift({ ...DEFAULT_SETTINGS, workDays: [1, 3, 5] })).toBe("T2, T4, T6 · 08:00–17:30");
    expect(describeShift({ ...DEFAULT_SETTINGS, workDays: [1, 2, 3, 4, 5, 6, 7] })).toBe("Cả tuần · 08:00–17:30");
  });
});

describe("fromRow / toRow", () => {
  it("chưa cấu hình → mặc định; đổi qua lại không mất gì", () => {
    expect(fromRow(null)).toEqual(DEFAULT_SETTINGS);
    const s = { ...DEFAULT_SETTINGS, baseSalary: 123, locationId: "x" };
    expect(fromRow({ ...toRow(s), standard_days: "26.0", base_salary: "123" })).toEqual({ ...s, pancakeSellerId: null });
    // Form cấu hình không ghi đè mã nhân viên Pancake (lưu riêng ở trang KPI).
    expect(toRow({ ...s, pancakeSellerId: "p1" })).not.toHaveProperty("pancake_seller_id");
  });
});

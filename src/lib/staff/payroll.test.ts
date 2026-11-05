import { describe, expect, it } from "vitest";
import { personMonth, vnToIso, type AttendanceRow } from "./attendance";
import { estimatePay, payFor } from "./payroll";
import { DEFAULT_SETTINGS, type StaffSettings } from "./settings";

const monthly: StaffSettings = { ...DEFAULT_SETTINGS, payType: "monthly", baseSalary: 7_800_000, standardDays: 26, allowance: 520_000, latePenalty: 50_000, shiftStart: "08:00", shiftEnd: "17:00" };

describe("lương cho số công cho trước", () => {
  it("lương tháng theo ngày công: 7,8tr ÷ 26 × 20 công = 6tr; phụ cấp theo tỷ lệ; trừ phạt muộn", () => {
    const p = payFor(monthly, 20, 20 * 540, 2);
    expect(p).toMatchObject({ base: 6_000_000, allowance: 400_000, latePenalty: 100_000, total: 6_300_000 });
  });

  it("làm vượt ngày công chuẩn thì trả thêm theo công; phụ cấp tối đa đủ", () => {
    const p = payFor(monthly, 27, 27 * 540, 0);
    expect(p.base).toBe(8_100_000);
    expect(p.allowance).toBe(520_000);
  });

  it("lương theo ngày = đơn giá × công (công lẻ)", () => {
    const p = payFor({ ...monthly, payType: "daily", baseSalary: 300_000, allowance: 0 }, 10.5, 0, 0);
    expect(p.base).toBe(3_150_000);
  });

  it("lương theo giờ = đơn giá × giờ làm trong ca", () => {
    const p = payFor({ ...monthly, payType: "hourly", baseSalary: 30_000, allowance: 0 }, 5, 37 * 60 + 30, 0);
    expect(p.base).toBe(1_125_000);
  });

  it("phạt nhiều hơn lương thì tổng = 0, không âm", () => {
    expect(payFor(monthly, 0, 0, 3).total).toBe(0);
  });

  it("cộng thưởng KPI, trừ phạt KPI", () => {
    expect(payFor(monthly, 20, 20 * 540, 2, 600_000).total).toBe(6_900_000);
    expect(payFor(monthly, 20, 20 * 540, 2, -90_000).total).toBe(6_210_000);
  });
});

describe("lương dự kiến từ bảng công tháng", () => {
  const row = (date: string, i: string, o: string | null): AttendanceRow => ({
    userId: "u",
    workDate: date,
    checkInAt: vnToIso(date, i),
    checkOutAt: o ? vnToIso(date, o) : null,
    mode: "online",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    lateGraceMin: 10,
    editNote: null,
    editedAt: null,
  });

  it("tới hôm nay theo công đã chấm; cả tháng = cộng các ngày làm còn lại đủ ca", () => {
    // Tháng 11/2026, làm T2–T7 (26 ngày làm). Hôm nay 05/11 (T5) đang làm.
    const rows = [row("2026-11-02", "08:00", "17:00"), row("2026-11-03", "08:30", "17:00"), row("2026-11-05", "08:00", null)];
    const pm = personMonth(rows, monthly.workDays, "2026-11-01", "2026-11-30", "2026-11-05");
    const e = estimatePay(monthly, pm);
    // Đã chấm: 1 + 0,94 công (04/11 vắng); 1 lần muộn.
    expect(e.sofar.units).toBe(1.94);
    expect(e.sofar.base).toBe(Math.round((7_800_000 / 26) * 1.94));
    expect(e.sofar.latePenalty).toBe(50_000);
    // Còn lại: hôm nay + 21 ngày làm từ 06/11 tới 30/11 (bỏ 3 Chủ nhật 08, 15, 22, 29 → 25 ngày − 4 CN = 21) = 22.
    expect(e.month.units).toBe(1.94 + 22);
    expect(e.month.latePenalty).toBe(50_000);
  });
});

import { describe, expect, it } from "vitest";
import {
  checkPosition,
  dayFromRow,
  dayWithoutRow,
  distanceM,
  formatUnits,
  monthEditable,
  personMonth,
  validPosition,
  vnDateOf,
  vnMinuteOf,
  vnTimeOf,
  vnToIso,
  weekday,
  type AttendanceRow,
} from "./attendance";

const row = (date: string, inTime: string | null, outTime: string | null, extra: Partial<AttendanceRow> = {}): AttendanceRow => ({
  userId: "u1",
  workDate: date,
  checkInAt: inTime ? vnToIso(date, inTime) : null,
  checkOutAt: outTime ? vnToIso(date, outTime) : null,
  mode: "gps",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  lateGraceMin: 10,
  editNote: null,
  editedAt: null,
  ...extra,
});

describe("giờ Việt Nam", () => {
  it("đổi qua lại giữa giờ VN và UTC", () => {
    expect(vnToIso("2026-11-05", "08:00")).toBe("2026-11-05T01:00:00.000Z");
    expect(vnToIso("2026-11-05", "06:30")).toBe("2026-11-04T23:30:00.000Z");
    expect(vnDateOf("2026-11-04T23:30:00.000Z")).toBe("2026-11-05");
    expect(vnMinuteOf("2026-11-04T23:30:00.000Z")).toBe(6 * 60 + 30);
    expect(vnTimeOf("2026-11-05T10:05:00Z")).toBe("17:05");
    expect(vnToIso("2026-11-05", "25:00")).toBeNull();
  });

  it("thứ trong tuần: 1 = Thứ 2, 7 = Chủ nhật", () => {
    expect(weekday("2026-11-02")).toBe(1); // Thứ 2
    expect(weekday("2026-11-07")).toBe(6); // Thứ 7
    expect(weekday("2026-11-08")).toBe(7); // Chủ nhật
  });
});

describe("vị trí GPS", () => {
  const shop = { name: "Shop", lat: 21.0285, lng: 105.8542, radiusM: 100 };

  it("khoảng cách đúng cỡ: 0,001 độ vĩ ≈ 111 m", () => {
    expect(Math.round(distanceM(21, 105, 21.001, 105))).toBe(111);
    expect(distanceM(21, 105, 21, 105)).toBe(0);
  });

  it("trong bán kính thì cho chấm, ngoài thì báo cách bao xa", () => {
    expect(checkPosition(shop, { lat: 21.0286, lng: 105.8542, accuracy: 15 })).toEqual({ ok: true, distance: 11 });
    const far = checkPosition(shop, { lat: 21.0385, lng: 105.8542, accuracy: 15 });
    expect(far.ok).toBe(false);
    if (!far.ok) expect(far.message).toContain("1,1 km");
    const near = checkPosition(shop, { lat: 21.0297, lng: 105.8542, accuracy: 20 });
    if (!near.ok) expect(near.message).toContain("133 m");
  });

  it("vị trí kém chính xác thì gợi ý bật vị trí chính xác", () => {
    const r = checkPosition(shop, { lat: 21.0305, lng: 105.8542, accuracy: 500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("±500 m");
  });

  it("chặn tọa độ rác", () => {
    expect(validPosition({ lat: 21, lng: 105, accuracy: 10 })).toBe(true);
    expect(validPosition({ lat: 91, lng: 105, accuracy: 10 })).toBe(false);
    expect(validPosition({ lat: Number.NaN, lng: 105, accuracy: 10 })).toBe(false);
    expect(validPosition({ lat: 21, lng: 105 })).toBe(false);
  });
});

describe("công một ngày (theo giờ làm trong ca)", () => {
  const today = "2026-11-05";

  it("đủ ca = 1 công; đến sớm, về muộn không tính thêm", () => {
    const d = dayFromRow(row("2026-11-04", "07:30", "18:00"), today);
    expect(d).toMatchObject({ status: "done", units: 1, workedMin: 540, lateMin: 0, late: false });
  });

  it("làm 6 trên 9 tiếng = 0,67 công", () => {
    const d = dayFromRow(row("2026-11-04", "08:00", "14:00"), today);
    expect(d.units).toBe(0.67);
    expect(d.workedMin).toBe(360);
  });

  it("muộn trong số phút cho phép: không tính là đi muộn, nhưng phút muộn vẫn trừ vào giờ làm", () => {
    const d = dayFromRow(row("2026-11-04", "08:09", "17:00"), today);
    expect(d).toMatchObject({ late: false, lateMin: 9, workedMin: 531 });
    expect(d.units).toBe(0.98);
  });

  it("muộn quá số phút cho phép là đi muộn", () => {
    const d = dayFromRow(row("2026-11-04", "08:25", "17:00"), today);
    expect(d).toMatchObject({ late: true, lateMin: 25 });
  });

  it("quên Ra ca: ngày đã qua chưa có công (chờ sửa); hôm nay là đang làm", () => {
    expect(dayFromRow(row("2026-11-04", "08:00", null), today)).toMatchObject({ status: "missing_out", units: 0 });
    expect(dayFromRow(row(today, "08:00", null), today)).toMatchObject({ status: "working", units: 0 });
  });

  it("vào và ra đều ngoài ca = 0 công", () => {
    expect(dayFromRow(row("2026-11-04", "18:00", "20:00"), today).units).toBe(0);
  });

  it("ngày không có dòng: theo ca cố định", () => {
    const work = [1, 2, 3, 4, 5, 6];
    expect(dayWithoutRow("2026-11-04", work, today).status).toBe("absent");
    expect(dayWithoutRow("2026-11-01", work, today).status).toBe("off"); // Chủ nhật
    expect(dayWithoutRow(today, work, today).status).toBe("pending");
    expect(dayWithoutRow("2026-11-06", work, today).status).toBe("future");
  });
});

describe("bảng công tháng", () => {
  it("cộng công, đếm muộn, quên ra ca, vắng", () => {
    const rows = [
      row("2026-11-02", "08:00", "17:00"), // 1
      row("2026-11-03", "08:30", "17:00"), // muộn, 0,94
      row("2026-11-04", "08:00", null), // quên ra ca
    ];
    const m = personMonth(rows, [1, 2, 3, 4, 5, 6], "2026-11-01", "2026-11-30", "2026-11-05");
    expect(m.days).toHaveLength(30);
    expect(m.summary).toEqual({ units: 1.94, workedMin: 540 + 510, lateCount: 1, missingOut: 1, absent: 0 });
    expect(m.days[0].status).toBe("off"); // CN 01/11
    expect(m.days[4].status).toBe("pending"); // hôm nay chưa vào
    expect(m.days[5].status).toBe("future");
  });

  it("đếm ngày vắng", () => {
    const m = personMonth([], [1, 2, 3, 4, 5, 6], "2026-11-01", "2026-11-07", "2026-11-08");
    expect(m.summary.absent).toBe(6);
  });

  it("công hiện dạng 0,75", () => {
    expect(formatUnits(0.75)).toBe("0,75");
    expect(formatUnits(22)).toBe("22");
  });
});

describe("khóa sổ", () => {
  it("tháng 10 sửa được tới hết mùng 5/11, sau đó khóa trừ khi Chủ mở", () => {
    expect(monthEditable("2026-10-15", "2026-11-05", false)).toBe(true);
    expect(monthEditable("2026-10-15", "2026-11-06", false)).toBe(false);
    expect(monthEditable("2026-10-15", "2026-11-06", true)).toBe(true);
    expect(monthEditable("2026-12-31", "2027-01-05", false)).toBe(true);
    expect(monthEditable("2026-12-31", "2027-01-06", false)).toBe(false);
  });

  it("ngày tương lai không sửa được", () => {
    expect(monthEditable("2026-11-06", "2026-11-05", true)).toBe(false);
  });
});

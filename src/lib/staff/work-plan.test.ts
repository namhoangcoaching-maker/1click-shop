import { describe, expect, it } from "vitest";
import { vnToIso } from "./attendance";
import { daySummary, manualKpiActual, recurringForDay, tasksForDay, type RecurringTask, type Task } from "./work-plan";

const task = (id: string, due: string, doneOn: string | null, createdBy = "boss"): Task => ({
  id,
  userId: "u1",
  title: id,
  dueDate: due,
  createdBy,
  doneAt: doneOn ? vnToIso(doneOn, "15:00") : null,
});

describe("việc theo ngày (việc chưa xong tự dồn sang ngày sau)", () => {
  const tasks = [
    task("A", "2026-11-03", null), // trễ từ 03/11
    task("B", "2026-11-05", "2026-11-05"), // xong hôm nay
    task("C", "2026-11-04", "2026-11-04"), // xong hôm qua → không hiện hôm nay
    task("D", "2026-11-06", null), // ngày mai
    task("E", "2026-11-05", null, "u1"), // tự thêm
    { ...task("X", "2026-11-05", null), userId: "u2" },
  ];

  it("hôm nay: việc trễ, việc hôm nay, việc xong hôm nay; chưa xong lên trước", () => {
    const d = tasksForDay(tasks, "u1", "2026-11-05");
    expect(d.map((x) => x.task.id)).toEqual(["A", "E", "B"]);
    expect(d[0]).toMatchObject({ lateFrom: "2026-11-03", done: false });
    expect(d[1]).toMatchObject({ selfAdded: true, lateFrom: null });
    expect(d[2].done).toBe(true);
  });

  it("xem lại ngày cũ: việc xong SAU ngày đó vẫn là chưa xong ở ngày đó", () => {
    const d = tasksForDay(tasks, "u1", "2026-11-04");
    expect(d.map((x) => [x.task.id, x.done])).toEqual([
      ["A", false],
      ["C", true],
    ]);
    // B giao 05/11, 04/11 chưa có
    const d3 = tasksForDay([task("B", "2026-11-03", "2026-11-05")], "u1", "2026-11-04");
    expect(d3[0]).toMatchObject({ done: false, lateFrom: "2026-11-03" });
  });
});

describe("việc lặp lại", () => {
  const list: RecurringTask[] = [
    { id: "R1", title: "Trả lời tin nhắn", userId: "u1", department: null, workDays: [1, 2, 3, 4, 5, 6], startDate: "2026-11-01", archived: false },
    { id: "R2", title: "Kiểm kho", userId: null, department: "Kho", workDays: [4], startDate: "2026-11-01", archived: false },
    { id: "R3", title: "Cũ", userId: "u1", department: null, workDays: [4], startDate: "2026-11-01", archived: true },
    { id: "R4", title: "Mới", userId: "u1", department: null, workDays: [4], startDate: "2026-11-10", archived: false },
  ];
  it("theo thứ, người, bộ phận; bỏ việc ngừng và việc chưa bắt đầu", () => {
    expect(recurringForDay(list, "u1", "Kho", "2026-11-05").map((r) => r.id)).toEqual(["R1", "R2"]); // T5
    expect(recurringForDay(list, "u1", null, "2026-11-08").map((r) => r.id)).toEqual([]); // CN
  });
  it("đếm xong / tổng / trễ", () => {
    const d = tasksForDay([task("A", "2026-11-03", null), task("B", "2026-11-05", "2026-11-05")], "u1", "2026-11-05");
    expect(daySummary(d, list.slice(0, 2), new Set(["R1"]))).toEqual({ total: 4, done: 2, late: 1 });
  });
});

describe("KPI nhập tay: tổng báo cáo ngày, Quản lý nhập thì thắng", () => {
  it("chọn đúng số", () => {
    expect(manualKpiActual(null, 120)).toBe(120);
    expect(manualKpiActual(100, 120)).toBe(100);
    expect(manualKpiActual(0, 120)).toBe(0);
    expect(manualKpiActual(undefined, undefined)).toBeNull();
  });
});

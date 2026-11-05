import { describe, expect, it } from "vitest";
import { assignableRoles, canManage } from "./permissions";

describe("phân quyền quản lý nhân sự (6.2)", () => {
  it("Chủ quản lý mọi người; Quản lý chỉ Nhân viên; Nhân viên không ai", () => {
    expect(canManage("owner", "owner")).toBe(true);
    expect(canManage("owner", "manager")).toBe(true);
    expect(canManage("manager", "staff")).toBe(true);
    expect(canManage("manager", "manager")).toBe(false);
    expect(canManage("manager", "owner")).toBe(false);
    expect(canManage("staff", "staff")).toBe(false);
  });
  it("vai trò được gán", () => {
    expect(assignableRoles("owner")).toEqual(["staff", "manager", "owner"]);
    expect(assignableRoles("manager")).toEqual(["staff"]);
    expect(assignableRoles("staff")).toEqual([]);
  });
});

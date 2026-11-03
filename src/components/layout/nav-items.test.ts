import { describe, expect, it } from "vitest";
import { isActive } from "./nav-items";

describe("isActive", () => {
  it("Tổng quan chỉ sáng ở đúng trang chủ", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/ton-kho")).toBe(false);
  });

  it("các mục khác sáng cả ở trang con", () => {
    expect(isActive("/nhan-su", "/nhan-su")).toBe(true);
    expect(isActive("/nhan-su", "/nhan-su/cham-cong")).toBe(true);
  });

  it("không nhầm mục có tên bắt đầu giống nhau", () => {
    expect(isActive("/thue", "/thue-bao")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { roleLabel, shopInitials } from "./roles";

describe("roleLabel", () => {
  it("đổi vai trò sang tiếng Việt", () => {
    expect(roleLabel("owner")).toBe("Chủ shop");
    expect(roleLabel("manager")).toBe("Quản lý");
    expect(roleLabel("staff")).toBe("Nhân viên");
    expect(roleLabel("admin")).toBe("Thành viên");
  });
});

describe("shopInitials", () => {
  it("một từ lấy 2 chữ đầu, nhiều từ lấy chữ đầu 2 từ đầu", () => {
    expect(shopInitials("Ecobath")).toBe("EC");
    expect(shopInitials("gốm bát tràng")).toBe("GB");
    expect(shopInitials("  Đồ   gia dụng ")).toBe("ĐG");
  });

  it("tên rỗng hiện dấu hỏi", () => {
    expect(shopInitials("   ")).toBe("?");
  });
});

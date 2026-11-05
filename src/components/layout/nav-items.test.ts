import { describe, expect, it } from "vitest";
import { ACCOUNT_NAV, NAV_BY_HREF, PERSONAL_NAV, activeHref, canAccess, isActive, navFor } from "./nav-items";

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

describe("phân quyền trang và menu (6.1)", () => {
  it("Nhân viên chỉ vào được trang Của tôi (và trang con), không vào trang số liệu", () => {
    expect(canAccess("staff", "/cua-toi")).toBe(true);
    expect(canAccess("staff", "/cua-toi/doi-mat-khau")).toBe(true);
    expect(canAccess("staff", "/tai-khoan")).toBe(true);
    expect(canAccess("staff", "/nhan-su/cau-hinh")).toBe(false);
    for (const p of ["/", "/bao-cao", "/ton-kho", "/dong-tien", "/ket-noi", "/nhan-su", "/thue"]) {
      expect(canAccess("staff", p)).toBe(false);
    }
  });

  it("Chủ shop, Quản lý vào được mọi trang", () => {
    for (const role of ["owner", "manager"] as const) {
      for (const p of ["/", "/dong-tien", "/ket-noi", "/nhan-su", "/cua-toi"]) expect(canAccess(role, p)).toBe(true);
    }
  });

  it("menu Nhân viên chỉ có Của tôi + Tài khoản; Chủ/Quản lý có đủ menu + Cấu hình nhân sự + Kết nối + Tài khoản", () => {
    expect(navFor("staff")).toEqual({ main: [PERSONAL_NAV], settings: [ACCOUNT_NAV] });
    const owner = navFor("owner");
    expect(owner.main.map((i) => i.href)).toContain("/dong-tien");
    expect(owner.main.at(-1)!.href).toBe("/cua-toi");
    expect(owner.settings.map((i) => i.href)).toEqual(["/nhan-su/cau-hinh", "/ket-noi", "/tai-khoan"]);
  });

  it("tô sáng mục khớp dài nhất", () => {
    expect(activeHref("/nhan-su/cau-hinh/abc")).toBe("/nhan-su/cau-hinh");
    expect(activeHref("/nhan-su")).toBe("/nhan-su");
    expect(activeHref("/")).toBe("/");
    expect(activeHref("/lung-tung")).toBeNull();
  });

  it("mọi mục menu tra được theo đường dẫn", () => {
    for (const i of [...navFor("owner").main, ...navFor("owner").settings]) expect(NAV_BY_HREF[i.href]).toBe(i);
  });
});

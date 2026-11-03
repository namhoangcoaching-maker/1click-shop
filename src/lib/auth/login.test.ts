import { describe, expect, it } from "vitest";
import { checkLoginInput, loginErrorMessage } from "./login";
import { isPublicPath, safeNextPath } from "./paths";

describe("checkLoginInput", () => {
  it("chuẩn hóa email: bỏ khoảng trắng, chữ thường", () => {
    expect(checkLoginInput("  Shop@Gmail.COM ", "abc123")).toEqual({
      ok: true,
      value: { email: "shop@gmail.com", password: "abc123" },
    });
  });

  it("báo thiếu email, sai dạng email, thiếu mật khẩu", () => {
    expect(checkLoginInput("", "x")).toEqual({ ok: false, error: "Vui lòng nhập email." });
    expect(checkLoginInput("shop", "x").ok).toBe(false);
    expect(checkLoginInput("shop@gmail", "x").ok).toBe(false);
    expect(checkLoginInput("shop@gmail.com", "")).toEqual({
      ok: false,
      error: "Vui lòng nhập mật khẩu.",
    });
  });

  it("không cắt khoảng trắng trong mật khẩu", () => {
    const r = checkLoginInput("a@b.vn", " pass ");
    expect(r.ok && r.value.password).toBe(" pass ");
  });

  it("chịu được dữ liệu không phải chữ", () => {
    expect(checkLoginInput(null, undefined).ok).toBe(false);
  });
});

describe("loginErrorMessage", () => {
  it("sai mật khẩu và lỗi lạ đều có câu tiếng Việt", () => {
    expect(loginErrorMessage("invalid_credentials")).toBe("Email hoặc mật khẩu không đúng.");
    expect(loginErrorMessage(undefined)).toContain("thử lại");
  });
});

describe("đường dẫn đăng nhập", () => {
  it("chỉ trang đăng nhập là công khai", () => {
    expect(isPublicPath("/dang-nhap")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/ton-kho")).toBe(false);
    expect(isPublicPath("/dang-nhapx")).toBe(false);
  });

  it("safeNextPath giữ trang nội bộ, chặn web ngoài", () => {
    expect(safeNextPath("/ton-kho?loc=het-hang")).toBe("/ton-kho?loc=het-hang");
    expect(safeNextPath("https://xau.com")).toBe("/");
    expect(safeNextPath("//xau.com")).toBe("/");
    expect(safeNextPath("/\\xau.com")).toBe("/");
    expect(safeNextPath("/dang-nhap")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

import { describe, expect, it } from "vitest";
import { interpretShopsResponse, pickShop } from "./shops";

describe("interpretShopsResponse", () => {
  it("khóa đúng: lấy id (đổi sang chữ) và tên shop", () => {
    const r = interpretShopsResponse(200, {
      success: true,
      shops: [{ id: 6036602, name: "Ecobath", avatar_url: "x" }],
    });
    expect(r).toEqual({ ok: true, shops: [{ id: "6036602", name: "Ecobath" }] });
  });

  it("khóa sai (403 như Pancake trả thật)", () => {
    const r = interpretShopsResponse(403, { message: "api_key is invalid", success: false, error_code: 105 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("từ chối");
  });

  it("bị giới hạn, Pancake lỗi, dữ liệu lạ", () => {
    expect(interpretShopsResponse(429, {}).ok).toBe(false);
    expect(interpretShopsResponse(503, null).ok).toBe(false);
    const odd = interpretShopsResponse(200, { success: false, message: "hết hạn" });
    expect(!odd.ok && odd.error).toContain("hết hạn");
  });

  it("khóa đúng nhưng không có shop nào", () => {
    expect(interpretShopsResponse(200, { success: true, shops: [] }).ok).toBe(false);
  });
});

describe("pickShop", () => {
  const shops = [
    { id: "1", name: "Ecobath" },
    { id: "2", name: "Shop phụ" },
  ];

  it("để trống Shop ID: chỉ 1 shop thì tự chọn", () => {
    expect(pickShop([shops[0]], "  ")).toEqual({ ok: true, shop: shops[0] });
  });

  it("để trống Shop ID mà có nhiều shop thì yêu cầu nhập, liệt kê các shop", () => {
    const r = pickShop(shops, "");
    expect(!r.ok && r.error).toContain("Shop phụ (ID 2)");
  });

  it("nhập đúng Shop ID", () => {
    expect(pickShop(shops, " 2 ")).toEqual({ ok: true, shop: shops[1] });
  });

  it("nhập Shop ID khóa không có quyền", () => {
    const r = pickShop(shops, "99");
    expect(!r.ok && r.error).toContain("không có quyền với Shop ID 99");
  });
});

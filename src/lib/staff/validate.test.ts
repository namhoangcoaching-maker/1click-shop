import { describe, expect, it } from "vitest";
import { checkNewMember, checkPasswordChange, checkProfile } from "./validate";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("checkNewMember", () => {
  const ok = { displayName: " Nguyễn Thị Lan ", email: " Lan@Gmail.com ", password: "matkhau123", role: "staff", department: "Đóng gói" };

  it("hợp lệ: cắt khoảng trắng, email chữ thường", () => {
    expect(checkNewMember(form(ok))).toEqual({
      ok: true,
      value: { displayName: "Nguyễn Thị Lan", email: "lan@gmail.com", password: "matkhau123", role: "staff", department: "Đóng gói" },
    });
  });

  it("bộ phận để trống được", () => {
    const r = checkNewMember(form({ ...ok, department: "  " }));
    expect(r.ok && r.value.department).toBeNull();
  });

  it("từ chối: thiếu tên, email sai, mật khẩu ngắn, vai trò lạ", () => {
    expect(checkNewMember(form({ ...ok, displayName: " " }))).toMatchObject({ ok: false, message: /Họ tên/ });
    expect(checkNewMember(form({ ...ok, email: "lan@gmail" }))).toMatchObject({ ok: false, message: /Email/ });
    expect(checkNewMember(form({ ...ok, password: "1234567" }))).toMatchObject({ ok: false, message: /ít nhất 8/ });
    expect(checkNewMember(form({ ...ok, role: "admin" }))).toMatchObject({ ok: false, message: /vai trò/ });
  });
});

describe("checkProfile", () => {
  it("bộ phận quá 60 ký tự bị từ chối", () => {
    expect(checkProfile(form({ displayName: "A", role: "manager", department: "x".repeat(61) }))).toMatchObject({ ok: false });
  });
});

describe("checkPasswordChange", () => {
  const base = { current: "cu123456", next: "moi123456", confirm: "moi123456" };
  it("hợp lệ", () => {
    expect(checkPasswordChange(form(base))).toEqual({ ok: true, value: { current: "cu123456", next: "moi123456" } });
  });
  it("nhập lại không khớp / trùng mật khẩu cũ / thiếu mật khẩu hiện tại", () => {
    expect(checkPasswordChange(form({ ...base, confirm: "khac12345" }))).toMatchObject({ ok: false, message: /không khớp/ });
    expect(checkPasswordChange(form({ ...base, next: "cu123456", confirm: "cu123456" }))).toMatchObject({ ok: false, message: /khác/ });
    expect(checkPasswordChange(form({ ...base, current: "" }))).toMatchObject({ ok: false, message: /hiện tại/ });
  });
});

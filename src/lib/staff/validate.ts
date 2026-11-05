/**
 * Kiểm tra thông tin thành viên Chủ shop nhập ở trang Nhân sự (thuần, có unit test).
 * Giới hạn khớp ràng buộc trong database (migration 0013).
 */
import type { OrgRole } from "@/lib/org/roles";

export const PASSWORD_MIN = 8;
const ROLES: OrgRole[] = ["owner", "manager", "staff"];

export interface MemberInput {
  displayName: string;
  email: string;
  password: string;
  role: OrgRole;
  department: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.normalize("NFC").trim() : "");

export function checkRole(v: FormDataEntryValue | null): OrgRole | null {
  const r = text(v);
  return (ROLES as string[]).includes(r) ? (r as OrgRole) : null;
}

/** Họ tên 1–80 ký tự; bộ phận để trống hoặc 1–60 ký tự. */
export function checkProfile(form: FormData): Checked<{ displayName: string; department: string | null; role: OrgRole }> {
  const displayName = text(form.get("displayName"));
  const department = text(form.get("department")) || null;
  const role = checkRole(form.get("role"));
  if (displayName.length < 1 || displayName.length > 80) return { ok: false, message: "Họ tên từ 1 đến 80 ký tự." };
  if (department && department.length > 60) return { ok: false, message: "Bộ phận tối đa 60 ký tự." };
  if (!role) return { ok: false, message: "Chọn vai trò." };
  return { ok: true, value: { displayName, department, role } };
}

export function checkPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Mật khẩu ít nhất ${PASSWORD_MIN} ký tự.`;
  if (password.length > 72) return "Mật khẩu tối đa 72 ký tự.";
  return null;
}

/** Thêm thành viên: họ tên, email, mật khẩu tạm, vai trò, bộ phận. */
export function checkNewMember(form: FormData): Checked<MemberInput> {
  const profile = checkProfile(form);
  if (!profile.ok) return profile;
  const email = text(form.get("email")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return { ok: false, message: "Email không đúng." };
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
  const bad = checkPassword(password);
  if (bad) return { ok: false, message: bad };
  return { ok: true, value: { ...profile.value, email, password } };
}

/** Đổi mật khẩu: mật khẩu mới hợp lệ, nhập lại khớp, khác mật khẩu cũ. */
export function checkPasswordChange(form: FormData): Checked<{ current: string; next: string }> {
  const get = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
  const current = get("current");
  const next = get("next");
  if (!current) return { ok: false, message: "Nhập mật khẩu hiện tại." };
  const bad = checkPassword(next);
  if (bad) return { ok: false, message: bad };
  if (next !== get("confirm")) return { ok: false, message: "Hai lần nhập mật khẩu mới không khớp." };
  if (next === current) return { ok: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại." };
  return { ok: true, value: { current, next } };
}

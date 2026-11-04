export type OrgRole = "owner" | "manager" | "staff";

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Chủ shop",
  manager: "Quản lý",
  staff: "Nhân viên",
};

/** Tên vai trò tiếng Việt; vai trò lạ (dữ liệu hỏng) thì hiện "Thành viên". */
export function roleLabel(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as OrgRole] : "Thành viên";
}

/** Hai chữ cái đầu làm logo tạm khi shop chưa có logo: "Ecobath" → "EC", "Gốm Bát Tràng" → "GB". */
export function shopInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1 ? Array.from(words[0]).slice(0, 2) : [Array.from(words[0])[0], Array.from(words[1])[0]];
  return letters.join("").toLocaleUpperCase("vi");
}

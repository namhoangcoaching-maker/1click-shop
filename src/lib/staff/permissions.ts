import type { OrgRole } from "@/lib/org/roles";

/**
 * Ai được quản lý / cấu hình ai (khớp RLS migration 0014 – can_manage_member):
 * Chủ shop: mọi người. Quản lý: chỉ người vai trò Nhân viên. Nhân viên: không ai.
 */
export function canManage(actor: OrgRole, target: OrgRole): boolean {
  if (actor === "owner") return true;
  return actor === "manager" && target === "staff";
}

/** Vai trò người thao tác được phép gán khi thêm / sửa. */
export function assignableRoles(actor: OrgRole): OrgRole[] {
  if (actor === "owner") return ["staff", "manager", "owner"];
  return actor === "manager" ? ["staff"] : [];
}

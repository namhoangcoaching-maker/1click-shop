import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/org/roles";

export interface Member {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: OrgRole;
  department: string | null;
  disabledAt: string | null;
  createdAt: string;
  /** Lần đăng nhập gần nhất (để biết nhân viên đã vào dùng chưa). */
  lastSignInAt: string | null;
}

const ROLE_ORDER: Record<OrgRole, number> = { owner: 0, manager: 1, staff: 2 };

/**
 * Thành viên của shop. Danh sách đọc qua RLS (Chủ/Quản lý mới thấy cả shop – migration 0013);
 * email và lần đăng nhập lấy bằng khóa secret CHỈ cho đúng những người RLS đã trả về.
 * Người gọi phải dùng getManagerOrg() trước (Nhân viên không vào được trang này).
 */
export async function getMembers(orgId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, display_name, department, disabled_at, created_at")
    .eq("org_id", orgId);
  if (error) throw new Error(`Không đọc được danh sách nhân viên: ${error.message}`);

  const admin = createAdminClient();
  const users = await Promise.all(
    (data ?? []).map((m) => admin.auth.admin.getUserById(m.user_id as string).then((r) => r.data.user)),
  );
  return (data ?? [])
    .map((m, i) => ({
      userId: m.user_id as string,
      email: users[i]?.email ?? null,
      displayName: (m.display_name as string | null) ?? null,
      role: m.role as OrgRole,
      department: (m.department as string | null) ?? null,
      disabledAt: (m.disabled_at as string | null) ?? null,
      createdAt: m.created_at as string,
      lastSignInAt: users[i]?.last_sign_in_at ?? null,
    }))
    .sort(
      (a, b) =>
        Number(a.disabledAt !== null) - Number(b.disabledAt !== null) ||
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "", "vi"),
    );
}

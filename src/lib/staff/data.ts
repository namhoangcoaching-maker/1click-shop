import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/org/roles";
import { fromRow, type StaffSettings } from "./settings";

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
  /** null = người đang xem không được xem cấu hình của người này (Quản lý xem Chủ/Quản lý khác). */
  settings: StaffSettings | null;
}

export interface WorkLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

const ROLE_ORDER: Record<OrgRole, number> = { owner: 0, manager: 1, staff: 2 };
const SETTINGS_COLUMNS =
  "user_id, attendance_mode, location_id, work_days, shift_start, shift_end, late_grace_min, pay_type, base_salary, standard_days, allowance, late_penalty";

/**
 * Thành viên của shop kèm cấu hình. Danh sách và cấu hình đọc qua RLS (Chủ/Quản lý thấy cả shop;
 * cấu hình lương chỉ thấy người mình quản lý – migration 0014). Email và lần đăng nhập lấy bằng khóa secret
 * CHỈ cho đúng những người RLS đã trả về. Người gọi phải dùng getManagerOrg() trước.
 */
export async function getMembers(orgId: string): Promise<Member[]> {
  const supabase = await createClient();
  const [members, settings] = await Promise.all([
    supabase.from("memberships").select("user_id, role, display_name, department, disabled_at, created_at").eq("org_id", orgId),
    supabase.from("staff_settings").select(SETTINGS_COLUMNS).eq("org_id", orgId),
  ]);
  if (members.error) throw new Error(`Không đọc được danh sách nhân sự: ${members.error.message}`);
  const settingsBy = new Map((settings.data ?? []).map((r) => [r.user_id as string, r]));

  const admin = createAdminClient();
  const users = await Promise.all(
    (members.data ?? []).map((m) => admin.auth.admin.getUserById(m.user_id as string).then((r) => r.data.user)),
  );
  return (members.data ?? [])
    .map((m, i) => {
      const role = m.role as OrgRole;
      const row = settingsBy.get(m.user_id as string);
      return {
        userId: m.user_id as string,
        email: users[i]?.email ?? null,
        displayName: (m.display_name as string | null) ?? null,
        role,
        department: (m.department as string | null) ?? null,
        disabledAt: (m.disabled_at as string | null) ?? null,
        createdAt: m.created_at as string,
        lastSignInAt: users[i]?.last_sign_in_at ?? null,
        // Có dòng → cấu hình thật; không có dòng mà được phép xem (RLS trả rỗng cả 2 trường hợp) → hiểu là chưa cấu hình.
        settings: row ? fromRow(row) : null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.disabledAt !== null) - Number(b.disabledAt !== null) ||
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "", "vi"),
    );
}

export async function getLocations(orgId: string): Promise<WorkLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_locations")
    .select("id, name, lat, lng, radius_m")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw new Error(`Không đọc được địa điểm chấm công: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, radiusM: r.radius_m }));
}

/** Cấu hình của chính người đang đăng nhập (mọi vai trò; RLS cho xem dòng của mình). */
export async function getMySettings(orgId: string, userId: string): Promise<StaffSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_settings").select(SETTINGS_COLUMNS).eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return data ? fromRow(data) : null;
}

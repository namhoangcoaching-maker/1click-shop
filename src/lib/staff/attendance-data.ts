import "server-only";
import type { DateString } from "@/lib/date-range";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_COLUMNS, rowFromDb, type AttendanceRow } from "./attendance";

/**
 * Chấm công trong khoảng ngày, đọc qua RLS: Nhân viên chỉ ra dòng của mình; Quản lý ra của mình + Nhân viên;
 * Chủ ra cả shop (migration 0015). `userId` để lọc riêng một người.
 */
export async function getAttendance(orgId: string, from: DateString, to: DateString, userId?: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select(ATTENDANCE_COLUMNS)
    .eq("org_id", orgId)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(`Không đọc được chấm công: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Tháng ("YYYY-MM") đã được Chủ mở khóa sổ chưa. */
export async function isMonthUnlocked(orgId: string, month: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("attendance_unlocks").select("month").eq("org_id", orgId).eq("month", `${month}-01`).maybeSingle();
  return !!data;
}

/** Mã người đang đăng nhập. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

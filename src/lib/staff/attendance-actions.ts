"use server";

import { refresh } from "next/cache";
import { todayInVN } from "@/lib/date-range";
import { getCurrentOrg } from "@/lib/org/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkPosition, monthEditable, validPosition, vnTimeOf, vnToIso, type Position } from "./attendance";
import { getMySettings } from "./data";

export interface ClockState {
  ok?: boolean;
  message?: string;
}

/**
 * Vào ca / Ra ca của chính người đang đăng nhập.
 * Giờ = đồng hồ MÁY CHỦ (không tin giờ điện thoại). Chấm GPS: máy chủ tự tính khoảng cách tới địa điểm.
 * Kiểm tra xong mới ghi bằng khóa secret (Nhân viên không có quyền ghi bảng chấm công qua trình duyệt).
 */
export async function clock(kind: "in" | "out", pos: Partial<Position> | null): Promise<ClockState> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, message: "Tài khoản chưa được gắn vào shop (hoặc đã bị khóa)." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) return { ok: false, message: "Phiên đăng nhập hết hạn, đăng nhập lại." };

  const settings = await getMySettings(org.id, me);
  if (!settings) return { ok: false, message: "Chủ shop / Quản lý chưa cấu hình chấm công cho bạn." };

  let place: { lat: number; lng: number; accuracy: number; distance: number } | null = null;
  if (settings.attendanceMode === "gps") {
    if (!settings.locationId) return { ok: false, message: "Chưa chọn địa điểm chấm công cho bạn, báo Quản lý." };
    const { data: loc } = await supabase
      .from("work_locations")
      .select("name, lat, lng, radius_m")
      .eq("id", settings.locationId)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!loc) return { ok: false, message: "Không tìm thấy địa điểm chấm công, báo Quản lý." };
    if (!pos || !validPosition(pos)) return { ok: false, message: "Chưa lấy được vị trí. Cho phép trình duyệt dùng vị trí rồi thử lại." };
    const check = checkPosition({ name: loc.name, lat: loc.lat, lng: loc.lng, radiusM: loc.radius_m }, pos);
    if (!check.ok) return { ok: false, message: check.message };
    place = { lat: pos.lat, lng: pos.lng, accuracy: Math.round(pos.accuracy), distance: check.distance };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = todayInVN(now);
  const admin = createAdminClient();
  const key = { org_id: org.id, user_id: me, work_date: today };
  const { data: existing, error: readErr } = await admin
    .from("attendance")
    .select("check_in_at, check_out_at")
    .match(key)
    .maybeSingle();
  if (readErr) return { ok: false, message: "Không đọc được chấm công, thử lại." };

  if (kind === "in") {
    if (existing?.check_in_at) return { ok: false, message: `Hôm nay bạn đã vào ca lúc ${vnTimeOf(existing.check_in_at)}.` };
    const values = {
      check_in_at: nowIso,
      in_lat: place?.lat ?? null,
      in_lng: place?.lng ?? null,
      in_accuracy_m: place?.accuracy ?? null,
      in_distance_m: place?.distance ?? null,
      attendance_mode: settings.attendanceMode,
      shift_start: settings.shiftStart,
      shift_end: settings.shiftEnd,
      late_grace_min: settings.lateGraceMin,
    };
    // Dòng trống do Quản lý tạo trước (ví dụ ghi vắng) thì điền giờ vào; chưa có thì thêm mới.
    const { error } = existing
      ? await admin.from("attendance").update(values).match(key)
      : await admin.from("attendance").insert({ ...key, ...values });
    if (error) return { ok: false, message: "Không ghi được giờ vào ca, thử lại." };
    refresh();
    return { ok: true, message: `Đã vào ca lúc ${vnTimeOf(nowIso)}.` };
  }

  if (!existing?.check_in_at) return { ok: false, message: "Hôm nay bạn chưa vào ca." };
  const { error } = await admin
    .from("attendance")
    .update({
      check_out_at: nowIso,
      out_lat: place?.lat ?? null,
      out_lng: place?.lng ?? null,
      out_accuracy_m: place?.accuracy ?? null,
      out_distance_m: place?.distance ?? null,
    })
    .match(key);
  if (error) return { ok: false, message: "Không ghi được giờ ra ca, thử lại." };
  refresh();
  return { ok: true, message: `Đã ra ca lúc ${vnTimeOf(nowIso)}.` };
}

export interface EditState {
  ok?: boolean;
  message?: string;
}

/**
 * Chủ / Quản lý sửa một ô bảng công (quên chấm, chấm sai…), bắt buộc ghi lý do.
 * Ghi qua RLS bằng phiên người sửa: database chặn người không được quản lý và tháng đã khóa sổ.
 * Để trống cả giờ vào và giờ ra = ghi nhận không đi làm (giữ lý do để tra lại).
 */
export async function editAttendance(_prev: EditState, form: FormData): Promise<EditState> {
  const org = await getCurrentOrg();
  if (!org || org.role === "staff") return { ok: false, message: "Chỉ Chủ shop hoặc Quản lý mới sửa bảng công." };
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");
  const userId = str("userId");
  const date = str("date");
  const inTime = str("in");
  const outTime = str("out");
  const note = str("note");
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Thiếu người hoặc ngày." };
  if (note.length < 2 || note.length > 200) return { ok: false, message: "Ghi lý do sửa (2–200 ký tự)." };
  if (!inTime && outTime) return { ok: false, message: "Có giờ ra thì phải có giờ vào." };
  const checkIn = inTime ? vnToIso(date, inTime) : null;
  const checkOut = outTime ? vnToIso(date, outTime) : null;
  if ((inTime && !checkIn) || (outTime && !checkOut)) return { ok: false, message: "Giờ dạng HH:MM, ví dụ 08:05." };
  if (checkIn && checkOut && checkOut < checkIn) return { ok: false, message: "Giờ ra phải sau giờ vào." };

  const supabase = await createClient();
  const [{ data: unlock }, { data: existing }, { data: s }] = await Promise.all([
    supabase.from("attendance_unlocks").select("month").eq("org_id", org.id).eq("month", `${date.slice(0, 7)}-01`).maybeSingle(),
    supabase.from("attendance").select("work_date").eq("org_id", org.id).eq("user_id", userId).eq("work_date", date).maybeSingle(),
    supabase.from("staff_settings").select("shift_start, shift_end, late_grace_min").eq("org_id", org.id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!monthEditable(date, todayInVN(), !!unlock)) {
    return { ok: false, message: "Tháng này đã khóa sổ (quá mùng 5 tháng sau). Chủ shop mở khóa sổ để sửa." };
  }
  const values = { check_in_at: checkIn, check_out_at: checkOut, edit_note: note };
  let error;
  if (existing) {
    ({ error } = await supabase.from("attendance").update(values).eq("org_id", org.id).eq("user_id", userId).eq("work_date", date));
  } else {
    if (!s) return { ok: false, message: "Người này chưa được cấu hình ca làm (hoặc bạn không được sửa công của họ)." };
    ({ error } = await supabase.from("attendance").insert({
      org_id: org.id,
      user_id: userId,
      work_date: date,
      attendance_mode: "manual",
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      late_grace_min: s.late_grace_min,
      ...values,
    }));
  }
  if (error) return { ok: false, message: "Không lưu được (có thể bạn không được sửa công người này, hoặc tháng đã khóa sổ)." };
  refresh();
  return { ok: true, message: "Đã lưu." };
}

/** Chủ shop mở khóa / khóa lại sổ chấm công một tháng. */
export async function setMonthLock(_prev: EditState, form: FormData): Promise<EditState> {
  const org = await getCurrentOrg();
  if (!org || org.role !== "owner") return { ok: false, message: "Chỉ Chủ shop mở / khóa sổ." };
  const month = String(form.get("month") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, message: "Tháng không hợp lệ." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } =
    form.get("action") === "unlock"
      ? await supabase.from("attendance_unlocks").insert({ org_id: org.id, month: `${month}-01`, unlocked_by: claims?.claims?.sub })
      : await supabase.from("attendance_unlocks").delete().eq("org_id", org.id).eq("month", `${month}-01`);
  if (error && !error.message.includes("duplicate")) return { ok: false, message: "Không lưu được, thử lại." };
  refresh();
  return { ok: true, message: form.get("action") === "unlock" ? "Đã mở khóa sổ." : "Đã khóa sổ lại." };
}

-- =============================================================================
-- 0015 – Giai đoạn 6.3: chấm công (chủ dự án duyệt 05/11/2026).
--  • attendance: mỗi người mỗi ngày một dòng: giờ vào/ra (giờ MÁY CHỦ), vị trí GPS lúc chấm,
--    ca làm chụp lại lúc chấm (đổi cấu hình sau không làm sai lịch sử), lý do sửa.
--  • Nhân viên KHÔNG ghi trực tiếp: nút Vào ca / Ra ca chạy trên máy chủ (kiểm tra vị trí, lấy giờ máy chủ)
--    rồi ghi bằng khóa secret. Qua trình duyệt chỉ ĐỌC được dòng của mình.
--  • Chủ / Quản lý sửa bảng công người mình quản lý (can_manage_member, 0014) – tháng N chỉ sửa được tới
--    hết mùng 5 tháng N+1 (giờ VN), trừ khi Chủ mở khóa sổ tháng đó (attendance_unlocks).
--  • Công, đi muộn do code tính (src/lib/staff/attendance.ts, có unit test).
-- =============================================================================

create table public.attendance (
  org_id uuid not null,
  user_id uuid not null,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  -- Vị trí lúc chấm (chỉ khi chấm GPS): tọa độ, độ chính xác điện thoại báo (m), khoảng cách tới địa điểm (m)
  in_lat double precision,
  in_lng double precision,
  in_accuracy_m real,
  in_distance_m real,
  out_lat double precision,
  out_lng double precision,
  out_accuracy_m real,
  out_distance_m real,
  attendance_mode text not null check (attendance_mode in ('online', 'gps', 'manual')),
  -- Ca làm chụp lại lúc chấm
  shift_start text not null check (shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  shift_end text not null check (shift_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  late_grace_min smallint not null check (late_grace_min between 0 and 240),
  -- Sửa tay (Chủ / Quản lý)
  edit_note text check (edit_note is null or length(btrim(edit_note)) between 1 and 200),
  edited_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, work_date),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade,
  check (shift_end > shift_start),
  check (check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at))
);
create index attendance_org_date_idx on public.attendance (org_id, work_date);
comment on table public.attendance is 'Chấm công: mỗi người mỗi ngày một dòng (giờ vào/ra theo giờ máy chủ, vị trí GPS, ca làm lúc chấm).';

-- Chủ mở khóa sổ một tháng đã khóa (xóa dòng = khóa lại).
create table public.attendance_unlocks (
  org_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  unlocked_by uuid references auth.users (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (org_id, month)
);
comment on table public.attendance_unlocks is 'Tháng chấm công Chủ shop đã mở khóa để sửa muộn (sau mùng 5 tháng sau).';

alter table public.attendance_unlocks enable row level security;
revoke all on public.attendance_unlocks from anon;
create policy "Chủ, Quản lý xem tháng mở khóa"
  on public.attendance_unlocks for select to authenticated using (public.has_org_role(org_id, '{owner,manager}'));
create policy "Chủ mở khóa sổ"
  on public.attendance_unlocks for insert to authenticated with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ khóa lại sổ"
  on public.attendance_unlocks for delete to authenticated using (public.has_org_role(org_id, '{owner}'));

-- Ngày p_date của shop còn sửa được không: không phải ngày tương lai, và (chưa quá mùng 5 tháng sau, hoặc Chủ đã mở khóa).
create function public.attendance_day_open(p_org_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as today)
  select p_date <= t.today
     and (
       t.today <= (date_trunc('month', p_date) + interval '1 month' + interval '4 days')::date
       or exists (
         select 1 from public.attendance_unlocks u
         where u.org_id = p_org_id and u.month = date_trunc('month', p_date)::date
       )
     )
  from t;
$$;
revoke execute on function public.attendance_day_open(uuid, date) from public, anon;
grant execute on function public.attendance_day_open(uuid, date) to authenticated;

alter table public.attendance enable row level security;
revoke all on public.attendance from anon;
create policy "Xem chấm công: của mình, hoặc người mình quản lý"
  on public.attendance for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_org_member(org_id))
    or public.can_manage_member(org_id, user_id)
  );
create policy "Sửa bảng công người mình quản lý (thêm)"
  on public.attendance for insert to authenticated
  with check (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date));
create policy "Sửa bảng công người mình quản lý (sửa)"
  on public.attendance for update to authenticated
  using (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  with check (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date));
create policy "Sửa bảng công người mình quản lý (xóa)"
  on public.attendance for delete to authenticated
  using (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date));

-- Sửa tay qua trình duyệt: không được đổi tọa độ GPS (chỉ máy chủ ghi), phải ghi lý do; người sửa = người đăng nhập.
create function public.attendance_manual_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Máy chủ ghi bằng khóa secret (auth.uid() null) → không áp quy tắc sửa tay.
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.edit_note is null then
    raise exception 'Sửa bảng công phải ghi lý do.' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    new.in_lat := null; new.in_lng := null; new.in_accuracy_m := null; new.in_distance_m := null;
    new.out_lat := null; new.out_lng := null; new.out_accuracy_m := null; new.out_distance_m := null;
    new.attendance_mode := 'manual';
  else
    new.in_lat := old.in_lat; new.in_lng := old.in_lng; new.in_accuracy_m := old.in_accuracy_m; new.in_distance_m := old.in_distance_m;
    new.out_lat := old.out_lat; new.out_lng := old.out_lng; new.out_accuracy_m := old.out_accuracy_m; new.out_distance_m := old.out_distance_m;
    new.org_id := old.org_id; new.user_id := old.user_id; new.work_date := old.work_date;
    new.created_at := old.created_at;
  end if;
  new.edited_by := (select auth.uid());
  new.edited_at := now();
  return new;
end;
$$;
create trigger attendance_manual_edit
before insert or update on public.attendance
for each row execute function public.attendance_manual_edit();

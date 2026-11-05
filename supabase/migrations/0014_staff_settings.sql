-- =============================================================================
-- 0014 – Giai đoạn 6.2: cấu hình nhân sự (chủ dự án duyệt 05/11/2026).
--  • work_locations: địa điểm chấm công GPS của shop (tọa độ + bán kính).
--  • staff_settings: cấu hình riêng từng người: hình thức chấm công (online tại nhà / GPS tại shop),
--    ca làm cố định trong tuần, lương cứng (theo tháng-ngày công / theo ngày / theo giờ), phụ cấp, phạt đi muộn.
--  • Quyền:
--      Chủ shop: thêm, sửa, cấu hình MỌI thành viên.
--      Quản lý: thêm, sửa, cấu hình, khóa người vai trò NHÂN VIÊN; không đụng tới Chủ/Quản lý khác,
--               không xem cấu hình lương của Chủ/Quản lý khác (chỉ của mình).
--      Nhân viên: chỉ xem cấu hình của chính mình, không sửa.
-- =============================================================================

-- Người đang đăng nhập được quản lý (cấu hình, xem lương) thành viên p_user_id của shop p_org_id không.
create function public.can_manage_member(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(p_org_id, '{owner}')
      or (
        public.has_org_role(p_org_id, '{manager}')
        and exists (
          select 1 from public.memberships m
          where m.org_id = p_org_id and m.user_id = p_user_id and m.role = 'staff'
        )
      );
$$;
revoke execute on function public.can_manage_member(uuid, uuid) from public, anon;
grant execute on function public.can_manage_member(uuid, uuid) to authenticated;

-- Quản lý thêm / sửa / khóa người vai trò Nhân viên (không nâng quyền được: dòng sau khi sửa vẫn phải là staff).
create policy "Quản lý thêm nhân viên"
  on public.memberships for insert to authenticated
  with check (public.has_org_role(org_id, '{manager}') and role = 'staff');
create policy "Quản lý sửa nhân viên"
  on public.memberships for update to authenticated
  using (public.has_org_role(org_id, '{manager}') and role = 'staff')
  with check (public.has_org_role(org_id, '{manager}') and role = 'staff');

-- ---------------------------------------------------------------------------
create table public.work_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 100 check (radius_m between 20 and 2000),
  created_at timestamptz not null default now()
);
create index work_locations_org_idx on public.work_locations (org_id);
comment on table public.work_locations is 'Địa điểm chấm công GPS của shop (shop, kho…): tọa độ + bán kính cho phép.';

alter table public.work_locations enable row level security;
revoke all on public.work_locations from anon;
create policy "Thành viên xem địa điểm chấm công"
  on public.work_locations for select to authenticated using (public.is_org_member(org_id));
create policy "Chủ, Quản lý thêm địa điểm"
  on public.work_locations for insert to authenticated with check (public.has_org_role(org_id, '{owner,manager}'));
create policy "Chủ, Quản lý sửa địa điểm"
  on public.work_locations for update to authenticated
  using (public.has_org_role(org_id, '{owner,manager}')) with check (public.has_org_role(org_id, '{owner,manager}'));
create policy "Chủ, Quản lý xóa địa điểm"
  on public.work_locations for delete to authenticated using (public.has_org_role(org_id, '{owner,manager}'));

-- ---------------------------------------------------------------------------
create table public.staff_settings (
  org_id uuid not null,
  user_id uuid not null,
  -- Chấm công
  attendance_mode text not null default 'gps' check (attendance_mode in ('online', 'gps')),
  location_id uuid references public.work_locations (id) on delete set null,
  -- Ca làm cố định: ngày trong tuần (1 = Thứ 2 … 7 = Chủ nhật), giờ vào/ra "HH:MM", số phút cho phép trễ
  work_days smallint[] not null default '{1,2,3,4,5,6}'
    check (work_days <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(work_days) between 1 and 7),
  shift_start text not null default '08:00' check (shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  shift_end text not null default '17:30' check (shift_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  late_grace_min smallint not null default 10 check (late_grace_min between 0 and 240),
  -- Lương cứng (đồng): monthly = lương tháng ÷ ngày công chuẩn × ngày công; daily = đơn giá/ngày; hourly = đơn giá/giờ
  pay_type text not null default 'monthly' check (pay_type in ('monthly', 'daily', 'hourly')),
  base_salary bigint not null default 0 check (base_salary between 0 and 10000000000),
  standard_days numeric(4, 1) not null default 26 check (standard_days between 1 and 31),
  allowance bigint not null default 0 check (allowance between 0 and 1000000000),
  late_penalty bigint not null default 0 check (late_penalty between 0 and 100000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (org_id, user_id),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade,
  check (shift_end > shift_start)
);
comment on table public.staff_settings is 'Cấu hình nhân sự từng người: chấm công, ca làm, lương cứng, phụ cấp, phạt đi muộn.';

alter table public.staff_settings enable row level security;
revoke all on public.staff_settings from anon;
create policy "Xem cấu hình: của mình, hoặc người mình quản lý"
  on public.staff_settings for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_org_member(org_id))
    or public.can_manage_member(org_id, user_id)
  );
create policy "Cấu hình người mình quản lý (thêm)"
  on public.staff_settings for insert to authenticated
  with check (public.can_manage_member(org_id, user_id));
create policy "Cấu hình người mình quản lý (sửa)"
  on public.staff_settings for update to authenticated
  using (public.can_manage_member(org_id, user_id))
  with check (public.can_manage_member(org_id, user_id));

-- Địa điểm GPS phải thuộc cùng shop.
create function public.staff_settings_check_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.work_locations l where l.id = new.location_id and l.org_id = new.org_id
  ) then
    raise exception 'Địa điểm chấm công không thuộc shop này.' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger staff_settings_check_location
before insert or update on public.staff_settings
for each row execute function public.staff_settings_check_location();

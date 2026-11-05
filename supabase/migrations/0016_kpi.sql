-- =============================================================================
-- 0016 – Giai đoạn 6.6: KPI dạng cấu hình (chủ dự án duyệt 05/11/2026).
--  • kpi_templates: thư viện mẫu KPI của shop – 5 kiểu: % doanh thu, theo số lượng, bậc thang theo % chỉ tiêu,
--    theo tỷ lệ hoàn thành, trừ phạt. Nguồn kết quả: nhập tay / doanh thu cả shop / doanh thu một số kênh /
--    doanh thu đơn gán đúng nhân viên trên Pancake. CHỈ Chủ shop tạo, sửa.
--  • kpi_assignments: gắn mẫu cho một người hoặc cả một bộ phận, kèm chỉ tiêu tháng.
--      Gắn cho người: Chủ (mọi người), Quản lý (chỉ Nhân viên) – can_manage_member.
--      Gắn cho bộ phận: chỉ Chủ (bộ phận có thể gồm Quản lý).
--  • kpi_results: kết quả nhập tay theo tháng; ai được quản lý người đó thì nhập; khóa sổ như chấm công.
--  • staff_settings.pancake_seller_id: tài khoản nhân viên trên Pancake của người này (KPI doanh thu đơn gán).
--  • Tiền thưởng/phạt KPI do code tính (src/lib/staff/kpi.ts, có unit test).
-- =============================================================================

alter table public.staff_settings
  add column pancake_seller_id text check (pancake_seller_id is null or length(pancake_seller_id) between 1 and 64);
comment on column public.staff_settings.pancake_seller_id is 'Mã nhân viên trên Pancake (assigning_seller_id) để tính KPI doanh thu đơn gán cho người này.';

-- Bộ phận của người đang đăng nhập trong shop (để Nhân viên xem KPI gắn cho bộ phận mình).
create function public.my_department(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.department from public.memberships m
  where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.disabled_at is null;
$$;
revoke execute on function public.my_department(uuid) from public, anon;
grant execute on function public.my_department(uuid) to authenticated;

-- ---------------------------------------------------------------------------
create table public.kpi_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('percent', 'per_unit', 'tiers', 'completion', 'penalty')),
  source text not null check (source in ('manual', 'shop_revenue', 'channel_revenue', 'seller_revenue')),
  -- Mã nguồn đơn Pancake (khi source = channel_revenue)
  channels text[] not null default '{}' check (cardinality(channels) <= 30),
  -- Đơn vị khi nhập tay: "video", "đơn"…
  unit_label text check (unit_label is null or length(btrim(unit_label)) between 1 and 30),
  -- percent: % doanh thu (1,5 = 1,5%); per_unit / penalty: đồng mỗi đơn vị; completion: mức thưởng khi đạt 100%
  rate numeric(16, 4) not null default 0 check (rate >= 0 and rate <= 10000000000),
  -- tiers: [{"pct": 80, "amount": 500000}, …] – đạt từ pct% chỉ tiêu thì thưởng amount
  tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(tiers) = 'array' and jsonb_array_length(tiers) <= 10),
  -- Trần thưởng mỗi tháng (đồng), null = không giới hạn
  cap bigint check (cap is null or cap between 0 and 10000000000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind not in ('per_unit', 'penalty') or source = 'manual'),
  check (source <> 'channel_revenue' or cardinality(channels) > 0),
  unique (org_id, id)
);
create index kpi_templates_org_idx on public.kpi_templates (org_id);
comment on table public.kpi_templates is 'Mẫu KPI của shop (công thức + nguồn kết quả). Chỉ Chủ shop tạo, sửa.';

alter table public.kpi_templates enable row level security;
revoke all on public.kpi_templates from anon;
create policy "Thành viên xem mẫu KPI"
  on public.kpi_templates for select to authenticated using (public.is_org_member(org_id));
create policy "Chủ tạo mẫu KPI"
  on public.kpi_templates for insert to authenticated with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ sửa mẫu KPI"
  on public.kpi_templates for update to authenticated
  using (public.has_org_role(org_id, '{owner}')) with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ xóa mẫu KPI"
  on public.kpi_templates for delete to authenticated using (public.has_org_role(org_id, '{owner}'));

-- ---------------------------------------------------------------------------
create table public.kpi_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  template_id uuid not null,
  user_id uuid,
  department text check (department is null or length(btrim(department)) between 1 and 60),
  -- Chỉ tiêu tháng: đồng (KPI doanh thu) hoặc số lượng (nhập tay). Bắt buộc với bậc thang / tỷ lệ hoàn thành.
  target numeric(16, 2) check (target is null or (target > 0 and target <= 100000000000)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (org_id, template_id) references public.kpi_templates (org_id, id) on delete cascade,
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade,
  check ((user_id is null) <> (department is null))
);
create unique index kpi_assignments_user_uq on public.kpi_assignments (template_id, user_id) where user_id is not null;
create unique index kpi_assignments_dept_uq on public.kpi_assignments (template_id, department) where department is not null;
create index kpi_assignments_org_idx on public.kpi_assignments (org_id);
comment on table public.kpi_assignments is 'KPI gắn cho một người hoặc một bộ phận, kèm chỉ tiêu tháng.';

alter table public.kpi_assignments enable row level security;
revoke all on public.kpi_assignments from anon;
create policy "Xem KPI được gắn: Chủ/Quản lý cả shop, Nhân viên của mình và bộ phận mình"
  on public.kpi_assignments for select to authenticated
  using (
    public.has_org_role(org_id, '{owner,manager}')
    or (public.is_org_member(org_id) and (user_id = (select auth.uid()) or department = public.my_department(org_id)))
  );
create policy "Gắn KPI (thêm)"
  on public.kpi_assignments for insert to authenticated
  with check (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );
create policy "Gắn KPI (sửa)"
  on public.kpi_assignments for update to authenticated
  using (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  )
  with check (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );
create policy "Gắn KPI (xóa)"
  on public.kpi_assignments for delete to authenticated
  using (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );

-- ---------------------------------------------------------------------------
create table public.kpi_results (
  org_id uuid not null,
  assignment_id uuid not null references public.kpi_assignments (id) on delete cascade,
  user_id uuid not null,
  month date not null check (extract(day from month) = 1),
  actual numeric(16, 2) not null check (actual >= 0 and actual <= 100000000000),
  note text check (note is null or length(btrim(note)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, user_id, month),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
create index kpi_results_org_month_idx on public.kpi_results (org_id, month);
comment on table public.kpi_results is 'Kết quả KPI nhập tay theo tháng (số video, số đơn đóng gói, số lỗi…).';

alter table public.kpi_results enable row level security;
revoke all on public.kpi_results from anon;
create policy "Xem kết quả KPI: của mình, hoặc người mình quản lý"
  on public.kpi_results for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Nhập kết quả KPI (thêm)"
  on public.kpi_results for insert to authenticated
  with check (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, month));
create policy "Nhập kết quả KPI (sửa)"
  on public.kpi_results for update to authenticated
  using (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, month))
  with check (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, month));
create policy "Nhập kết quả KPI (xóa)"
  on public.kpi_results for delete to authenticated
  using (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, month));

-- Kết quả phải thuộc KPI cùng shop, đúng người (gắn cho người đó hoặc bộ phận của người đó); ghi người nhập.
create function public.kpi_results_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.kpi_assignments;
begin
  select * into a from public.kpi_assignments where id = new.assignment_id;
  if a.id is null or a.org_id <> new.org_id then
    raise exception 'KPI không thuộc shop này.' using errcode = 'check_violation';
  end if;
  if not (
    a.user_id = new.user_id
    or exists (select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.user_id and m.department = a.department)
  ) then
    raise exception 'KPI này không gắn cho người này.' using errcode = 'check_violation';
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
create trigger kpi_results_check
before insert or update on public.kpi_results
for each row execute function public.kpi_results_check();

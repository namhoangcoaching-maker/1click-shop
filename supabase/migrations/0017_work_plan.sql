-- =============================================================================
-- 0017 – Giai đoạn 6.5: kế hoạch hôm nay + báo cáo cuối ngày (chủ dự án duyệt 05/11/2026).
--  • tasks: việc giao / tự thêm cho một ngày; chưa xong thì TỰ HIỆN LẠI các ngày sau ("trễ từ ngày …")
--    – không sao chép dòng, app lọc theo due_date ≤ ngày xem và chưa xong / xong đúng ngày đó.
--  • recurring_tasks + recurring_done: việc lặp lại hằng ngày theo thứ trong tuần (gắn người hoặc bộ phận),
--    tích xong theo từng ngày, KHÔNG dồn sang ngày sau.
--  • work_reports: báo cáo cuối ngày (kết quả, vướng mắc, kế hoạch mai) + nhận xét của Quản lý.
--  • kpi_daily: số KPI nhập tay theo ngày trong báo cáo; kết quả KPI tháng = tổng các ngày, trừ khi
--    Quản lý nhập số tháng ở kpi_results (số Quản lý nhập thắng).
--  • Nhân viên tự ghi qua trình duyệt nhưng chỉ cho NGÀY HÔM NAY (giờ VN, theo đồng hồ database).
--    Quản lý / Chủ ghi cho người mình quản lý (can_manage_member).
-- =============================================================================

create function public.vn_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  due_date date not null,
  created_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
create index tasks_org_user_idx on public.tasks (org_id, user_id, due_date);
comment on table public.tasks is 'Việc giao / tự thêm theo ngày; chưa xong thì hiện lại các ngày sau.';

alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
create policy "Xem việc: của mình, hoặc người mình quản lý"
  on public.tasks for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Giao việc / tự thêm việc"
  on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.can_manage_member(org_id, user_id)
      or (user_id = (select auth.uid()) and public.is_org_member(org_id) and due_date >= public.vn_today())
    )
  );
create policy "Sửa việc: người làm (tích xong), người quản lý"
  on public.tasks for update to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id))
  with check ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Xóa việc: người quản lý, hoặc việc mình tự thêm"
  on public.tasks for delete to authenticated
  using (public.can_manage_member(org_id, user_id) or (user_id = (select auth.uid()) and created_by = (select auth.uid())));

-- Người làm (không phải người quản lý) chỉ được tích / bỏ tích xong việc được giao; việc tự thêm thì sửa được tên.
-- Giờ xong = giờ database.
create function public.tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is not null and not public.can_manage_member(new.org_id, new.user_id) then
    if new.org_id <> old.org_id or new.user_id <> old.user_id or new.due_date <> old.due_date
       or new.created_by is distinct from old.created_by
       or (new.title <> old.title and old.created_by is distinct from me) then
      raise exception 'Chỉ được tích xong việc được giao.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.done_at is not null and old.done_at is null then
    new.done_at := now();
  elsif new.done_at is not null then
    new.done_at := old.done_at;
  end if;
  return new;
end;
$$;
create trigger tasks_guard before update on public.tasks for each row execute function public.tasks_guard();

-- ---------------------------------------------------------------------------
create table public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  user_id uuid,
  department text check (department is null or length(btrim(department)) between 1 and 60),
  -- 1 = Thứ 2 … 7 = Chủ nhật
  work_days smallint[] not null default '{1,2,3,4,5,6}'
    check (work_days <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(work_days) between 1 and 7),
  start_date date not null default public.vn_today(),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade,
  check ((user_id is null) <> (department is null))
);
create index recurring_tasks_org_idx on public.recurring_tasks (org_id);
comment on table public.recurring_tasks is 'Việc lặp lại theo thứ trong tuần, gắn cho người hoặc bộ phận.';

alter table public.recurring_tasks enable row level security;
revoke all on public.recurring_tasks from anon;
create policy "Xem việc lặp lại: Chủ/Quản lý cả shop, Nhân viên của mình và bộ phận mình"
  on public.recurring_tasks for select to authenticated
  using (
    public.has_org_role(org_id, '{owner,manager}')
    or (public.is_org_member(org_id) and (user_id = (select auth.uid()) or department = public.my_department(org_id)))
  );
create policy "Tạo việc lặp lại"
  on public.recurring_tasks for insert to authenticated
  with check (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );
create policy "Sửa việc lặp lại"
  on public.recurring_tasks for update to authenticated
  using (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  )
  with check (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );
create policy "Xóa việc lặp lại"
  on public.recurring_tasks for delete to authenticated
  using (
    (user_id is not null and public.can_manage_member(org_id, user_id))
    or (department is not null and public.has_org_role(org_id, '{owner}'))
  );

create table public.recurring_done (
  org_id uuid not null,
  recurring_id uuid not null references public.recurring_tasks (id) on delete cascade,
  user_id uuid not null,
  work_date date not null,
  done_at timestamptz not null default now(),
  primary key (recurring_id, user_id, work_date),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
alter table public.recurring_done enable row level security;
revoke all on public.recurring_done from anon;
create policy "Xem việc lặp lại đã xong"
  on public.recurring_done for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Tích xong việc lặp lại: chính mình hôm nay, hoặc người quản lý"
  on public.recurring_done for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and public.is_org_member(org_id) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  );
create policy "Bỏ tích việc lặp lại"
  on public.recurring_done for delete to authenticated
  using (
    (user_id = (select auth.uid()) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  );

-- Việc lặp lại phải cùng shop và áp cho người này.
create function public.recurring_done_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurring_tasks;
begin
  select * into r from public.recurring_tasks where id = new.recurring_id;
  if r.id is null or r.org_id <> new.org_id or not (
    r.user_id = new.user_id
    or exists (select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.user_id and m.department = r.department)
  ) then
    raise exception 'Việc này không giao cho người này.' using errcode = 'check_violation';
  end if;
  new.done_at := now();
  return new;
end;
$$;
create trigger recurring_done_check before insert on public.recurring_done for each row execute function public.recurring_done_check();

-- ---------------------------------------------------------------------------
create table public.work_reports (
  org_id uuid not null,
  user_id uuid not null,
  work_date date not null,
  result_text text check (result_text is null or length(result_text) <= 2000),
  blockers text check (blockers is null or length(blockers) <= 2000),
  tomorrow text check (tomorrow is null or length(tomorrow) <= 2000),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  manager_note text check (manager_note is null or length(manager_note) <= 1000),
  manager_note_by uuid references auth.users (id) on delete set null,
  manager_note_at timestamptz,
  primary key (org_id, user_id, work_date),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
create index work_reports_org_date_idx on public.work_reports (org_id, work_date);
comment on table public.work_reports is 'Báo cáo cuối ngày của từng người + nhận xét của Quản lý.';

alter table public.work_reports enable row level security;
revoke all on public.work_reports from anon;
create policy "Xem báo cáo ngày: của mình, hoặc người mình quản lý"
  on public.work_reports for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Viết báo cáo hôm nay của mình"
  on public.work_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_org_member(org_id) and work_date = public.vn_today());
create policy "Sửa báo cáo: của mình hôm nay; người quản lý ghi nhận xét"
  on public.work_reports for update to authenticated
  using ((user_id = (select auth.uid()) and work_date = public.vn_today()) or public.can_manage_member(org_id, user_id))
  with check ((user_id = (select auth.uid()) and work_date = public.vn_today()) or public.can_manage_member(org_id, user_id));

-- Người viết chỉ sửa phần báo cáo; người quản lý chỉ sửa phần nhận xét. Giờ gửi = giờ database.
create function public.work_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then return new; end if;
  if tg_op = 'INSERT' then
    new.manager_note := null; new.manager_note_by := null; new.manager_note_at := null;
    new.submitted_at := now(); new.updated_at := now();
    return new;
  end if;
  if new.org_id <> old.org_id or new.user_id <> old.user_id or new.work_date <> old.work_date then
    raise exception 'Không đổi được người / ngày của báo cáo.' using errcode = 'insufficient_privilege';
  end if;
  if me = old.user_id then
    new.manager_note := old.manager_note; new.manager_note_by := old.manager_note_by; new.manager_note_at := old.manager_note_at;
    new.submitted_at := coalesce(old.submitted_at, now()); new.updated_at := now();
  else
    new.result_text := old.result_text; new.blockers := old.blockers; new.tomorrow := old.tomorrow;
    new.submitted_at := old.submitted_at; new.updated_at := old.updated_at;
    new.manager_note_by := me; new.manager_note_at := now();
  end if;
  return new;
end;
$$;
create trigger work_reports_guard before insert or update on public.work_reports for each row execute function public.work_reports_guard();

-- ---------------------------------------------------------------------------
create table public.kpi_daily (
  org_id uuid not null,
  assignment_id uuid not null references public.kpi_assignments (id) on delete cascade,
  user_id uuid not null,
  work_date date not null,
  value numeric(16, 2) not null check (value >= 0 and value <= 1000000000),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, user_id, work_date),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
create index kpi_daily_org_date_idx on public.kpi_daily (org_id, work_date);
comment on table public.kpi_daily is 'Số KPI nhập tay theo ngày (báo cáo cuối ngày); cộng dồn thành kết quả tháng.';

alter table public.kpi_daily enable row level security;
revoke all on public.kpi_daily from anon;
create policy "Xem số KPI theo ngày"
  on public.kpi_daily for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_org_member(org_id)) or public.can_manage_member(org_id, user_id));
create policy "Ghi số KPI theo ngày (thêm)"
  on public.kpi_daily for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and public.is_org_member(org_id) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  );
create policy "Ghi số KPI theo ngày (sửa)"
  on public.kpi_daily for update to authenticated
  using (
    (user_id = (select auth.uid()) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  )
  with check (
    (user_id = (select auth.uid()) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  );
create policy "Ghi số KPI theo ngày (xóa)"
  on public.kpi_daily for delete to authenticated
  using (
    (user_id = (select auth.uid()) and work_date = public.vn_today())
    or (public.can_manage_member(org_id, user_id) and public.attendance_day_open(org_id, work_date))
  );

-- Chỉ KPI nhập tay, gắn cho đúng người, cùng shop.
create function public.kpi_daily_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.kpi_assignments;
  src text;
begin
  select * into a from public.kpi_assignments where id = new.assignment_id;
  select t.source into src from public.kpi_templates t where t.id = a.template_id;
  if a.id is null or a.org_id <> new.org_id or src <> 'manual' or not (
    a.user_id = new.user_id
    or exists (select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.user_id and m.department = a.department)
  ) then
    raise exception 'KPI này không nhập tay cho người này.' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and (new.assignment_id <> old.assignment_id or new.user_id <> old.user_id or new.work_date <> old.work_date) then
    raise exception 'Không đổi được KPI / người / ngày.' using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger kpi_daily_check before insert or update on public.kpi_daily for each row execute function public.kpi_daily_check();

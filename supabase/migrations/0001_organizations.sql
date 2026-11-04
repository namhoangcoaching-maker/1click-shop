-- =============================================================================
-- 0001 – Doanh nghiệp (shop) và thành viên. Nền móng cho mọi dữ liệu nhiều shop.
--
-- QUY ƯỚC CHO MỌI BẢNG SAU NÀY (đơn hàng, tồn kho, lương…):
--   1. Có cột  org_id uuid not null references public.organizations(id) on delete cascade
--   2. Bật RLS:  alter table ... enable row level security;
--   3. Policy đọc tối thiểu:  using (public.is_org_member(org_id))
--   4. Thêm test trong src/lib/org/rls.dbtest.ts chứng minh shop A không thấy dữ liệu shop B.
-- =============================================================================

create type public.org_role as enum ('owner', 'manager', 'staff');

comment on type public.org_role is 'owner = Chủ shop, manager = Quản lý, staff = Nhân viên';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  logo_url text,
  created_at timestamptz not null default now()
);

comment on table public.organizations is 'Mỗi dòng là một doanh nghiệp/shop dùng 1Click.';

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

comment on table public.memberships is 'Ai thuộc shop nào, với vai trò gì.';

-- -----------------------------------------------------------------------------
-- Hàm kiểm tra quyền. "security definer" để đọc bảng memberships mà không bị
-- chính RLS của bảng đó chặn (tránh vòng lặp vô hạn). search_path rỗng để an toàn.
-- -----------------------------------------------------------------------------

create function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, public.org_role[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Không để shop nào mất hết Chủ (ví dụ Chủ tự hạ quyền hoặc tự xóa mình).
-- Khi xóa cả doanh nghiệp (cascade) thì cho phép.
-- -----------------------------------------------------------------------------

create function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (
       select 1 from public.memberships m
       where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'Mỗi shop phải còn ít nhất một Chủ.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_one_owner
before update of role or delete on public.memberships
for each row execute function public.keep_one_owner();

-- Không cho đổi org_id / user_id của một dòng thành viên (chỉ đổi vai trò).
create function public.memberships_lock_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id <> old.org_id or new.user_id <> old.user_id then
    raise exception 'Không được chuyển thành viên sang shop/người khác.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger memberships_lock_keys
before update on public.memberships
for each row execute function public.memberships_lock_keys();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Tạo/xóa doanh nghiệp: chỉ quản trị 1Click (khóa secret, bỏ qua RLS) → không có policy insert/delete.
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Người chưa đăng nhập không được đụng vào.
revoke all on public.organizations, public.memberships from anon;

create policy "Thành viên xem shop của mình"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "Chủ sửa thông tin shop"
  on public.organizations for update to authenticated
  using (public.has_org_role(id, '{owner}'))
  with check (public.has_org_role(id, '{owner}'));

create policy "Thành viên xem danh sách thành viên shop mình"
  on public.memberships for select to authenticated
  using (public.is_org_member(org_id));

create policy "Chủ thêm thành viên"
  on public.memberships for insert to authenticated
  with check (public.has_org_role(org_id, '{owner}'));

create policy "Chủ đổi vai trò thành viên"
  on public.memberships for update to authenticated
  using (public.has_org_role(org_id, '{owner}'))
  with check (public.has_org_role(org_id, '{owner}'));

create policy "Chủ xóa thành viên"
  on public.memberships for delete to authenticated
  using (public.has_org_role(org_id, '{owner}'));

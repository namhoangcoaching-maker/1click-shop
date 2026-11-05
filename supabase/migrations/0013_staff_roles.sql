-- =============================================================================
-- 0013 – Giai đoạn 6.1: phân quyền nhân viên (chủ dự án duyệt 05/11/2026).
--  • memberships: thêm họ tên, bộ phận, trạng thái khóa (disabled_at) cho người nghỉ việc.
--  • Thành viên bị khóa = coi như không thuộc shop (is_org_member / has_org_role trả false).
--  • Dữ liệu kinh doanh (đơn, sản phẩm, thu chi, báo cáo, kết nối, cấu hình tồn kho, hàng sắp về,
--    thẻ chi phí, tiến độ đồng bộ): CHỈ Chủ shop và Quản lý được đọc. Nhân viên không đọc được.
--  • Danh sách thành viên: Nhân viên chỉ thấy dòng của chính mình; Chủ/Quản lý thấy cả shop.
--  • Không được khóa Chủ cuối cùng còn hoạt động.
-- =============================================================================

alter table public.memberships
  add column display_name text check (display_name is null or length(btrim(display_name)) between 1 and 80),
  add column department text check (department is null or length(btrim(department)) between 1 and 60),
  add column disabled_at timestamptz;

comment on column public.memberships.display_name is 'Họ tên hiển thị của thành viên trong shop.';
comment on column public.memberships.department is 'Bộ phận / vị trí (bán hàng, đóng gói, content…).';
comment on column public.memberships.disabled_at is 'Khác null = tài khoản đã bị khóa trong shop này (nghỉ việc).';

-- Thành viên bị khóa không còn là thành viên.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.disabled_at is null
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles public.org_role[])
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
      and m.disabled_at is null
  );
$$;

-- Mỗi shop phải còn ít nhất một Chủ đang hoạt động (không xóa, không hạ quyền, không khóa Chủ cuối cùng).
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and old.disabled_at is null
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.disabled_at is not null)
     and exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (
       select 1 from public.memberships m
       where m.org_id = old.org_id and m.role = 'owner' and m.disabled_at is null and m.user_id <> old.user_id
     )
  then
    raise exception 'Mỗi shop phải còn ít nhất một Chủ.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger memberships_keep_one_owner on public.memberships;
create trigger memberships_keep_one_owner
before update of role, disabled_at or delete on public.memberships
for each row execute function public.keep_one_owner();

-- Danh sách thành viên: Nhân viên chỉ thấy chính mình (kể cả khi bị khóa, để app biết mà báo).
drop policy "Thành viên xem danh sách thành viên shop mình" on public.memberships;
create policy "Xem thành viên: chính mình, hoặc Chủ/Quản lý xem cả shop"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_org_role(org_id, '{owner,manager}'));

-- Dữ liệu kinh doanh: chỉ Chủ / Quản lý đọc.
do $$
declare
  t text;
begin
  foreach t in array array['products', 'orders', 'order_items', 'sync_state', 'cash_transactions'] loop
    execute format('drop policy "Thành viên xem dữ liệu shop mình" on public.%I', t);
    execute format(
      'create policy "Chủ, Quản lý xem dữ liệu shop" on public.%I for select to authenticated using (public.has_org_role(org_id, ''{owner,manager}''))',
      t
    );
  end loop;
end;
$$;

drop policy "Thành viên xem kết nối của shop mình" on public.connections;
create policy "Chủ, Quản lý xem kết nối" on public.connections for select to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

drop policy "Thành viên xem cấu hình tồn kho shop mình" on public.inventory_settings;
create policy "Chủ, Quản lý xem cấu hình tồn kho" on public.inventory_settings for select to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

drop policy "Thành viên xem hàng sắp về của shop mình" on public.incoming_stock;
create policy "Chủ, Quản lý xem hàng sắp về" on public.incoming_stock for select to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

drop policy "Thành viên xem báo cáo shop mình" on public.daily_reports;
create policy "Chủ, Quản lý xem báo cáo" on public.daily_reports for select to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

drop policy "Thành viên xem thẻ chi phí" on public.expense_tags;
create policy "Chủ, Quản lý xem thẻ chi phí" on public.expense_tags for select to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

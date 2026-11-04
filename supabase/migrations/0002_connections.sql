-- =============================================================================
-- 0002 – Kết nối nguồn dữ liệu của từng shop (bắt đầu với Pancake POS).
-- Khóa API được mã hóa ở máy chủ web (AES-256-GCM, ENCRYPTION_KEY) trước khi lưu;
-- database chỉ giữ bản mã. Trình duyệt KHÔNG BAO GIỜ đọc được cột secret_ciphertext.
-- =============================================================================

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('pancake_pos')),
  -- Mã và tên shop bên Pancake (để hiện cho người dùng và gọi API sau này).
  external_id text not null check (length(external_id) between 1 and 64),
  external_name text,
  secret_ciphertext text not null,
  -- Vài ký tự cuối của khóa, ví dụ "••••a1b2".
  secret_hint text not null,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_error text,
  last_checked_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

comment on table public.connections is 'Khóa kết nối Pancake… của từng shop (đã mã hóa).';

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger connections_touch_updated_at
before update on public.connections
for each row execute function public.touch_updated_at();

-- Không cho chuyển một kết nối sang shop khác.
create function public.connections_lock_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id <> old.org_id or new.provider <> old.provider then
    raise exception 'Không được chuyển kết nối sang shop/nguồn khác.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger connections_lock_org
before update on public.connections
for each row execute function public.connections_lock_org();

-- -----------------------------------------------------------------------------
-- Quyền theo cột: người dùng (authenticated) đọc mọi cột TRỪ secret_ciphertext.
-- Chỉ máy chủ web (khóa secret) mới đọc bản mã để giải mã khi đồng bộ dữ liệu.
-- -----------------------------------------------------------------------------

revoke all on public.connections from anon, authenticated;
grant select (
  id, org_id, provider, external_id, external_name, secret_hint,
  status, last_error, last_checked_at, updated_by, created_at, updated_at
) on public.connections to authenticated;
grant insert (
  org_id, provider, external_id, external_name, secret_ciphertext, secret_hint,
  status, last_error, last_checked_at, updated_by
) on public.connections to authenticated;
grant update (
  external_id, external_name, secret_ciphertext, secret_hint,
  status, last_error, last_checked_at, updated_by
) on public.connections to authenticated;
grant delete on public.connections to authenticated;

alter table public.connections enable row level security;

create policy "Thành viên xem kết nối của shop mình"
  on public.connections for select to authenticated
  using (public.is_org_member(org_id));

create policy "Chủ thêm kết nối"
  on public.connections for insert to authenticated
  with check (public.has_org_role(org_id, '{owner}'));

create policy "Chủ sửa kết nối"
  on public.connections for update to authenticated
  using (public.has_org_role(org_id, '{owner}'))
  with check (public.has_org_role(org_id, '{owner}'));

create policy "Chủ xóa kết nối"
  on public.connections for delete to authenticated
  using (public.has_org_role(org_id, '{owner}'));

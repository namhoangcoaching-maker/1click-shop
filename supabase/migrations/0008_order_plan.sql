-- =============================================================================
-- 0008 – Kế hoạch đặt hàng theo lịch (chủ dự án chốt 05/11/2026).
-- 1. Thêm các con số của kế hoạch vào cấu hình tồn kho (giới hạn khớp src/lib/inventory/settings.ts).
--    Các cột cũ safety_days, target_cover_days, warning_window_days, default_lead_time_days
--    không còn dùng (giữ lại để không mất dữ liệu).
-- 2. Bảng "Hàng sắp về": shop nhập số lượng đã đặt xưởng từng size + ngày dự kiến về.
-- =============================================================================

alter table public.inventory_settings
  add column moq_per_size int not null default 20 check (moq_per_size between 1 and 1000),
  add column tier1_qty int not null default 50 check (tier1_qty between 1 and 10000),
  add column tier1_days int not null default 7 check (tier1_days between 1 and 120),
  add column tier2_qty int not null default 150 check (tier2_qty between 1 and 10000),
  add column tier2_days int not null default 10 check (tier2_days between 1 and 120),
  add column tier3_days int not null default 14 check (tier3_days between 1 and 120),
  add column max_negative_days int not null default 7 check (max_negative_days between 0 and 60),
  add column extra_cover_days int not null default 7 check (extra_cover_days between 0 and 60),
  add column slow_cover_days int not null default 60 check (slow_cover_days between 7 and 365),
  add constraint inventory_settings_tiers_ordered check (tier1_qty < tier2_qty);

grant update (
  moq_per_size, tier1_qty, tier1_days, tier2_qty, tier2_days, tier3_days,
  max_negative_days, extra_cover_days, slow_cover_days
) on public.inventory_settings to authenticated;
grant insert (
  moq_per_size, tier1_qty, tier1_days, tier2_qty, tier2_days, tier3_days,
  max_negative_days, extra_cover_days, slow_cover_days
) on public.inventory_settings to authenticated;

create table public.incoming_stock (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  variation_id text not null,
  quantity int not null check (quantity between 1 and 100000),
  eta date not null,
  note text check (length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index incoming_stock_org_idx on public.incoming_stock (org_id, variation_id);

comment on table public.incoming_stock is 'Hàng đã đặt xưởng chưa về (shop nhập trên 1Click).';

revoke all on public.incoming_stock from anon, authenticated;
grant select, delete on public.incoming_stock to authenticated;
grant insert (org_id, variation_id, quantity, eta, note, created_by) on public.incoming_stock to authenticated;
grant update (quantity, eta, note) on public.incoming_stock to authenticated;

alter table public.incoming_stock enable row level security;

create policy "Thành viên xem hàng sắp về của shop mình"
  on public.incoming_stock for select to authenticated
  using (public.is_org_member(org_id));

-- Nhập/sửa/xóa hàng sắp về: Chủ shop và Quản lý (người lo đặt xưởng).
create policy "Chủ, Quản lý thêm hàng sắp về"
  on public.incoming_stock for insert to authenticated
  with check (public.has_org_role(org_id, '{owner,manager}'));

create policy "Chủ, Quản lý sửa hàng sắp về"
  on public.incoming_stock for update to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'))
  with check (public.has_org_role(org_id, '{owner,manager}'));

create policy "Chủ, Quản lý xóa hàng sắp về"
  on public.incoming_stock for delete to authenticated
  using (public.has_org_role(org_id, '{owner,manager}'));

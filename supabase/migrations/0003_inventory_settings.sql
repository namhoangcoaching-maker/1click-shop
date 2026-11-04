-- =============================================================================
-- 0003 – Cấu hình tồn kho của từng shop (dự phòng, sản xuất đủ bán…).
-- Shop chưa có dòng nào thì web dùng số mặc định (src/lib/inventory/stock.ts → STOCK_RULES).
-- Giới hạn check PHẢI khớp SETTING_FIELDS trong src/lib/inventory/settings.ts.
-- Chỉ Chủ shop được sửa (chủ dự án chốt 04/11/2026); mọi thành viên được xem.
-- =============================================================================

create table public.inventory_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  safety_days int not null default 3 check (safety_days between 0 and 60),
  target_cover_days int not null default 21 check (target_cover_days between 1 and 365),
  default_lead_time_days int not null default 7 check (default_lead_time_days between 1 and 180),
  warning_window_days int not null default 7 check (warning_window_days between 0 and 60),
  slow_moving_days int not null default 90 check (slow_moving_days between 7 and 730),
  velocity_window_days int not null default 30 check (velocity_window_days between 7 and 180),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.inventory_settings is 'Các con số báo động tồn kho, mỗi shop một dòng.';

create trigger inventory_settings_touch_updated_at
before update on public.inventory_settings
for each row execute function public.touch_updated_at();

revoke all on public.inventory_settings from anon, authenticated;
grant select on public.inventory_settings to authenticated;
grant insert (
  org_id, safety_days, target_cover_days, default_lead_time_days,
  warning_window_days, slow_moving_days, velocity_window_days, updated_by
) on public.inventory_settings to authenticated;
-- Không cho sửa org_id: cột này không có trong danh sách được update.
grant update (
  safety_days, target_cover_days, default_lead_time_days,
  warning_window_days, slow_moving_days, velocity_window_days, updated_by
) on public.inventory_settings to authenticated;

alter table public.inventory_settings enable row level security;

create policy "Thành viên xem cấu hình tồn kho shop mình"
  on public.inventory_settings for select to authenticated
  using (public.is_org_member(org_id));

create policy "Chủ tạo cấu hình tồn kho"
  on public.inventory_settings for insert to authenticated
  with check (public.has_org_role(org_id, '{owner}'));

create policy "Chủ sửa cấu hình tồn kho"
  on public.inventory_settings for update to authenticated
  using (public.has_org_role(org_id, '{owner}'))
  with check (public.has_org_role(org_id, '{owner}'));

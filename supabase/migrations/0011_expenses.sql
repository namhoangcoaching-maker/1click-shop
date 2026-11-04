-- =============================================================================
-- 0011 – Chi phí theo thẻ phiếu chi Pancake (chủ dự án chốt 05/11/2026).
-- Chỉ phiếu chi CÓ GẮN THẺ mới là chi phí (Sản xuất = trả xưởng/nhập hàng, Quay chụp, Phần mềm, Lương, Khác…).
-- Phiếu Pancake tự sinh theo đơn (trả trước, hoàn, đổi số tiền) đã nằm trong Tiền về/Doanh thu.
-- Pancake chỉ trả MÃ thẻ, không trả TÊN → bảng expense_tags để Chủ shop đặt tên một lần.
-- =============================================================================

alter table public.cash_transactions
  add column display_id text,
  add column tag_ids text[] not null default '{}',
  add column time_incurred timestamptz,
  add column table_name text,
  add column currency text,
  add column status smallint;

create index cash_transactions_tags_idx on public.cash_transactions using gin (tag_ids);

create table public.expense_tags (
  org_id uuid not null references public.organizations (id) on delete cascade,
  tag_id text not null,
  name text not null check (length(btrim(name)) between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (org_id, tag_id)
);

comment on table public.expense_tags is 'Tên thẻ phiếu chi Pancake do shop đặt (Pancake không trả tên thẻ qua API).';

revoke all on public.expense_tags from anon, authenticated;
grant select, delete on public.expense_tags to authenticated;
grant insert (org_id, tag_id, name) on public.expense_tags to authenticated;
grant update (name) on public.expense_tags to authenticated;
alter table public.expense_tags enable row level security;

create policy "Thành viên xem thẻ chi phí"
  on public.expense_tags for select to authenticated
  using (public.is_org_member(org_id));
create policy "Chủ đặt tên thẻ chi phí"
  on public.expense_tags for insert to authenticated
  with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ sửa tên thẻ chi phí"
  on public.expense_tags for update to authenticated
  using (public.has_org_role(org_id, '{owner}'))
  with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ xóa tên thẻ chi phí"
  on public.expense_tags for delete to authenticated
  using (public.has_org_role(org_id, '{owner}'));

-- Lấy lại thu chi 90 ngày để có mã thẻ, ngày phát sinh, loại phiếu, tiền tệ.
update public.sync_state set transactions_synced_at = null;

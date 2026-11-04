-- =============================================================================
-- 0009 – Tiền về (chủ dự án chốt 05/11/2026, tự động theo luật, không đối soát tay).
-- 1. Đơn hàng: thêm thời điểm khách nhận (lần đầu sang "Đã nhận"), thời điểm hoàn,
--    tiền COD, đơn vị vận chuyển, giá trị hàng hoàn (cho hoàn một phần).
-- 2. Thu chi Pancake (khách chuyển khoản trước, Shopify trả trước, hoàn tiền): bảng cash_transactions.
-- Đồng bộ lại 90 ngày đơn để lấy lịch sử trạng thái.
-- =============================================================================

alter table public.orders
  add column delivered_at timestamptz,
  add column returned_at timestamptz,
  add column partial_returned_at timestamptz,
  add column cod bigint not null default 0,
  add column carrier_id int,
  add column returned_value bigint not null default 0;

create index orders_org_delivered_idx on public.orders (org_id, delivered_at);
create index orders_org_returned_idx on public.orders (org_id, returned_at);

create table public.cash_transactions (
  org_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id text not null,
  posted_at timestamptz not null,
  amount bigint not null,
  name text,
  kind smallint,              -- type_transaction của Pancake: 1 thu, 2 chi
  account text,               -- tài khoản/nguồn (ví dụ Shopify, Instagram)
  order_display_id text,      -- mã đơn liên quan (ref_display_id)
  is_canceled boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (org_id, transaction_id)
);

create index cash_transactions_org_posted_idx on public.cash_transactions (org_id, posted_at);

comment on table public.cash_transactions is 'Thu chi trên Pancake (trả trước, hoàn tiền), dùng tính tiền về.';

revoke all on public.cash_transactions from anon, authenticated;
grant select on public.cash_transactions to authenticated;
alter table public.cash_transactions enable row level security;
create policy "Thành viên xem dữ liệu shop mình"
  on public.cash_transactions for select to authenticated
  using (public.is_org_member(org_id));

alter table public.sync_state add column transactions_synced_at timestamptz;

-- Lấy lại 90 ngày đơn (để có thời điểm nhận/hoàn) và thu chi từ đầu.
update public.sync_state
set backfill_target = now() - interval '90 days',
    backfill_next_end = now(),
    transactions_synced_at = null;

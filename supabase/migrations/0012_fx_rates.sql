-- =============================================================================
-- 0012 – Tỷ giá ngoại tệ theo ngày (Vietcombank, mua chuyển khoản), dùng đổi đơn Shopify USD sang VND.
-- Dữ liệu công khai, dùng chung mọi shop. Người dùng chỉ đọc; máy chủ ghi.
-- =============================================================================
create table public.fx_rates (
  currency text not null,
  rate_date date not null,
  rate numeric(14, 2) not null check (rate > 0),
  source text not null default 'vietcombank_transfer',
  fetched_at timestamptz not null default now(),
  primary key (currency, rate_date)
);
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to authenticated;
alter table public.fx_rates enable row level security;
create policy "Ai đăng nhập cũng xem tỷ giá" on public.fx_rates for select to authenticated using (true);

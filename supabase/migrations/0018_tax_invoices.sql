-- =============================================================================
-- 0018 – Giai đoạn 7.1: hóa đơn điện tử + quy định thuế (chủ dự án duyệt 06/11/2026).
--  • einvoices: hóa đơn điện tử từ Pancake (GET /list_einvoices/), KHÔNG lưu thông tin người mua
--    (tên, SĐT, email, MST, địa chỉ). Nối đơn qua order_info.display_id = orders.system_id.
--  • tax_rules: bảng quy định thuế DÙNG CHUNG mọi shop, có ngày hiệu lực – luật đổi thì thêm dòng mới,
--    KHÔNG sửa code. Giá trị khởi tạo do chủ dự án cung cấp (PROJECT_BRIEF 3.5), chờ kế toán xác nhận.
--  • tax_settings: loại hình + doanh thu năm trước của từng shop (chỉ Chủ shop sửa).
-- =============================================================================

create table public.einvoices (
  org_id uuid not null references public.organizations (id) on delete cascade,
  einvoice_id bigint not null,
  invoice_no text,
  invoice_series text,
  -- 0 Chưa phát hành, 1 Chờ phát hành, 2 Đã phát hành, 3 Đã hủy, 4 Thay thế, 5 Bị thay thế, 6 Điều chỉnh, 7 Bị điều chỉnh
  status smallint not null check (status between 0 and 7),
  order_system_id text,
  original_einvoice_id bigint,
  adjustment_type smallint,
  total_amount bigint not null default 0,
  released_at timestamptz,
  created_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (org_id, einvoice_id)
);
create index einvoices_org_order_idx on public.einvoices (org_id, order_system_id);
create index einvoices_org_released_idx on public.einvoices (org_id, released_at);
comment on table public.einvoices is 'Hóa đơn điện tử từ Pancake (không có thông tin người mua).';

alter table public.einvoices enable row level security;
revoke all on public.einvoices from anon;
create policy "Chủ, Quản lý xem hóa đơn"
  on public.einvoices for select to authenticated using (public.has_org_role(org_id, '{owner,manager}'));

alter table public.sync_state
  add column einvoices_synced_at timestamptz,
  add column einvoices_full_at timestamptz;

-- ---------------------------------------------------------------------------
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  business_type text not null check (business_type in ('household', 'company')),
  -- Doanh thu năm (đồng): áp khi revenue_min < doanh thu ≤ revenue_max (revenue_max null = không giới hạn)
  revenue_min bigint not null default 0,
  revenue_max bigint,
  -- Kỳ khai thuế GTGT: none (không khai định kỳ), month, quarter
  vat_period text not null check (vat_period in ('none', 'month', 'quarter')),
  einvoice_required boolean not null,
  -- Hộ kinh doanh không phải nộp: thông báo doanh thu năm chậm nhất 31/1 năm sau
  annual_revenue_notice boolean not null default false,
  summary text not null,
  legal_ref text,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (revenue_max is null or revenue_max > revenue_min),
  check (effective_to is null or effective_to >= effective_from)
);
comment on table public.tax_rules is 'Quy định thuế theo loại hình + ngưỡng doanh thu, có ngày hiệu lực (dùng chung). Thêm dòng mới khi luật đổi.';

alter table public.tax_rules enable row level security;
revoke all on public.tax_rules from anon;
create policy "Ai đăng nhập cũng xem quy định thuế" on public.tax_rules for select to authenticated using (true);

insert into public.tax_rules (business_type, revenue_min, revenue_max, vat_period, einvoice_required, annual_revenue_notice, summary, legal_ref, effective_from) values
  ('household', 0, 1000000000, 'none', false, true,
   'Hộ kinh doanh doanh thu năm ≤ 1 tỷ: không nộp thuế GTGT và TNCN, không bắt buộc hóa đơn điện tử; thông báo doanh thu chậm nhất 31/1 năm sau.',
   'Nghị định 68/2026, sửa đổi bởi Nghị định 141/2026 (theo chủ dự án, chờ kế toán xác nhận)', '2026-01-01'),
  ('household', 1000000000, 50000000000, 'quarter', true, false,
   'Hộ kinh doanh doanh thu năm trên 1 tỷ đến 50 tỷ: khai và nộp thuế GTGT theo quý, bắt buộc hóa đơn điện tử.',
   'Nghị định 68/2026, sửa đổi bởi Nghị định 141/2026 (theo chủ dự án, chờ kế toán xác nhận)', '2026-01-01'),
  ('household', 50000000000, null, 'month', true, false,
   'Hộ kinh doanh doanh thu năm trên 50 tỷ: khai và nộp thuế GTGT theo tháng, bắt buộc hóa đơn điện tử.',
   'Nghị định 68/2026, sửa đổi bởi Nghị định 141/2026 (theo chủ dự án, chờ kế toán xác nhận)', '2026-01-01'),
  ('company', 0, 50000000000, 'quarter', true, false,
   'Công ty doanh thu năm trước ≤ 50 tỷ hoặc mới thành lập: khai thuế GTGT theo quý.',
   'Theo chủ dự án, chờ kế toán xác nhận', '2026-01-01'),
  ('company', 50000000000, null, 'month', true, false,
   'Công ty doanh thu năm trước trên 50 tỷ: khai thuế GTGT theo tháng.',
   'Theo chủ dự án, chờ kế toán xác nhận', '2026-01-01');

-- ---------------------------------------------------------------------------
create table public.tax_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  business_type text not null default 'household' check (business_type in ('household', 'company')),
  prior_year_revenue bigint not null default 0 check (prior_year_revenue between 0 and 100000000000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.tax_settings is 'Loại hình doanh nghiệp + doanh thu năm trước của shop (chỉ Chủ shop sửa).';

alter table public.tax_settings enable row level security;
revoke all on public.tax_settings from anon;
create policy "Chủ, Quản lý xem cấu hình thuế"
  on public.tax_settings for select to authenticated using (public.has_org_role(org_id, '{owner,manager}'));
create policy "Chủ lưu cấu hình thuế (thêm)"
  on public.tax_settings for insert to authenticated with check (public.has_org_role(org_id, '{owner}'));
create policy "Chủ lưu cấu hình thuế (sửa)"
  on public.tax_settings for update to authenticated
  using (public.has_org_role(org_id, '{owner}')) with check (public.has_org_role(org_id, '{owner}'));

-- Sugar Crush: hộ kinh doanh, doanh thu năm trước > 1 tỷ (chủ dự án chọn 06/11/2026; số chính xác Chủ shop điền sau).
insert into public.tax_settings (org_id, business_type, prior_year_revenue)
select id, 'household', 1000000001 from public.organizations where name = 'Sugar Crush'
on conflict (org_id) do nothing;

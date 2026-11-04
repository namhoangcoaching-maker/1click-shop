-- =============================================================================
-- 0004 – Dữ liệu bán hàng đồng bộ từ Pancake POS: sản phẩm (theo màu/size), đơn hàng, dòng hàng.
-- KHÔNG lưu thông tin cá nhân của khách (tên, SĐT, địa chỉ, email): web không cần để tính số liệu.
-- Chỉ máy chủ web (khóa secret) ghi; người dùng chỉ ĐỌC dữ liệu shop mình (RLS).
-- Tiền lưu bằng số nguyên VND (bigint), thời gian lưu giờ quốc tế (timestamptz).
-- =============================================================================

-- Sản phẩm theo từng mã màu/size (Pancake gọi là "variation").
create table public.products (
  org_id uuid not null references public.organizations (id) on delete cascade,
  variation_id text not null,
  product_id text not null,
  sku text,                      -- Mã hiển thị trên Pancake (display_id), ví dụ SC181M
  name text not null,
  variant text,                  -- "Đỏ / M" ghép từ thuộc tính màu, size
  retail_price bigint not null default 0,
  cost_price bigint,             -- Giá nhập trung bình; null nếu chưa có trên Pancake
  stock integer not null default 0,
  internal_note text,            -- "Ghi chú nội bộ" của sản phẩm (đọc thời gian sản xuất "SX: 10")
  is_hidden boolean not null default false,
  pancake_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (org_id, variation_id)
);

create table public.orders (
  org_id uuid not null references public.organizations (id) on delete cascade,
  order_id bigint not null,      -- Mã đơn trên Pancake (id), riêng theo shop
  inserted_at timestamptz not null,
  pancake_updated_at timestamptz,
  status smallint not null,      -- Xem ORDER_STATUS trong src/lib/pancake/map.ts
  source text,                   -- Nguồn đơn: Shopee, Tiktok, Instagram…
  total_price bigint not null default 0,          -- Tổng tiền hàng theo giá bán (Doanh số)
  total_discount bigint not null default 0,       -- Chiết khấu
  shipping_fee bigint not null default 0,         -- Phí ship thu của khách
  surcharge bigint not null default 0,
  fee_marketplace bigint not null default 0,      -- Phí sàn (Shopee, TikTok…)
  partner_fee bigint not null default 0,          -- Phí đơn vị vận chuyển shop trả
  tax bigint not null default 0,
  total_after_discount bigint not null default 0, -- Pancake: total_price_after_sub_discount
  total_quantity integer not null default 0,
  seller_id text,                -- Nhân viên bán (để tính KPI ở Giai đoạn 6)
  synced_at timestamptz not null default now(),
  primary key (org_id, order_id)
);

create index orders_org_inserted_idx on public.orders (org_id, inserted_at);

create table public.order_items (
  org_id uuid not null,
  order_id bigint not null,
  item_id text not null,
  variation_id text,
  product_id text,
  quantity integer not null default 0,
  retail_price bigint not null default 0,
  discount_each_product bigint not null default 0,
  total_discount bigint not null default 0,
  return_quantity integer not null default 0,
  is_bonus boolean not null default false,
  primary key (org_id, order_id, item_id),
  foreign key (org_id, order_id) references public.orders (org_id, order_id) on delete cascade
);

create index order_items_variation_idx on public.order_items (org_id, variation_id);

-- Tiến độ đồng bộ của từng shop.
create table public.sync_state (
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('pancake_pos')),
  products_synced_at timestamptz,
  orders_cursor timestamptz,          -- Đã lấy hết đơn cập nhật trước mốc này
  backfill_target timestamptz,        -- Lấy lịch sử về tới mốc này (90 ngày)
  backfill_next_end timestamptz,      -- Đợt lấy lịch sử tiếp theo kết thúc ở mốc này (lùi dần)
  running_since timestamptz,          -- Khóa chống chạy chồng
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'partial', 'error')),
  last_error text,
  last_counts jsonb,
  primary key (org_id, provider)
);

-- -----------------------------------------------------------------------------
-- RLS: thành viên chỉ đọc dữ liệu shop mình. Không ai ghi qua trình duyệt.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products', 'orders', 'order_items', 'sync_state'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Thành viên xem dữ liệu shop mình" on public.%I for select to authenticated using (public.is_org_member(org_id))',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- 0005 – Sửa: mã đơn Pancake là CHỮ, không phải số.
-- Đơn từ sàn (Shopee, TikTok) có mã như "261104EK2E1FYN"; 0004 lưu dạng số nên các đơn này bị bỏ sót.
-- Xóa dữ liệu đơn đã lấy (sẽ đồng bộ lại từ đầu), đổi kiểu cột, thêm system_id (số thứ tự Pancake).
-- =============================================================================

truncate public.order_items, public.orders;

alter table public.order_items drop constraint order_items_org_id_order_id_fkey;
alter table public.order_items alter column order_id type text using order_id::text;
alter table public.orders alter column order_id type text using order_id::text;
alter table public.orders add column system_id bigint;
alter table public.order_items
  add constraint order_items_org_id_order_id_fkey
  foreign key (org_id, order_id) references public.orders (org_id, order_id) on delete cascade;

-- Lấy lại lịch sử 90 ngày từ đầu cho mọi shop.
update public.sync_state
set orders_cursor = now(),
    backfill_target = now() - interval '90 days',
    backfill_next_end = now(),
    last_status = null,
    last_counts = null;

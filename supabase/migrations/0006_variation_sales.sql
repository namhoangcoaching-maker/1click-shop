-- =============================================================================
-- 0006 – Tổng số đã bán theo từng mã (variation) từ một mốc thời gian, chỉ tính đơn có trạng thái cho trước.
-- Dùng cho tốc độ bán ở trang Tồn kho. Danh sách trạng thái "đơn chốt" do code truyền vào
-- (CONFIRMED_STATUSES trong src/lib/pancake/map.ts) để chỉ có MỘT nơi định nghĩa.
-- security invoker: chạy bằng quyền người gọi → RLS vẫn chặn shop khác.
-- =============================================================================

create function public.variation_sales(p_org_id uuid, p_since timestamptz, p_statuses smallint[])
returns table (variation_id text, sold bigint, returned bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select oi.variation_id,
         sum(oi.quantity)::bigint as sold,
         sum(oi.return_quantity)::bigint as returned
  from public.order_items oi
  join public.orders o on o.org_id = oi.org_id and o.order_id = oi.order_id
  where o.org_id = p_org_id
    and o.inserted_at >= p_since
    and o.status = any (p_statuses)
    and oi.variation_id is not null
  group by oi.variation_id;
$$;

revoke execute on function public.variation_sales(uuid, timestamptz, smallint[]) from public, anon;
grant execute on function public.variation_sales(uuid, timestamptz, smallint[]) to authenticated;

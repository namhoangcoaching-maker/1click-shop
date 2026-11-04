-- =============================================================================
-- 0007 – Hàm lấy số liệu cho trang Tổng quan. Chỉ GOM dữ liệu (cộng theo đơn / theo mã);
-- mọi công thức tiền (doanh thu, phí đơn hoàn, lợi nhuận) nằm ở src/lib/overview/compute.ts (có unit test).
-- security invoker: chạy bằng quyền người gọi → RLS chặn shop khác.
-- =============================================================================

-- Mỗi đơn một dòng, kèm tổng của các dòng hàng: giá trị hàng khách hoàn, giá vốn hàng giữ lại,
-- số lượng chưa có giá vốn (để cảnh báo "Dữ liệu cần kiểm tra").
create function public.overview_orders(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_statuses smallint[]
)
returns table (
  order_id text,
  inserted_at timestamptz,
  status smallint,
  source text,
  total_price bigint,
  total_discount bigint,
  fee_marketplace bigint,
  returned_value bigint,
  kept_cost bigint,
  kept_qty_without_cost bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.order_id,
         o.inserted_at,
         o.status,
         o.source,
         o.total_price,
         o.total_discount,
         o.fee_marketplace,
         coalesce(sum(oi.return_quantity::bigint * oi.retail_price), 0)::bigint,
         coalesce(sum(greatest(oi.quantity - oi.return_quantity, 0)::bigint * p.cost_price), 0)::bigint,
         coalesce(sum(case when p.cost_price is null then greatest(oi.quantity - oi.return_quantity, 0) else 0 end), 0)::bigint
  from public.orders o
  left join public.order_items oi on oi.org_id = o.org_id and oi.order_id = o.order_id
  left join public.products p on p.org_id = oi.org_id and p.variation_id = oi.variation_id
  where o.org_id = p_org_id
    and o.inserted_at >= p_start
    and o.inserted_at < p_end
    and o.status = any (p_statuses)
  group by o.order_id, o.inserted_at, o.status, o.source, o.total_price, o.total_discount, o.fee_marketplace
  order by o.inserted_at, o.order_id;
$$;

-- Số bán theo từng mã trong khoảng thời gian (cho Top sản phẩm). variation_id null = hàng chưa liên kết.
create function public.product_sales(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_statuses smallint[]
)
returns table (variation_id text, quantity bigint, returned bigint, gross bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select oi.variation_id,
         sum(oi.quantity)::bigint,
         sum(oi.return_quantity)::bigint,
         sum(greatest(oi.quantity - oi.return_quantity, 0)::bigint * oi.retail_price)::bigint
  from public.order_items oi
  join public.orders o on o.org_id = oi.org_id and o.order_id = oi.order_id
  where o.org_id = p_org_id
    and o.inserted_at >= p_start
    and o.inserted_at < p_end
    and o.status = any (p_statuses)
  group by oi.variation_id;
$$;

revoke execute on function public.overview_orders(uuid, timestamptz, timestamptz, smallint[]) from public, anon;
revoke execute on function public.product_sales(uuid, timestamptz, timestamptz, smallint[]) from public, anon;
grant execute on function public.overview_orders(uuid, timestamptz, timestamptz, smallint[]) to authenticated;
grant execute on function public.product_sales(uuid, timestamptz, timestamptz, smallint[]) to authenticated;

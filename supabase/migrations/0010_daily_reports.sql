-- =============================================================================
-- 0010 – Báo cáo hằng ngày lúc 8:00 (chủ dự án chốt 05/11/2026: không gửi Telegram,
-- xem trên web ở đầu trang Tổng quan + trang Báo cáo).
-- Mỗi shop mỗi ngày một bản "chụp" số liệu lúc 8:00, lưu để xem lại.
-- Máy chủ ghi (khóa secret); thành viên shop chỉ đọc (RLS).
-- =============================================================================

create table public.daily_reports (
  org_id uuid not null references public.organizations (id) on delete cascade,
  report_date date not null,              -- ngày báo cáo (giờ Việt Nam)
  data jsonb not null,                    -- nội dung báo cáo (xem src/lib/report/build.ts)
  created_at timestamptz not null default now(),
  primary key (org_id, report_date)
);

comment on table public.daily_reports is 'Báo cáo 8:00 mỗi sáng của từng shop.';

revoke all on public.daily_reports from anon, authenticated;
grant select on public.daily_reports to authenticated;
alter table public.daily_reports enable row level security;
create policy "Thành viên xem báo cáo shop mình"
  on public.daily_reports for select to authenticated
  using (public.is_org_member(org_id));

import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountMenu, AccountMenuSkeleton } from "@/components/layout/account-menu";
import { NavListSkeleton } from "@/components/layout/nav-list";
import { NoOrgNotice } from "@/components/layout/no-org-notice";
import { RoleNav } from "@/components/layout/role-nav";
import { ShopCard, ShopCardSkeleton } from "@/components/layout/shop-card";

/**
 * Khung có menu trái cho mọi trang bên trong.
 * - Chưa đăng nhập: src/proxy.ts đã chuyển về /dang-nhap.
 * - Đăng nhập nhưng chưa thuộc shop nào: NoOrgNotice hiện dải thông báo đầu trang.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      shop={
        <Suspense fallback={<ShopCardSkeleton />}>
          <ShopCard />
        </Suspense>
      }
      nav={
        <Suspense fallback={<NavListSkeleton />}>
          <RoleNav part="main" />
        </Suspense>
      }
      settingsNav={
        <Suspense fallback={null}>
          <RoleNav part="settings" />
        </Suspense>
      }
      account={
        <Suspense fallback={<AccountMenuSkeleton />}>
          <AccountMenu />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <NoOrgNotice />
      </Suspense>
      {children}
    </AppShell>
  );
}

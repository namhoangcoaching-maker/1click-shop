import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountMenu, AccountMenuSkeleton } from "@/components/layout/account-menu";
import { NoOrgNotice } from "@/components/layout/no-org-notice";
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

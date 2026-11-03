import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AccountMenu, AccountMenuSkeleton } from "@/components/layout/account-menu";

// Tạm thời cố định shop dùng thử. Bước 0.5 sẽ lấy tên và logo từ doanh nghiệp của người đăng nhập.
const DEMO_SHOP = { name: "Ecobath", subtitle: "Khách dùng thử" };

/**
 * Khung có menu trái cho mọi trang bên trong.
 * Chỉ người đã đăng nhập mới vào được (src/proxy.ts chặn trước).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      shop={DEMO_SHOP}
      account={
        <Suspense fallback={<AccountMenuSkeleton />}>
          <AccountMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

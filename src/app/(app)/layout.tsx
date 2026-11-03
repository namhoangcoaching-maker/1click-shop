import { AppShell } from "@/components/layout/app-shell";

// Tạm thời cố định shop dùng thử. Bước 0.5 sẽ lấy tên và logo từ doanh nghiệp của người đăng nhập.
const DEMO_SHOP = { name: "Ecobath", subtitle: "Khách dùng thử" };

/** Khung có menu trái cho mọi trang bên trong (sau này: chỉ khi đã đăng nhập). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell shop={DEMO_SHOP}>{children}</AppShell>;
}

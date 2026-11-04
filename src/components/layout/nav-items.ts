import {
  BanknoteIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LandmarkIcon,
  NewspaperIcon,
  PlugIcon,
  SparklesIcon,
  UsersIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Menu chính bên trái. Muốn thêm/bớt/đổi thứ tự mục menu thì sửa ở đây. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboardIcon },
  { href: "/bao-cao", label: "Báo cáo", icon: ClipboardListIcon },
  { href: "/ton-kho", label: "Tồn kho", icon: WarehouseIcon },
  { href: "/content", label: "Content", icon: NewspaperIcon },
  { href: "/tao-noi-dung", label: "Tạo nội dung", icon: SparklesIcon },
  { href: "/nhan-su", label: "Nhân sự", icon: UsersIcon },
  { href: "/thue", label: "Thuế", icon: LandmarkIcon },
  { href: "/dong-tien", label: "Dòng tiền", icon: BanknoteIcon },
];

/** Mục cài đặt ở cuối menu. */
export const SETTINGS_NAV: NavItem[] = [{ href: "/ket-noi", label: "Kết nối", icon: PlugIcon }];

/** Mục đang mở: "/" chỉ khớp đúng trang chủ, các mục khác khớp cả trang con. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

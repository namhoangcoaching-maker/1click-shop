import {
  BanknoteIcon,
  ClipboardListIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LandmarkIcon,
  NewspaperIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/lib/org/roles";

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

/** Trang chính cá nhân của mọi người (chấm công, công việc, ngày công, KPI, lương dự kiến của mình). */
export const PERSONAL_NAV: NavItem = { href: "/cua-toi", label: "Của tôi", icon: UserRoundIcon };
/** Thông tin tài khoản, đổi mật khẩu. */
export const ACCOUNT_NAV: NavItem = { href: "/tai-khoan", label: "Tài khoản", icon: KeyRoundIcon };
/** Thêm nhân sự, cấu hình chấm công / ca / lương / KPI từng người, địa điểm chấm công (Chủ, Quản lý). */
export const STAFF_CONFIG_NAV: NavItem = { href: "/nhan-su/cau-hinh", label: "Cấu hình nhân sự", icon: SlidersHorizontalIcon };

/** Trang chủ của Nhân viên (Tổng quan và các trang số liệu chỉ dành cho Chủ / Quản lý). */
export const STAFF_HOME = PERSONAL_NAV.href;

/**
 * Phân quyền trang (Giai đoạn 6.1, chủ dự án duyệt 05/11/2026):
 * - Chủ shop, Quản lý: mọi trang.
 * - Nhân viên: CHỈ trang của mình ("Của tôi"; sau này Chấm công, Công việc). Không thấy số tiền, tồn kho, kết nối.
 * Database cũng chặn riêng (RLS migration 0013), đây là lớp thứ hai cho menu và trang.
 */
const STAFF_PAGES = [PERSONAL_NAV.href, ACCOUNT_NAV.href];

export function canAccess(role: OrgRole, pathname: string): boolean {
  if (role !== "staff") return true;
  return STAFF_PAGES.some((href) => isActive(href, pathname));
}

/** Menu theo vai trò: mục chính (đầu) và mục cài đặt (cuối). */
export function navFor(role: OrgRole): { main: NavItem[]; settings: NavItem[] } {
  if (role === "staff") return { main: [PERSONAL_NAV], settings: [ACCOUNT_NAV] };
  return { main: [...MAIN_NAV, PERSONAL_NAV], settings: [STAFF_CONFIG_NAV, ...SETTINGS_NAV, ACCOUNT_NAV] };
}

/** Tra mục menu theo đường dẫn (để máy chủ chỉ gửi đường dẫn, trình duyệt tự gắn biểu tượng). */
export const NAV_BY_HREF: Record<string, NavItem> = Object.fromEntries(
  [...MAIN_NAV, ...SETTINGS_NAV, PERSONAL_NAV, ACCOUNT_NAV, STAFF_CONFIG_NAV].map((i) => [i.href, i]),
);

/** Mục menu đang mở = mục khớp DÀI NHẤT (ở /nhan-su/cau-hinh chỉ sáng "Cấu hình nhân sự", không sáng cả "Nhân sự"). */
export function activeHref(pathname: string): string | null {
  return (
    Object.keys(NAV_BY_HREF)
      .filter((h) => isActive(h, pathname))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/** Mục đang mở: "/" chỉ khớp đúng trang chủ, các mục khác khớp cả trang con. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

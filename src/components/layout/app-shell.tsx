"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIN_NAV, SETTINGS_NAV, isActive, type NavItem } from "./nav-items";

interface Shop {
  name: string;
  /** Dòng nhỏ dưới tên shop. */
  subtitle: string;
  /** Đường dẫn logo shop; chưa có thì hiện chữ cái đầu. */
  logoUrl?: string;
}

/**
 * Khung chung của mọi trang sau khi đăng nhập: menu trái kiểu Pancake + nội dung.
 * Trên điện thoại, menu thu vào nút ☰ ở thanh trên cùng.
 */
export function AppShell({ shop, children }: { shop: Shop; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Đóng menu điện thoại bằng phím Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh">
      {/* Menu cố định bên trái trên màn hình lớn */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r bg-card lg:block">
        <Sidebar shop={shop} pathname={pathname} />
      </aside>

      {/* Menu trượt ra trên điện thoại */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-64 max-w-[85vw] bg-card shadow-xl">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMenuOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-5" />
            </button>
            <Sidebar shop={shop} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-card px-2 lg:hidden">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-2 hover:bg-muted"
          >
            <MenuIcon className="size-5" />
          </button>
          <Logo />
        </header>
        {children}
      </div>
    </div>
  );
}

function Sidebar({
  shop,
  pathname,
  onNavigate,
}: {
  shop: Shop;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Menu chính" className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Logo />
      </div>

      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-2">
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo shop do khách tải lên, kích thước nhỏ
          <img src={shop.logoUrl} alt="" className="size-8 rounded-md object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-700 text-xs font-bold text-white">
            {shop.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{shop.name}</div>
          <div className="truncate text-xs text-muted-foreground">{shop.subtitle}</div>
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </ul>

      <ul className="space-y-0.5 border-t px-3 py-3">
        {SETTINGS_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(item.href, pathname);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-4.5 shrink-0" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        1C
      </span>
      <span className="text-base font-bold">1Click</span>
    </Link>
  );
}

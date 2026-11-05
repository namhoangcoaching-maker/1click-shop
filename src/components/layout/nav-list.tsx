"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { NAV_BY_HREF, activeHref, type NavItem } from "./nav-items";

/** AppShell cung cấp hàm đóng menu điện thoại; bấm một mục thì menu tự đóng. */
export const MenuCloseContext = createContext<(() => void) | undefined>(undefined);

/**
 * Danh sách mục menu theo đường dẫn. Máy chủ quyết định đường dẫn nào được hiện (theo vai trò),
 * trình duyệt gắn biểu tượng và tô sáng mục đang mở.
 */
export function NavList({ hrefs, className }: { hrefs: string[]; className?: string }) {
  const pathname = usePathname();
  const items = hrefs.map((h) => NAV_BY_HREF[h]).filter((i): i is NavItem => Boolean(i));
  if (items.length === 0) return null;
  return (
    <ul className={className}>
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </ul>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const onNavigate = useContext(MenuCloseContext);
  const active = activeHref(pathname) === item.href;
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

/** Khung xám trong lúc chờ biết vai trò. */
export function NavListSkeleton() {
  return (
    <ul className="space-y-1.5 px-3 pt-1" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </ul>
  );
}

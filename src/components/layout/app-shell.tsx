"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { MenuCloseContext } from "./nav-list";

/**
 * Khung chung của mọi trang sau khi đăng nhập: menu trái kiểu Pancake + nội dung.
 * Trên điện thoại, menu thu vào nút ☰ ở thanh trên cùng.
 */
export function AppShell({
  shop,
  account,
  nav,
  settingsNav,
  children,
}: {
  /** Menu chính theo vai trò (máy chủ quyết định mục nào được hiện). */
  nav: React.ReactNode;
  /** Mục cài đặt cuối menu theo vai trò. */
  settingsNav: React.ReactNode;
  /** Ô tên shop + vai trò ở đầu menu (đọc database), do layout máy chủ truyền vào. */
  shop: React.ReactNode;
  /** Khối tài khoản (email + Đăng xuất) ở cuối menu, do layout máy chủ truyền vào. */
  account?: React.ReactNode;
  children: React.ReactNode;
}) {
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
        <Sidebar shop={shop} account={account} nav={nav} settingsNav={settingsNav} />
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
            <MenuCloseContext.Provider value={() => setMenuOpen(false)}>
              <Sidebar shop={shop} account={account} nav={nav} settingsNav={settingsNav} />
            </MenuCloseContext.Provider>
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
  account,
  nav,
  settingsNav,
}: {
  shop: React.ReactNode;
  account?: React.ReactNode;
  nav: React.ReactNode;
  settingsNav: React.ReactNode;
}) {
  return (
    <nav aria-label="Menu chính" className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Logo />
      </div>

      {shop}

      <div className="flex-1 overflow-y-auto">{nav}</div>

      {settingsNav}

      {account && <div className="border-t px-1 py-2">{account}</div>}
    </nav>
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

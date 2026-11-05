import { getCurrentOrg } from "@/lib/org/current";
import { navFor } from "./nav-items";
import { NavList } from "./nav-list";

/** Menu theo vai trò (máy chủ đọc vai trò rồi chỉ gửi các mục được phép). Chưa thuộc shop: menu của Nhân viên. */
export async function RoleNav({ part }: { part: "main" | "settings" }) {
  const org = await getCurrentOrg();
  const nav = navFor(org?.role ?? "staff");
  const items = part === "main" ? nav.main : nav.settings;
  return (
    <NavList
      hrefs={items.map((i) => i.href)}
      className={part === "main" ? "space-y-0.5 px-3" : "space-y-0.5 border-t px-3 py-3"}
    />
  );
}

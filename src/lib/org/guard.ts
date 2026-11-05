import "server-only";
import { redirect } from "next/navigation";
import { STAFF_HOME } from "@/components/layout/nav-items";
import { getCurrentOrg, type CurrentOrg } from "./current";

/**
 * Dùng ở đầu phần tải dữ liệu của các trang số liệu (Tổng quan, Báo cáo, Tồn kho, Dòng tiền, Kết nối, Nhân sự).
 * Nhân viên mở các trang này (gõ thẳng đường dẫn) → chuyển về trang "Của tôi" TRƯỚC khi đọc bất kỳ số liệu nào
 * (kể cả số Pancake đọc bằng khóa secret, không qua RLS).
 * Trả về null khi chưa thuộc shop (trang tự hiện dải thông báo như cũ).
 */
export async function getManagerOrg(): Promise<CurrentOrg | null> {
  const org = await getCurrentOrg();
  if (org?.role === "staff") redirect(STAFF_HOME);
  return org;
}

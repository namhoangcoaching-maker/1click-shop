import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Kết nối" };

export default function ConnectionsPage() {
  return (
    <ComingSoon
      title="Kết nối"
      stage="Bước 0.6"
      features={[
        "Danh sách nguồn dữ liệu: Pancake POS, Pancake Page, Facebook, Instagram, TikTok, YouTube…",
        "Nhập API key và Shop ID của Pancake POS; khóa được mã hóa, không hiện lại đầy đủ",
        "Trạng thái từng kết nối: chưa kết nối, đã kết nối, lỗi",
      ]}
    />
  );
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Content" };

export default function ContentPage() {
  return (
    <ComingSoon
      title="Content"
      stage="Giai đoạn 4"
      features={[
        "Cấu hình thương hiệu: câu chuyện, khách hàng mục tiêu, gu hình ảnh và giọng văn, ảnh/video tham chiếu",
        "Kế hoạch content tháng (30–60 bài) dạng bảng, hai tab Hình ảnh và Video",
        "Tự lấy số liệu view, tim, share, lưu, bình luận từ link bài đăng",
        "AI đề xuất làm tiếp dạng nào dựa trên lượt view; tích “Muốn làm tiếp” cho tháng sau",
      ]}
    />
  );
}

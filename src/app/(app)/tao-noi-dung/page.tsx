import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Tạo nội dung" };

export default function CreateContentPage() {
  return (
    <ComingSoon
      title="Tạo nội dung"
      stage="Giai đoạn 5"
      features={[
        "Tạo ảnh và video bằng Higgsfield từ prompt trong kế hoạch Content hoặc nhập tự do",
        "Chọn model, tỷ lệ khung hình, xem chi phí ước tính trước khi tạo",
        "Hạn mức lượt tạo (credit) theo gói, hiển thị credit còn lại",
        "Thư viện lưu kết quả, gắn với dòng content tương ứng",
      ]}
    />
  );
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Thuế" };

export default function TaxPage() {
  return (
    <ComingSoon
      title="Thuế"
      stage="Giai đoạn 7"
      features={[
        "Tỷ lệ đơn đã xuất hóa đơn trên tổng đơn bán ra",
        "Danh sách hóa đơn cần điều chỉnh và đơn chưa xuất hóa đơn, có link sang Pancake",
        "Lịch thuế: hạn điều chỉnh, khai và nộp thuế; nhắc trước 7 ngày và 1 ngày",
        "Tự xác định nghĩa vụ theo loại hình (hộ kinh doanh/công ty) và doanh thu năm trước",
        "Quy định thuế lưu thành bảng có ngày hiệu lực, cập nhật được khi luật đổi",
      ]}
    />
  );
}

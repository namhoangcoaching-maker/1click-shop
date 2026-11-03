import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Dòng tiền" };

export default function CashflowPage() {
  return (
    <ComingSoon
      title="Dòng tiền"
      stage="Giai đoạn 3"
      features={[
        "Thu: doanh thu theo kênh, thanh toán online, COD đã và chưa đối soát, tiền sàn về",
        "Chi phí: lương, quảng cáo từng kênh, phiếu chi Pancake, nhập hàng, phí sàn",
        "Công nợ: phải thu khách hàng, phải trả nhà cung cấp",
        "Kết quả thu trừ chi theo ngày và tháng, dự báo và cảnh báo sắp thiếu tiền",
      ]}
    />
  );
}

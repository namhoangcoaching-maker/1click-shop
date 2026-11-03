import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Nhân sự" };

export default function StaffPage() {
  return (
    <ComingSoon
      title="Nhân sự"
      stage="Giai đoạn 6"
      features={[
        "Chấm công check-in/check-out bằng điện thoại (GPS hoặc wifi); máy ZKTeco làm sau",
        "Lương: ngày công, phụ cấp, bảo hiểm",
        "KPI dạng cấu hình: % doanh số, theo số lượng, bậc thang, tỷ lệ hoàn thành, trừ phạt",
        "Nhân viên xem lương tạm tính đến hôm nay và còn thiếu bao nhiêu để lên bậc thưởng",
        "Hiệu suất theo nhân viên: đơn chốt, doanh số, tỷ lệ chốt",
      ]}
    />
  );
}

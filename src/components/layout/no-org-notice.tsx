import { StoreIcon } from "lucide-react";
import { getCurrentOrg } from "@/lib/org/current";

/**
 * Dải thông báo đầu trang khi tài khoản đã đăng nhập nhưng chưa thuộc shop nào.
 * Không chặn nội dung trang: dữ liệu thật luôn được RLS trên database lọc theo shop,
 * nên người chưa có shop sẽ không thấy số liệu của ai.
 */
export async function NoOrgNotice() {
  const org = await getCurrentOrg();
  if (org) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 lg:mx-6"
    >
      <StoreIcon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">Tài khoản chưa được gắn vào shop</p>
        <p className="mt-0.5 text-muted-foreground">
          Bạn đã đăng nhập nhưng chưa thuộc shop nào, nên chưa có dữ liệu thật để xem. Liên hệ quản trị
          1Click để được thêm vào shop.
        </p>
      </div>
    </div>
  );
}

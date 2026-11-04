"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncPancakeNow } from "@/lib/connections/actions";
import { cn } from "@/lib/utils";

/**
 * Nút "Tải lại": lấy đơn hàng, tồn kho mới nhất từ Pancake rồi tính lại số liệu của trang,
 * giữ nguyên bộ lọc. `sync={false}` thì chỉ tải lại trang.
 */
export function RefreshButton({ sync = true }: { sync?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="h-9 bg-card px-3 font-normal"
      onClick={() =>
        startTransition(async () => {
          if (sync) await syncPancakeNow();
          router.refresh();
        })
      }
      disabled={isPending}
      title={sync ? "Lấy số liệu mới nhất từ Pancake" : undefined}
    >
      <RotateCwIcon className={cn(isPending && "animate-spin")} aria-hidden />
      {isPending && sync ? "Đang lấy từ Pancake…" : "Tải lại"}
    </Button>
  );
}

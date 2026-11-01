"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Nút "Tải lại": lấy lại số liệu mới nhất của trang mà không mất bộ lọc. */
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="h-9 bg-card px-3 font-normal"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
    >
      <RotateCwIcon className={cn(isPending && "animate-spin")} aria-hidden />
      Tải lại
    </Button>
  );
}

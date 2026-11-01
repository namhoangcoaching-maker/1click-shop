import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          1C
        </div>
        <h1 className="text-2xl font-bold">1Click</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Quản trị vận hành cho doanh nghiệp nhỏ và chủ shop online.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Dự án đã khởi tạo thành công – Giai đoạn 0.
        </p>
        <Link href="/design" className={buttonVariants({ className: "mt-6" })}>
          Xem mẫu giao diện
        </Link>
      </div>
    </main>
  );
}

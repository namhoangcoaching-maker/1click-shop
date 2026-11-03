import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** Chặn người chưa đăng nhập và làm mới phiên đăng nhập (xem lib/supabase/proxy.ts). */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Bỏ qua file tĩnh (ảnh, css, js) để không tốn thời gian kiểm tra đăng nhập.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

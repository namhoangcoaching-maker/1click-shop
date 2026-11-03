import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import { LOGIN_PATH, isPublicPath } from "@/lib/auth/paths";

/**
 * Chạy trước mỗi lượt mở trang:
 * 1. Làm mới phiên đăng nhập (cookie) nếu sắp hết hạn.
 * 2. Chưa đăng nhập mà mở trang bên trong → chuyển sang trang Đăng nhập.
 * 3. Đã đăng nhập mà mở trang Đăng nhập → về Tổng quan.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // getClaims() kiểm tra chữ ký của phiên, không tin cookie mù quáng.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = LOGIN_PATH;
    target.search = "";
    if (pathname !== "/") target.searchParams.set("next", pathname + search);
    return redirectWithCookies(target, response);
  }

  if (signedIn && pathname === LOGIN_PATH) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return redirectWithCookies(target, response);
  }

  return response;
}

/** Chuyển trang nhưng giữ cookie phiên vừa làm mới. */
function redirectWithCookies(target: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

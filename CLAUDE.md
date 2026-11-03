# 1Click – ghi chú cho Claude Code

Dự án: web SaaS **1Click** giúp shop nhỏ ở Việt Nam quản trị vận hành (tổng hợp số liệu từ Pancake POS, phân tích, đề xuất). Khách dùng thử đầu tiên: shop **Ecobath** (phụ kiện nhà tắm inox, bán Shopee/TikTok Shop).

**Đọc trước khi làm:** `PROJECT_BRIEF.md` (yêu cầu gốc, lộ trình 9 giai đoạn), `HUONG_DAN.md` (bản đồ thư mục, cách chạy), `AGENTS.md` (lưu ý Next.js 16), `git log --oneline`.

## Cách làm việc với chủ dự án

- Chủ dự án **không phải lập trình viên**, giao tiếp **tiếng Việt**, kiểm tra kết quả bằng trình duyệt và ảnh chụp màn hình.
- Làm **từng bước nhỏ**. Trước mỗi bước: trình bày kế hoạch ngắn và **chờ đồng ý**. Sau mỗi bước: chạy `npm test`, `npm run lint`, `npm run build`, tự chụp màn hình kiểm tra (Edge headless), **commit**, **cập nhật `HUONG_DAN.md`**, hướng dẫn chủ dự án tự kiểm tra trên trình duyệt, và **cập nhật mục "Tiến độ" bên dưới**.
- Khung chat chỉ để trò chuyện: tin nhắn **không dán code**, giải thích bằng lời và gửi link file bấm được.
- Thiếu thông tin (API key, tài liệu API, quyết định nghiệp vụ) thì dừng lại hỏi, không tự bịa. Không bao giờ yêu cầu dán khóa bí mật vào chat: hướng dẫn dán vào `.env.local`.
- Máy chủ dự án: Windows, PowerShell chặn `npm.ps1` → dùng `npm.cmd` hoặc bảo họ chạy `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Kỹ thuật

- Next.js 16.4 App Router, **cacheComponents bật**: phần phụ thuộc "hôm nay"/bộ lọc phải nằm trong `<Suspense>` và gọi `await connection()` trước khi dùng `new Date()`. Đọc tài liệu trong `node_modules/next/dist/docs/` trước khi dùng API lạ.
- Tailwind 4, shadcn style base-nova (dựa trên Base UI, không phải Radix), Recharts, Vitest (`src/**/*.test.ts`).
- Trang có menu nằm trong `src/app/(app)/`; menu ở `src/components/layout/nav-items.ts`.
- **Mọi phép tính tiền/tồn kho/thuế do code làm và có unit test**; "Đề xuất của AI" là quy tắc trong code, AI chỉ diễn giải.
- Số liệu hiện là **giả** (`src/lib/overview/demo-data.ts`); kiểu dữ liệu thật ở `src/lib/overview/types.ts`.

## Quyết định đã chốt

- Giao diện **giống Pancake POS** (chủ dự án chê bản đầu "trông AI quá"): thẻ trắng phẳng, icon tròn màu, tiền `1.250.000 ₫`, % 2 số lẻ, tăng xanh lá / giảm đỏ.
- Thời gian sản xuất mỗi sản phẩm đọc từ ô **"Ghi chú nội bộ"** trên Pancake, quy ước `SX: 8`; chưa ghi → 7 ngày mặc định + cảnh báo. Tên trường trong API Pancake **chưa xác minh** (chờ API key, Giai đoạn 1).
- Ngưỡng tồn kho: dự phòng 3 ngày; bán chậm khi đủ bán > 90 ngày; sản xuất đủ bán **21 ngày** (sợ tồn). Quảng cáo cao khi > 12% tổng doanh thu hoặc > 25% doanh thu một kênh.
- Đăng nhập: email + mật khẩu và Google. Số điện thoại để sau (cần nhà cung cấp SMS trả phí).
- **Chưa mở đăng ký công khai** (chủ dự án chọn): "Allow new users to sign up" trên Supabase để TẮT, không làm trang Đăng ký; tài khoản do chủ dự án tạo tay (Authentication → Users → Add user, tích Auto Confirm). Xác nhận email đang bật.
- Supabase dùng bản trên mạng (project **1Click**, region Seoul `ap-northeast-2`, gói Free), không cài trên máy. Khóa đã điền trong `.env.local` (URL, publishable, secret).
- Repo GitHub tên `1click` **đã bị dự án khác dùng** (idea.1click, ở `Documents\1click-tim-bai-hot`) → khi đưa dự án này lên GitHub ở Bước 0.7 phải đặt tên khác (ví dụ `1click-shop`), hỏi chủ dự án trước.

## Tiến độ

- ✅ 0.1 Khởi tạo · ✅ 0.2 Thiết kế kiểu Pancake + bản mẫu Tổng quan, Tồn kho, Đề xuất · ✅ 0.3 Menu trái
- ✅ 0.4 đợt 1: đăng nhập email + mật khẩu (`/dang-nhap`, `src/proxy.ts` chặn trang khi chưa đăng nhập, nút Đăng xuất cuối menu). Chưa kiểm tra được màn hình sau đăng nhập vì chưa có tài khoản: chờ chủ dự án tạo tài khoản và tự thử.
- ⏭️ 0.4 đợt 2: đăng nhập Google (cần tạo OAuth client trên Google Cloud, hướng dẫn chủ dự án), có thể thêm trang đổi mật khẩu.
- Sau đó: 0.5 schema nhiều doanh nghiệp + RLS + test · 0.6 trang Kết nối (lưu key Pancake mã hóa) · 0.7 GitHub + Vercel.

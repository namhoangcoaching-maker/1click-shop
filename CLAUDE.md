# 1Click – ghi chú cho Claude Code

Dự án: web SaaS **1Click** giúp shop nhỏ ở Việt Nam quản trị vận hành (tổng hợp số liệu từ Pancake POS, phân tích, đề xuất). Khách dùng thử đầu tiên: shop **Ecobath** (phụ kiện nhà tắm inox, bán Shopee/TikTok Shop) theo brief; **nhưng khóa Pancake thật chủ dự án dán là shop SUGAR CRUSH OFFICIAL** và họ chọn đổi tên shop trên 1Click thành Sugar Crush. Số liệu giả (demo-data) vẫn là sản phẩm Ecobath. Sugar Crush: thời trang nữ, shop tự thiết kế, thuê đơn vị thứ 3 sản xuất (mỗi màu/size là một mã).

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
- Số liệu Tổng quan/Tồn kho là **thật** (Pancake → Supabase). `demo-data.ts` đã xóa. Các khối Dòng tiền, Thuế, Content, Nhân sự, Quảng cáo hiện `NoDataPanel` (component cũ `cashflow-summary`, `tax-summary`, `top-content`, `staff-summary`, `ad-costs` giữ lại cho giai đoạn sau).

## Quyết định đã chốt

- Giao diện **giống Pancake POS** (chủ dự án chê bản đầu "trông AI quá"): thẻ trắng phẳng, icon tròn màu, tiền `1.250.000 ₫`, % 2 số lẻ, tăng xanh lá / giảm đỏ.
- Thời gian sản xuất mỗi sản phẩm đọc từ ô **"Ghi chú nội bộ"** trên Pancake, quy ước `SX: 8`; chưa ghi → 7 ngày mặc định + cảnh báo. Tên trường trong API Pancake **chưa xác minh** (chờ API key, Giai đoạn 1).
- Ngưỡng tồn kho **mỗi shop tự cấu hình** (bảng `inventory_settings`, trang Tồn kho → Cấu hình, **chỉ Chủ shop sửa**). Mặc định: dự phòng 3, sản xuất đủ bán **21**, SX mặc định 7, báo sớm 7, bán chậm 90, tốc độ bán 30 ngày. Sugar Crush (thời trang nữ, tự thiết kế, thuê xưởng ngoài may) giữ 3/21. Quảng cáo cao khi > 12% tổng doanh thu hoặc > 25% doanh thu một kênh (chưa cấu hình được).
- Đăng nhập: email + mật khẩu và Google. Số điện thoại để sau (cần nhà cung cấp SMS trả phí).
- **Chưa mở đăng ký công khai** (chủ dự án chọn): "Allow new users to sign up" trên Supabase để TẮT, không làm trang Đăng ký; tài khoản do chủ dự án tạo tay (Authentication → Users → Add user, tích Auto Confirm). Xác nhận email đang bật.
- Supabase dùng bản trên mạng, project **"Doanh nghiệp 1 người"** (ref `jpzwdpbbrivebjvkdria`, Sydney `ap-southeast-2`, gói Free), không cài trên máy. `.env.local` có URL, publishable, secret, `SUPABASE_DB_URL` (session pooler). **KHÔNG dùng project "1Click"** (`ldohuak…`): đó là database của web tìm bài hot idea.1click. Gói Free chỉ 2 project nên không tạo thêm được.
- Database: migration SQL trong `supabase/migrations/`, áp bằng `npm run db:migrate` (script tự viết, lưu vết ở `private.schema_migrations`). Tạo shop/gắn thành viên: `npm run db:add-member -- <email> "<shop>" <owner|manager|staff>`. Test RLS thật: `npm run test:db` (`*.dbtest.ts`, tạo/xóa user `@test.1click.local`).
- Người chưa thuộc shop: không chặn trang (chặn cả trang làm mất instant navigation), chỉ hiện dải `NoOrgNotice`; dữ liệu thật phải luôn đọc qua RLS bằng phiên người dùng.
- Chụp màn hình khi đã đăng nhập: script tạm dùng Edge headless + CDP, tạo user thử, đặt cookie `@supabase/ssr`, chụp rồi xóa user (Edge headless không thu được dưới ~500px: dùng `Emulation.setDeviceMetricsOverride`).
- Repo GitHub tên `1click` **đã bị dự án khác dùng** (idea.1click, ở `Documents\1click-tim-bai-hot`) → khi đưa dự án này lên GitHub ở Bước 0.7 phải đặt tên khác (ví dụ `1click-shop`), hỏi chủ dự án trước.

## Tiến độ

- ✅ 0.1 Khởi tạo · ✅ 0.2 Thiết kế kiểu Pancake + bản mẫu Tổng quan, Tồn kho, Đề xuất · ✅ 0.3 Menu trái
- ✅ 0.4 đợt 1: đăng nhập email + mật khẩu (`/dang-nhap`, `src/proxy.ts` chặn trang khi chưa đăng nhập, nút Đăng xuất cuối menu).
- ✅ 0.5: bảng `organizations` + `memberships` (vai trò owner/manager/staff), RLS, 13 test RLS thật; menu trái đọc tên shop + vai trò từ database. Shop trên 1Click đã đổi tên Ecobath → **Sugar Crush** (04/11/2026, chủ dự án chọn), Chủ = namhoangcoaching@gmail.com.
- ✅ Đã tắt đăng ký công khai ở project mới (kiểm tra 04/11/2026: thử đăng ký bị từ chối).
- ✅ 0.6: trang `/ket-noi` Pancake POS: kiểm tra khóa bằng `GET /shops?api_key=` (đúng: 200 `{success, shops:[{id,name}]}`; sai: 403 `{success:false, message:"api_key is invalid", error_code:105}` — đã thử thật), mã hóa AES-256-GCM (`ENCRYPTION_KEY` đã tự tạo trong `.env.local`, AAD = `orgId:provider`), bảng `connections` (migration 0002): authenticated KHÔNG có quyền SELECT cột `secret_ciphertext` (column grants), chỉ owner ghi. 20 test RLS. Đã kết nối khóa Pancake THẬT: shop "SUGAR CRUSH OFFICIAL" (ID 100252065), đã kiểm tra giải mã + gọi lại Pancake thành công.
- Tài liệu Pancake POS API: OpenAPI tại `https://docs.pancake.biz/pos/api/openapi.json?lang=en` (88 endpoint, auth `api_key` query). Đọc spec này trước khi gọi endpoint mới, không đoán tên trường.
- ✅ Cấu hình tồn kho theo shop (migration 0003, 25 test RLS, 92 unit test). `getDemoOverview` nhận `velocityWindowDays` để quy đổi số bán giả; dữ liệu thật Giai đoạn 1 phải lấy số bán đúng `rules.velocityWindowDays` ngày.
- ✅ 0.7: GitHub `namhoangcoaching-maker/1click-shop` (Private, remote `origin`), Vercel team `1click` project `1click-shop` (Hobby, tự deploy khi push `main`), tên miền **https://shop.nhankhoitu.com.vn** (Cloudflare CNAME `shop`, DNS only). 4 env trên Vercel. Đã kiểm tra trang sau đăng nhập trên production bằng user tạm. Còn chờ: chủ dự án đặt Supabase Auth → URL Configuration → Site URL = https://shop.nhankhoitu.com.vn.
- Giai đoạn 1 – quyết định (04/11/2026): **đơn chốt = trạng thái từ Đã xác nhận trở đi kể cả hoàn** (`CONFIRMED_STATUSES` trong `src/lib/pancake/map.ts`; bỏ Mới 0, Chờ hàng 11, Đã đặt 20, Hủy 6, Xóa 7); **giá vốn = `average_imported_price`**; lịch sử **90 ngày**. Không lưu PII khách.
- Pancake thực tế: mã đơn `id` là **CHỮ** với đơn sàn ("261104EK2E1FYN") → `orders.order_id text` (migration 0005; lỗi bỏ sót đã sửa, sync đếm `skipped`). `page_size` 500 được. `filter_status[]` (có ngoặc). Giờ Pancake là UTC không kèm "Z". "Ghi chú nội bộ" = `product.note` (`note_product` là mô tả). Tiền: `total_price` = tổng giá bán × SL (Doanh số); `total_price_after_sub_discount` = total − chiết khấu + ship − phí sàn; `fee_marketplace` = phí sàn; `partner_fee` = phí vận chuyển shop trả.
- ✅ 1.1: bảng `products`/`orders`/`order_items`/`sync_state` (chỉ đọc qua RLS, ghi bằng secret key), `runPancakeSync` (khóa chống chồng, sản phẩm 10 phút/lần, đơn theo `updated_at`, backfill 7 ngày/đợt), `/api/cron/pancake-sync` (Bearer `CRON_SECRET`, public path trong proxy), lịch Supabase pg_cron + pg_net (`npm run db:setup-cron`, secret trong Vault). Đã đối chiếu: 13.959 đơn 90 ngày khớp Pancake. Lịch pg_cron `pancake-sync-every-30-min` ĐÃ CÀI và thử gọi production thành công (04/11/2026); `CRON_SECRET` đã có trên Vercel. 302 dòng hàng không có variation_id, 65 trỏ mã đã xóa → đưa vào "Dữ liệu cần kiểm tra" ở 1.3.
- ✅ 1.2: Tồn kho số thật (`getRealInventory`: products + RPC `variation_sales` (security invoker, migration 0006) song song; số bán = đơn chốt − return_quantity; ẩn mã ngừng kinh doanh mặc định, `?all=1`; tồn âm → 0; `formatVelocity` "<0,1"). Sugar Crush: 426 mã, 33 ẩn, 47 báo động (nhiều mã bán <0,1/ngày vẫn báo hết hàng → có thể cần ngưỡng tối thiểu, chờ chủ dự án quyết). Mọi mã đang dùng SX mặc định 7 ngày (chưa ghi "SX:").
- Hiệu năng: database ở Sydney, mỗi lượt PostgREST từ VN ~250–500 ms → luôn hỏi song song; `vercel.json` regions `syd1`. Dev trên máy chậm (5–12 s/trang) là bình thường.
- Báo động tồn kho **gom theo mẫu** (chủ dự án yêu cầu): `groupStockAlarms` theo `productId`, `<details>` xổ ra mọi size (sắp xếp màu rồi `SIZE_ORDER`). Sugar Crush: 35 mẫu / 47 size thiếu.
- ✅ 1.3: Tổng quan số thật. Chủ dự án chốt: Doanh thu giống Pancake (đã trừ phí sàn), Lợi nhuận = Doanh thu − giá vốn; đơn hoàn không tính phí %, trừ phí cố định Shopee `RETURN_FEE_PER_ORDER` = 2.700 (PiShip theo Sapo, CHƯA xác nhận chính thức – nhờ chủ dự án đối chiếu). RPC `overview_orders`/`product_sales` (0007) chỉ gom, công thức ở `compute.ts`. Hàng hoàn tính theo ngày tạo đơn gốc. Nút Tải lại = `syncPancakeNow` + refresh. Recommendations gom restock theo mẫu.
- ⏭️ Tiếp theo: chờ chủ dự án đối chiếu số với Pancake. Sau đó Giai đoạn 2 (báo cáo Telegram). Sau đó Giai đoạn 1 (đồng bộ đơn/sản phẩm/tồn kho từ Pancake; đọc bản mã bằng khóa secret ở máy chủ). Để sau: đăng nhập Google, trang đổi mật khẩu.

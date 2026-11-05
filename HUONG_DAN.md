# HƯỚNG DẪN 1CLICK

> File này luôn được cập nhật sau mỗi bước. Nếu thấy chỗ nào không khớp với thực tế, hãy nhắn Claude Code: *"HUONG_DAN.md đang sai ở mục …, sửa lại giúp tôi"*.

**Tiến độ:** Giai đoạn 0 – Bước 0.1 (khởi tạo dự án) ✅ · Bước 0.2 (hệ thống thiết kế) ✅ · Bước 0.3 (menu trái) ✅ · Bước 0.4 (đăng nhập email, đợt 1) ✅ · Bước 0.5 (nhiều shop + khóa bảo vệ dữ liệu) ✅ · Bước 0.6 (trang Kết nối Pancake POS) ✅ · Cấu hình tồn kho theo shop ✅ · Bước 0.7 (GitHub + Vercel + tên miền) ✅ · **Giai đoạn 1** – Bước 1.1 (đồng bộ Pancake) ✅ · Bước 1.2 (Tồn kho số thật) ✅ · Bước 1.3 (Tổng quan số thật) ✅ · Kế hoạch đặt hàng theo lịch ✅ · Tiền về tự động ✅ · Báo cáo 8:00 hằng ngày ✅ · Kết quả theo tháng ✅ · Tiền chi theo ngày + phí ship ngoại sàn + báo cáo số mới ✅

---

## 1. Bản đồ thư mục

| Đường dẫn | Dùng để làm gì |
|---|---|
| `PROJECT_BRIEF.md` | Yêu cầu sản phẩm gốc. Muốn đổi yêu cầu lớn thì sửa ở đây và báo Claude Code. |
| `HUONG_DAN.md` | File bạn đang đọc. |
| `src/app/` | **Các trang web.** Mỗi thư mục con là một đường dẫn, ví dụ `src/app/thue/page.tsx` là trang `/thue`. |
| `src/app/layout.tsx` | Khung chung của mọi trang: font chữ, tiêu đề tab trình duyệt. |
| `src/app/(app)/` | **Các trang có menu trái.** Thư mục `(app)` có ngoặc nên không hiện trên đường dẫn: `src/app/(app)/thue/page.tsx` là trang `/thue`. |
| `src/app/(app)/layout.tsx` | Khung chung có menu trái: tên shop + vai trò (đọc từ database) ở góc trên, email + nút Đăng xuất ở cuối menu. |
| `src/components/layout/shop-card.tsx` | Ô tên shop + vai trò (Chủ shop / Quản lý / Nhân viên) ở đầu menu trái. |
| `src/components/layout/no-org-notice.tsx` | Dải thông báo vàng "Tài khoản chưa được gắn vào shop". |
| `src/lib/org/` | Lấy shop của người đang đăng nhập (`current.ts`), tên vai trò tiếng Việt (`roles.ts`). |
| `src/lib/rls.dbtest.ts` | **Test khóa bảo vệ dữ liệu** trên database thật, mỗi bảng một nhóm test. |
| `supabase/migrations/` | **Cấu trúc database**, mỗi file `.sql` là một lần thay đổi, đánh số thứ tự. `0001_organizations.sql`: bảng Doanh nghiệp, Thành viên và các khóa bảo vệ. `0002_connections.sql`: bảng Kết nối (khóa Pancake đã mã hóa). `0003_inventory_settings.sql`: bảng Cấu hình tồn kho. `0004`, `0005`: bảng Sản phẩm, Đơn hàng, Dòng hàng, Tiến độ đồng bộ. `0006`: hàm tính số đã bán theo mã. `0007`: hàm lấy số liệu Tổng quan (theo đơn, theo mã). `0008`: cấu hình kế hoạch đặt hàng + bảng Hàng sắp về. `0009`: ngày khách nhận/hoàn của đơn, COD, đơn vị vận chuyển + bảng Thu chi (tiền về). `0010`: bảng Báo cáo hằng ngày. Không sửa file đã chạy rồi; muốn đổi thì nhờ Claude Code tạo file mới. |
| `scripts/` | Lệnh quản trị chạy trên máy: áp cấu trúc database (`db-migrate.mjs`), gắn người vào shop (`db-add-member.mjs`). |
| `src/app/dang-nhap/` | **Trang Đăng nhập** (`/dang-nhap`): `page.tsx` là khung trang, `login-form.tsx` là ô nhập và nút. |
| `src/proxy.ts` | **Người gác cổng**: chạy trước mỗi lượt mở trang, chưa đăng nhập thì đưa về `/dang-nhap` (sau khi đăng nhập sẽ quay lại đúng trang định mở). |
| `src/lib/auth/` | Đăng nhập/đăng xuất (`actions.ts`), kiểm tra ô nhập và câu báo lỗi tiếng Việt (`login.ts`), danh sách trang không cần đăng nhập (`paths.ts`). |
| `src/lib/supabase/` | Kết nối tới Supabase (cơ sở dữ liệu + tài khoản). Thường không cần sửa. |
| `src/components/layout/account-menu.tsx` | Khối email + nút Đăng xuất ở cuối menu trái. |
| `src/app/(app)/page.tsx` | **Trang Tổng quan** (`/`, trang chủ, **số liệu thật** từ Pancake): thứ tự và cách xếp các khối, danh sách "Dữ liệu cần kiểm tra". |
| `src/lib/pancake/analytics.ts`, `src/lib/overview/pancake-stats.ts` | **Lấy số tiền từ Thống kê Pancake** (Doanh số, Doanh thu, Lợi nhuận, Đơn chốt, GTTB, Phí sàn, Nguồn đơn, Top sản phẩm kèm ảnh + mã mẫu) và xếp vào các khối Tổng quan. Danh sách số liệu lấy về nằm ở `SALE_FIELDS`. |
| `src/lib/overview/real-data.ts` | Lấy số liệu cho Tổng quan: gọi Thống kê Pancake (song song) + tồn kho đã đồng bộ. |
| `src/components/dashboard/no-data-panel.tsx` | Khối "Chưa có dữ liệu" cho mục chưa có nguồn (Dòng tiền, Thuế, Content, Nhân sự, Quảng cáo). |
| `src/app/(app)/content`, `tao-noi-dung`, `nhan-su`, `thue`, `dong-tien` | Các trang "Đang xây dựng", mỗi trang ghi sẵn tính năng sẽ có. |
| `src/app/(app)/ket-noi/` | **Trang Kết nối** (`/ket-noi`): `page.tsx` khung trang + danh sách "Sắp có", `pancake-form.tsx` ô dán khóa Pancake và nút Kiểm tra & lưu. |
| `src/lib/connections/` | Lưu / ngắt kết nối (`actions.ts`, chỉ Chủ shop), đọc trạng thái kết nối (`queries.ts`, không bao giờ đọc khóa). |
| `src/lib/pancake/shops.ts` | Gọi Pancake POS để kiểm tra khóa (lệnh "Thông tin cửa hàng") và câu báo lỗi tiếng Việt. Tài liệu API Pancake: https://docs.pancake.biz/pos/api/en |
| `src/app/(app)/dong-tien/page.tsx` | **Trang Dòng tiền** (`/dong-tien`): phần **Tiền về** (dự kiến 7 ngày tới; bảng chi tiết theo ngày/kênh bấm mới mở) + **Kết quả theo tháng** (Lợi nhuận kinh doanh, Dòng tiền thực tế, Thẻ chi phí) + Công nợ (sau). |
| `src/lib/finance/`, `src/components/finance/` | Tính và hiện Lợi nhuận kinh doanh / Dòng tiền thực tế theo tháng (`month.ts` có unit test), đặt tên thẻ phiếu chi (`tag-actions.ts`). |
| `src/lib/fx/` | Tỷ giá USD Vietcombank theo ngày (đổi tiền Shopify), lưu bảng `fx_rates`. |
| `src/app/(app)/bao-cao/page.tsx`, `src/components/report/daily-report.tsx` | **Báo cáo hằng ngày 8:00**: trang Báo cáo (30 ngày) và khối đầu trang Tổng quan. |
| `src/lib/report/` | Ghép báo cáo (`build.ts`: kết quả hôm qua, tiền về, đặt hàng, việc cần làm) và lập/lưu báo cáo (`generate.ts`). |
| `src/app/api/cron/daily-report/route.ts` | Địa chỉ lịch 8:00 gọi vào (đồng bộ nhanh rồi lập báo cáo cho mọi shop). |
| `src/lib/cash/compute.ts` | **Luật tiền về**: số ngày sau khi khách nhận của từng kênh (`CASH_RULES`: Shopee 4, TikTok 7, ĐVVC ngoại sàn 3), tên đơn vị vận chuyển (`CARRIER_NAMES`), trừ hoàn sau khi nhận. |
| `src/lib/cash/data.ts`, `src/components/cash/cash-in.tsx` | Đọc dữ liệu tiền về; khối **Tiền về** ở Tổng quan và bảng ở trang Dòng tiền. |
| `src/lib/pancake/map.ts` | **Đọc dữ liệu Pancake**: tên trường của sản phẩm, đơn hàng; bảng **trạng thái đơn** (Mới, Đã xác nhận, Đã nhận, Đã hoàn…); đơn nào tính là **đơn chốt** (`CONFIRMED_STATUSES`). |
| `src/lib/pancake/sync.ts`, `sync-plan.ts` | **Đồng bộ** Pancake → database: sản phẩm/tồn kho mỗi 10 phút, đơn mới/vừa đổi trạng thái, lấy dần lịch sử 90 ngày (số ngày nằm ở `SYNC_RULES`). |
| `src/app/api/cron/pancake-sync/route.ts` | Địa chỉ lịch tự động gọi vào (có mật khẩu `CRON_SECRET`). |
| `src/app/(app)/ket-noi/sync-button.tsx` | Nút **Đồng bộ ngay** trên trang Kết nối. |
| `src/lib/supabase/admin.ts` | Kết nối Supabase bằng khóa secret, **chỉ** cho việc nền (đồng bộ). Không dùng để hiện dữ liệu cho người dùng. |
| `src/lib/crypto/secret-box.ts` | **Mã hóa khóa API của khách** trước khi lưu (AES-256-GCM, dùng `ENCRYPTION_KEY`). |
| `src/components/layout/nav-items.ts` | **Danh sách mục menu trái**: thêm, bớt, đổi tên, đổi thứ tự, đổi biểu tượng ở đây. |
| `src/components/layout/app-shell.tsx` | Giao diện menu trái và nút ☰ trên điện thoại. |
| `src/components/overview/` | **Từng khối của trang Tổng quan**, mỗi khối một file: `summary-cards` (Hàng chốt, Hàng hoàn, Tồn kho), `order-sources` (Nguồn đơn), `cashflow-summary` (Dòng tiền), `tax-summary` (Thuế), `top-products` (Top 5 SP), `ad-costs` (Chi phí QC), `top-content` (Content), `staff-summary` (Nhân sự). |
| `src/components/dashboard/panel.tsx` | Khung **thẻ trắng** có biểu tượng tròn, ô xám bên trong, thanh tiến độ. |
| `src/components/dashboard/metric-strip.tsx` | **Dải chỉ số** Doanh số / Doanh thu / Lợi nhuận… bấm vào để đổi biểu đồ. |
| `src/components/dashboard/trend-chart.tsx` | **Biểu đồ đường** kỳ này (xanh) và kỳ trước (xám nét đứt). |
| `src/app/(app)/ton-kho/page.tsx` | **Trang Tồn kho · Kế hoạch đặt hàng** (`/ton-kho`): Cần sản xuất ngay, 4 mục nhắc đặt (cuối tháng, 16, 10, 20), Hàng sắp về. |
| `src/lib/inventory/plan.ts` | **Công thức kế hoạch đặt hàng**: lịch đặt, đủ bán tới đâu, tối thiểu/size, thời gian sản xuất theo số lượng, âm kho tối đa, mã bán chậm. |
| `src/lib/inventory/incoming*.ts`, `src/components/inventory/plan-variants.tsx`, `incoming-list.tsx` | **Hàng sắp về**: bảng từng size có cột "Đặt thực tế" + ngày về thực tế + nút "Đã đặt"; danh sách hàng sắp về, nút "Đã về". |
| `src/components/inventory/order-plan.tsx` | Giao diện Cần sản xuất ngay và ngày đặt gần nhất. Ngày đặt (mùng 5, 16, 20, cuối tháng) nằm ở `orderDaysInMonth` trong `src/lib/inventory/plan.ts`. |
| `src/lib/inventory/alarms.ts` | Thứ tự size S, M, L… (`SIZE_ORDER`) và tách màu/size. |
| `src/lib/inventory/real-data.ts`, `real-stock.ts` | Lấy tồn kho thật: sản phẩm + số bán thực (đơn chốt trừ hàng hoàn) theo từng mã; quy tắc "ngừng kinh doanh" (hết hàng và 90 ngày không bán, hoặc ẩn trên Pancake). |
| `src/components/inventory/` | Bảng tồn kho và nhãn trạng thái (Hết hàng, Sản xuất ngay, Sắp đến hạn, Bán chậm, Đủ hàng). |
| `src/lib/inventory/stock.ts` | **Công thức tồn kho**: tốc độ bán, số ngày đủ bán, khi nào phải sản xuất, nên sản xuất bao nhiêu. Số **mặc định** cho shop chưa cấu hình nằm ở `STOCK_RULES` đầu file. |
| `src/lib/inventory/settings.ts` | Danh sách 6 ô **Cấu hình tồn kho** (tên, giải thích, giới hạn nhỏ nhất/lớn nhất). Muốn đổi câu giải thích hay giới hạn thì sửa ở đây (giới hạn phải sửa cả trong database, nhờ Claude Code). |
| `src/components/inventory/stock-settings.tsx` | Nút **Cấu hình** và khung nhập trên trang Tồn kho. |
| `src/lib/overview/recommendations.ts` | **Quy tắc "Đề xuất của AI"**: cần sản xuất, tập trung content, xả kho, chi phí quảng cáo cao. Các ngưỡng nằm ở `RECOMMENDATION_RULES` đầu file. |
| `src/components/overview/recommendations.tsx` | Giao diện khối Đề xuất. |
| `src/lib/overview/types.ts` | Danh sách các con số mà trang Tổng quan cần. |
| `src/app/globals.css` | **Màu sắc** toàn web (xanh dương nhấn, xanh lá tăng, đỏ giảm, cam cảnh báo, nền xám). Đổi màu thì sửa phần `:root` ở đây. |
| `src/components/ui/` | Các khối giao diện có sẵn (nút, ô nhập, thẻ…) của shadcn/ui. Thường không cần sửa. |
| `src/components/dashboard/stat-card.tsx` | **Khối số** (nhãn xám, số to, ↑/↓ %). Rê chuột để xem giá trị kỳ trước. |
| `src/components/dashboard/trend-badge.tsx` | Mũi tên ↑/↓ % màu xanh/đỏ, dùng trong thẻ và bảng. |
| `src/components/dashboard/date-filter.tsx` | **Bộ lọc thời gian** "Hôm nay / 7 ngày qua…" và "So sánh với". |
| `src/components/dashboard/refresh-button.tsx` | Nút **Tải lại**: lấy đơn/tồn kho mới nhất từ Pancake rồi tính lại số. |
| `src/components/dashboard/data-warning.tsx` | **Khung "Dữ liệu cần kiểm tra"** (thiếu giá vốn, đơn không gán nhân viên…), bấm "Chi tiết" để xem cách sửa. |
| `src/lib/format.ts` | Cách hiển thị **tiền** (`1.250.000 ₫`), số, phần trăm (`42,37%`), và công thức % tăng giảm. |
| `src/lib/date-range.ts` | Tính khoảng ngày theo **giờ Việt Nam**: Hôm nay, 7 ngày qua, Tháng này… và kỳ so sánh. Muốn thêm lựa chọn thời gian mới thì sửa ở đây. |
| `src/lib/*.test.ts` | **Unit test**: kiểm tra tự động các công thức. Mỗi file `abc.ts` có file `abc.test.ts` đi kèm. |
| `public/` | Ảnh, logo tĩnh. |
| `.env.example` | **Mẫu** danh sách khóa bí mật cần có. Không chứa giá trị thật. |
| `.env.local` | **Khóa bí mật thật** (địa chỉ + khóa Supabase đã điền). Chỉ nằm trên máy bạn, không bao giờ lên GitHub. Sửa file này xong phải tắt `npm run dev` (`Ctrl + C`) và chạy lại mới có hiệu lực. |
| `package.json` | Danh sách thư viện và các lệnh `npm run …`. |
| `node_modules/` | Thư viện đã tải về. Không sửa. Lỡ xóa thì chạy `npm install` để tải lại. |

## 2. Chạy, dừng, xem lỗi

**Chạy web trên máy:**
1. Mở VS Code **đúng thư mục dự án**: File → Open Folder → `Documents\1click`.
2. Mở Terminal: menu **Terminal → New Terminal** (hoặc phím tắt ``Ctrl + ` ``). Dòng nhắc phải kết thúc bằng `\1click>`; nếu không, gõ `cd C:\Users\Admin\Documents\1click`.
3. Gõ `npm run dev` rồi Enter.
4. Khi thấy dòng `Local: http://localhost:3000`, mở trình duyệt vào địa chỉ đó.
5. Sửa code và lưu file (`Ctrl + S`): trình duyệt tự cập nhật, không cần chạy lại.

**Gặp lỗi đỏ "running scripts is disabled on this system"?** Windows đang chặn lệnh `npm`. Gõ `npm.cmd run dev` thay cho `npm run dev`; hoặc sửa hẳn một lần bằng lệnh `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (gõ `Y` khi được hỏi).

**Gặp "Another next dev server is already running"?** Web đã đang chạy sẵn (ví dụ do Claude Code bật), cứ mở http://localhost:3000 là được.

**Dừng:** bấm vào cửa sổ Terminal đó rồi nhấn `Ctrl + C`.

**Xem lỗi:**
- Lỗi phía server: hiện màu đỏ trong cửa sổ Terminal đang chạy `npm run dev`.
- Lỗi trên trang: Next.js hiện khung lỗi đỏ ngay trên trình duyệt; ngoài ra có thể nhấn `F12` → tab **Console**.
- Cách nhanh nhất: copy nguyên đoạn lỗi, dán cho Claude Code kèm câu *"Tôi gặp lỗi này khi …"*.

**Chạy test khóa bảo vệ dữ liệu trên database thật:** `npm run test:db` (cần mạng). Lệnh này tạo tạm vài tài khoản `@test.1click.local`, kiểm tra shop A không đọc/sửa được dữ liệu shop B, rồi tự xóa. Phải ra `44 passed` (hoặc nhiều hơn khi có thêm bảng).

**Chạy unit test:** `npm test`. Dòng cuối phải là `Tests  N passed`. Nếu có dòng `failed` nghĩa là một công thức đang tính sai: đừng đưa lên mạng, dán kết quả cho Claude Code.

**Kiểm tra trước khi đưa lên mạng:** `npm test` rồi `npm run build`. Cả hai không báo lỗi là ổn.

**Vì sao số liệu hiện khung xám một chút rồi mới ra số?** Đây là chủ ý: khung trang (tiêu đề, menu) hiện ngay, phần số liệu tải sau. Nhờ vậy trang luôn mở nhanh, kể cả khi lấy dữ liệu từ Pancake mất vài giây.

## 3. Tài khoản đăng nhập (Supabase)

Hiện **chưa mở đăng ký công khai**: chỉ người được bạn tạo tài khoản mới vào được web. Mọi trang (trừ `/dang-nhap`) đều bắt đăng nhập.

Database của web này là project Supabase **"Doanh nghiệp 1 người"** (mã `jpzwdpbbrivebjvkdria`, đặt ở Sydney). Project **1Click** là của web tìm bài hot (idea.1click), **không đụng vào** khi làm web này.

**Tạo tài khoản cho một người dùng:**
1. Vào supabase.com → project **Doanh nghiệp 1 người** → menu trái **Authentication** → **Users**.
2. Bấm **Add user** → **Create new user**.
3. Nhập email và mật khẩu, **tích ô "Auto Confirm User"** (nếu không tích, người đó phải bấm link xác nhận trong email mới đăng nhập được).
4. Bấm **Create user**, rồi gửi email + mật khẩu cho người đó (qua Zalo, nói họ đổi mật khẩu sau khi có tính năng đổi mật khẩu).

5. **Gắn người đó vào shop** (bắt buộc, nếu không họ chỉ thấy dải vàng "Tài khoản chưa được gắn vào shop"): trong Terminal VS Code gõ
   `npm.cmd run db:add-member -- email@cua-ho.com "Ecobath" staff`
   Thay `staff` bằng `manager` (Quản lý) hoặc `owner` (Chủ). Tên shop chưa có thì lệnh tự tạo shop mới. Gõ lại lệnh với vai trò khác để đổi vai trò. Hoặc nhờ Claude Code: *"Gắn tài khoản x@gmail.com vào shop Ecobath làm Quản lý"*.

**Hiện có:** shop **Sugar Crush** (trước đây đặt tạm tên Ecobath), Chủ là `namhoangcoaching@gmail.com`, đã kết nối Pancake shop SUGAR CRUSH OFFICIAL (ID 100252065).

**Vai trò:** Chủ shop (toàn quyền, thêm/bớt thành viên, sửa thông tin shop) · Quản lý · Nhân viên (chỉ xem; sau này chỉ thấy lương/KPI của mình). Mỗi shop luôn phải còn ít nhất một Chủ.

**Khóa bảo vệ dữ liệu (RLS):** quy tắc nằm ngay trong database: người của shop nào chỉ đọc được dữ liệu shop đó, kể cả khi code web có lỗi. Chỉ quản trị 1Click (dùng khóa secret trên máy) mới tạo được shop mới.

**Quên mật khẩu / đổi mật khẩu cho ai đó:** Authentication → Users → bấm vào người đó → **Reset password** (gửi email đặt lại) hoặc xóa và tạo lại.

**Khóa một người:** Authentication → Users → bấm dấu ⋮ ở dòng người đó → **Ban user** (hoặc **Delete user**).

**Giữ nguyên cài đặt:** Authentication → Sign In / Providers → **Allow new users to sign up** đang **TẮT**. Đừng bật cho đến khi quyết định mở đăng ký công khai.

### Đồng bộ dữ liệu từ Pancake

- **Tự động mỗi 30 phút**: Supabase (chức năng hẹn giờ pg_cron) gọi web `…/api/cron/pancake-sync`. Mỗi lần lấy: sản phẩm + tồn kho, đơn mới hoặc vừa đổi trạng thái. Không tốn tiền AI.
- **Đồng bộ ngay**: trang **Kết nối** → nút **Đồng bộ ngay** (ai trong shop cũng bấm được). Ở đó cũng thấy lần đồng bộ cuối, số mã sản phẩm, số đơn.
- **Shop mới kết nối**: lịch tự động lấy dần lịch sử 90 ngày (mỗi lần 7 ngày); muốn lấy hết ngay thì chạy trên máy `npm.cmd run sync:now -- https://shop.nhankhoitu.com.vn` (khoảng 4–5 phút).
- **Không lưu thông tin cá nhân của khách** (tên, SĐT, địa chỉ), chỉ lưu số liệu đơn.
- Đổi khóa sang **shop Pancake khác** thì dữ liệu shop cũ bị xóa để không trộn số.
- Cài lại / tắt lịch: `npm.cmd run db:setup-cron` (hoặc `npm.cmd run db:setup-cron -- off`). Xem lịch đã chạy chưa: Supabase → **Integrations → Cron** (hoặc **Database → Cron Jobs**).

### Báo cáo hằng ngày 8:00 (không gửi Telegram)

- **8:00 sáng** mỗi ngày Supabase gọi web (`/api/cron/daily-report`): đồng bộ nhanh Pancake rồi lập báo cáo cho mọi shop và lưu lại.
- Báo cáo gồm: **kết quả hôm qua** (số Pancake, so với hôm kia, nguồn đơn, 3 sản phẩm bán chạy), **tiền về** (dự kiến 7 ngày tới, hôm nay), **đặt hàng** (ngày đặt gần nhất, số mẫu/cái; hôm nay là ngày đặt thì ghi rõ), **việc cần làm**.
- Xem ở **đầu trang Tổng quan** (bấm tiêu đề để thu gọn) và trang **Báo cáo** (30 ngày gần nhất). Trước 8:00 hiện báo cáo của sáng hôm trước. Nếu 8:00 lịch bị lỗi, mở web sau 8:00 sẽ tự lập ngay.
- **Phần "Hôm qua" luôn là số mới:** mỗi lần mở báo cáo (Tổng quan, hoặc bấm một ngày ở trang Báo cáo), 1Click hỏi lại Pancake số của ngày đó (đơn hủy sau 8:00 bị Pancake rút khỏi ngày tạo đơn) và ghi "Số mới từ Pancake lúc HH:MM". Tiền về, đặt hàng, việc cần làm giữ như lúc 8:00. Pancake lỗi thì hiện số lúc 8:00 kèm ghi chú vàng. Trang Báo cáo chỉ mở một ngày một lúc (đỡ hỏi Pancake 30 lần).

### Tiền về (tự động, không cần đối soát)

| Nguồn | Tiền về ngày | Số tiền |
|---|---|---|
| Shopee | ngày khách nhận + 4 | tiền sàn trả (đã trừ phí sàn) |
| TikTok | ngày khách nhận + 7 | tiền sàn trả |
| Ngoại sàn qua SPX, J&T, Viettel Post… | ngày khách nhận + 3 | COD − phí ship (phí ship đã trả riêng trong Thu chi thì không trừ) |
| Không qua đơn vị vận chuyển | ngày khách nhận | COD |
| Chuyển khoản trước | ngày giao dịch (Thu chi Pancake) | số tiền, đã trừ các dòng hủy/hoàn/đổi số tiền trả trước |
| Shopify (USD) | ngày giao dịch | đổi ra đồng theo **tỷ giá mua chuyển khoản Vietcombank** của ngày đó (lưu bảng `fx_rates`) |
| Đã nhận rồi mới hoàn | **trừ** vào ngày đơn sang "Đã hoàn" | trừ tiền hàng đã cộng (hoàn một phần: theo phần hoàn) |

- "Ngày khách nhận" = lần đầu đơn chuyển sang **Đã nhận** trên Pancake. Số **dự kiến** của ngày tới chỉ gồm đơn khách đã nhận; đơn đang giao sẽ cộng thêm khi khách nhận.
- Muốn đổi số ngày của một kênh: nhờ Claude Code sửa `CASH_RULES` trong `src/lib/cash/compute.ts` (chưa có ô cấu hình).
- Đây là ước tính theo luật; có thể lệch vài ngày với tiền thật về tài khoản.
- **Phiếu chi có gắn thẻ** (Sản xuất, Quay chụp, Lương…) là **chi phí**, KHÔNG trừ vào Tiền về; chúng hiện tách từng loại ở phần "Kết quả theo tháng".
- Bảng **"Xem chi tiết theo ngày"**: đầu bảng là **Tổng tiền về – Tổng chi – Còn lại** (còn lại = về − chi của ngày đó, âm thì đỏ); sau đó tiền về theo kênh; rồi nhóm **Tiền chi**: mỗi thẻ đã đặt tên một cột (Sản xuất, Quay chụp, Lương…, theo ngày phát sinh), cột **Khác** luôn có sẵn, và **Phí ship trả riêng** (theo ngày tạo phiếu). Bảng rộng: kéo ngang để xem hết. Thẻ "Khác" mới dùng lần đầu trên Pancake sẽ hiện "Thẻ chưa đặt tên" cho tới khi Chủ shop đặt tên **Khác** ở khung Thẻ chi phí.

### Kết quả theo tháng (trang Dòng tiền)

- Chọn tháng bằng các nút "Tháng MM/YYYY" (6 tháng gần nhất).
- **Lợi nhuận kinh doanh** = Doanh thu Pancake (đã trừ chiết khấu, hàng hoàn, phí sàn) − **Phí vận chuyển ngoại sàn** (số `partner_fee` trong thống kê Pancake: phí ship shop trả SPX/J&T… cho đơn ngoại sàn, Doanh thu Pancake chưa trừ) − từng loại chi phí theo thẻ − Quảng cáo. Dòng tiền thực tế KHÔNG trừ dòng này (tiền về đã trừ sẵn phí ship hoặc có dòng "Phí ship trả riêng") nên không trừ trùng.
- **Dòng tiền thực tế** = Tiền về trong tháng − từng loại chi phí theo thẻ − Phí ship trả riêng − Quảng cáo. Tháng đang chạy hiện thêm tiền về dự kiến tới cuối tháng.
- Chi phí = **chỉ phiếu chi Pancake có gắn thẻ**, tính theo **ngày phát sinh** của phiếu. Phiếu Pancake tự sinh theo đơn (trả trước, hoàn, đổi số tiền) không phải chi phí. Trả xưởng / nhập hàng: tạo phiếu chi thẻ **Sản xuất** đúng số tiền trả (không dùng phiếu nhập hàng).
- Bấm vào một loại chi phí để xem từng phiếu (ngày, mã phiếu, nội dung, số tiền).
- **Thẻ chi phí**: Pancake chỉ cho biết mã thẻ, không cho tên → Chủ shop đặt tên thẻ một lần ở khung "Thẻ chi phí" (thẻ mới chưa đặt tên viền vàng, khung tự mở).
- **Quảng cáo (nhập tay qua Pancake, trong lúc chờ kết nối tự động):** phiếu chi gắn thẻ mà Chủ shop đặt tên **bắt đầu bằng "Quảng cáo"** + tên kênh đúng như tên nguồn đơn Pancake (ví dụ **Quảng cáo Shopee**, **Quảng cáo TikTok**) được tính là quảng cáo: tách khỏi chi phí thường, trừ ở cả Lợi nhuận và Dòng tiền thực tế (mỗi kênh một dòng), và hiện **cảnh báo vàng** khi quảng cáo > 12% tổng Doanh thu hoặc > 25% Doanh thu kênh đó trong tháng. Chưa có thẻ nào như vậy thì dòng Quảng cáo ghi "chưa có".
- Kết nối tự động Shopee/TikTok: chủ shop đang đăng ký ứng dụng theo [DANG_KY_QUANG_CAO.md](DANG_KY_QUANG_CAO.md).
- Quảng cáo Facebook/Instagram: chưa kết nối (bước 3.2). Lương từ chấm công: Giai đoạn 6; hiện phiếu chi thẻ Lương vẫn được tính.

### Cách tính số trên trang Tổng quan

- **Mọi số tiền** (Doanh số, Doanh thu, Lợi nhuận, Đơn chốt, GTTB, Phí sàn, Tổng hàng chốt, Tổng hàng hoàn, Nguồn đơn, Top 5 sản phẩm) **lấy thẳng từ Thống kê của Pancake** mỗi lần mở trang, nên luôn khớp màn hình Thống kê của Pancake (đã đối chiếu ngày 04/11/2026: khớp từng đồng, kể cả % so sánh). Phí sàn, đơn hoàn, đơn đổi hàng… do Pancake tự tính.
- **Tổng hàng chốt / Tổng hàng hoàn**: "Số lượng" là **số sản phẩm**, giống Pancake (không phải số đơn).
- **Tồn kho, báo động sản xuất, Dữ liệu cần kiểm tra**: 1Click tự tính từ dữ liệu đồng bộ mỗi 30 phút.
- Nếu Pancake lỗi hoặc mạng chậm, trang hiện dòng đỏ "Không lấy được số liệu thống kê từ Pancake", phần tồn kho vẫn hiện.

### Kết nối Pancake POS

1. Trên Pancake POS: **Cấu hình → Ứng dụng**, khung **API KEY** bấm **Thêm mới**, sao chép khóa.
2. Trên 1Click: menu **Kết nối** → dán khóa vào ô **Khóa API**. Shop ID để trống nếu khóa chỉ có một shop.
3. Bấm **Kiểm tra & lưu**: 1Click gọi thử Pancake, khóa đúng mới lưu (đã mã hóa), sau đó chỉ hiện 4 ký tự cuối.
- Chỉ **Chủ shop** thấy ô nhập và nút **Đổi khóa API / Ngắt kết nối**; Quản lý, Nhân viên chỉ xem trạng thái.
- **Không bao giờ dán khóa Pancake vào khung chat** với Claude Code.

**⚠️ `ENCRYPTION_KEY` trong `.env.local` là chìa khóa mở mọi khóa Pancake đã lưu.** Mất hoặc đổi nó thì mọi shop phải dán lại khóa Pancake. Hãy chép giá trị này lưu vào nơi an toàn (trình quản lý mật khẩu); khi đưa web lên Vercel (Bước 0.7) phải điền đúng giá trị này.

## 4. Nhờ Claude Code sửa hoặc thêm tính năng

Mẫu câu hay dùng:
- *"Ở trang Tổng quan, đổi thẻ Doanh thu thành hiển thị thêm số đơn. Làm xong cho tôi xem cách kiểm tra."*
- *"Tôi gặp lỗi sau khi bấm nút Lưu ở trang Kết nối: (dán lỗi). Tìm nguyên nhân và sửa."*
- *"Giải thích cho tôi file src/app/layout.tsx làm gì, bằng tiếng Việt dễ hiểu."*
- *"Đổi màu nhấn của web từ xanh dương sang xanh ngọc, cho tôi xem ở trang Tổng quan."*
- *"Ở trang Tổng quan, đưa khối Dòng tiền lên ngay dưới Kinh doanh."*
- *"Đưa mục Dòng tiền lên ngay dưới Tổng quan trong menu trái."*
- *"Thêm lựa chọn 'Quý này' vào bộ lọc thời gian, có unit test."*
- *"Commit những thay đổi vừa rồi với message rõ ràng."*
- *"Tiếp tục bước tiếp theo trong lộ trình của PROJECT_BRIEF.md."*

Mẹo: mô tả **cái bạn thấy** và **cái bạn muốn thấy**, không cần biết code.

## 5. Quay lại phiên bản cũ bằng git

Mỗi bước làm xong đều được lưu lại một "mốc" (commit).

- Xem danh sách mốc: `git log --oneline` (nhấn `q` để thoát).
- **Bỏ hết thay đổi chưa lưu mốc** (quay về mốc gần nhất): `git restore .`
  ⚠️ Không lấy lại được những thay đổi vừa bỏ.
- **Quay lại một mốc cũ nhưng vẫn giữ lịch sử** (an toàn): nhờ Claude Code *"Hoàn tác commit <mã> giúp tôi"*. Lệnh dùng là `git revert <mã>`.
- Không chắc chắn thì hỏi Claude Code trước, đừng tự chạy lệnh có chữ `--hard` hay `--force`.

## 6. Mở rộng hệ thống

### Thay đổi cấu trúc database

- Mọi thay đổi bảng nằm trong `supabase/migrations/`, áp lên Supabase bằng `npm.cmd run db:migrate` (file đã chạy rồi sẽ tự bỏ qua).
- Mọi bảng dữ liệu shop sau này đều có cột `org_id` + khóa bảo vệ + test trong `src/lib/rls.dbtest.ts` (quy ước ghi ở đầu file `0001_organizations.sql`).

### Kế hoạch đặt hàng (trang Tồn kho)

**Luật (chủ shop chốt 05/11/2026, sửa ở nút Cấu hình – chỉ Chủ shop):**

| Ô cấu hình | Mặc định | Ý nghĩa |
|---|---|---|
| Đặt tối thiểu mỗi size | 20 cái | Size nào cần đặt thì đặt ít nhất chừng này |
| Thời gian sản xuất 3 mức | ≤50 cái: 7 ngày · ≤150 cái: 10 ngày · nhiều hơn: 14 ngày | Tính theo **tổng số lượng cả mẫu** trong lần đặt. Không cần ghi "SX:" trên Pancake nữa |
| Bán âm kho tối đa | 7 ngày | Đợi tới ngày đặt kế tiếp mà phải bán âm lâu hơn → "Cần sản xuất ngay" |
| Đủ bán thêm sau lần đặt chính kế tiếp | 7 ngày | Đặt ngày 16 phải đủ bán tới mùng 7 tháng sau; đặt cuối tháng đủ tới ngày 23 tháng sau |
| Ẩn mã bán chậm khi | 60 ngày | Đặt tối thiểu mà lâu hơn chừng này ngày mới bán hết → ẩn khỏi gợi ý (bấm "Xem cả mẫu bán chậm" khi cần) |
| Tính tốc độ bán trên | 30 ngày | Bán/ngày = số bán thực (đơn chốt trừ hàng hoàn) ÷ số ngày |
| Tồn nhiều khi đủ bán quá | 90 ngày | Dùng cho đề xuất "kế hoạch đẩy tồn" ở Tổng quan |

**Lịch đặt mỗi tháng:** **Đặt chính** ngày 16 và ngày cuối tháng. **Đặt bổ sung** mùng 5 và ngày 20, chỉ có mẫu bán chạy lên đột ngột hoặc đã đặt rồi vẫn thiếu (1Click tính các lần trước như đã đặt đúng gợi ý).

**Chỉ hiện ngày đặt gần nhất:** ngày 1–5 hiện mùng 5; ngày 6–16 hiện ngày 16; ngày 17–20 hiện ngày 20; ngày 21–cuối tháng hiện cuối tháng.

**Trang Tồn kho gồm:**
1. **Cần sản xuất ngay** (chỉ hiện vào ngày KHÔNG phải ngày đặt) – mẫu mà nếu đợi tới ngày đặt kế tiếp sẽ bán âm kho quá 7 ngày. Hôm nay là ngày đặt thì mọi mẫu cần đặt nằm chung danh sách của hôm nay.
2. **Ngày đặt gần nhất** + phần **Ghi chú lịch đặt hàng**; mỗi mẫu bấm vào xem từng màu/size: Có thể bán, Sắp về, Bán/ngày, Ngày hết hàng, Thiếu tới ngày phải đủ, **Gợi ý đặt**; kèm thời gian sản xuất và ngày về dự kiến.
3. **Đặt thực tế** (Chủ shop, Quản lý): trong bảng từng size, nhập số THỰC TẾ đã chốt với xưởng ở cột "Đặt thực tế" (để trống = không đặt size đó), chọn **Ngày về thực tế (xưởng hẹn)**, ghi chú nếu cần, rồi bấm **"Đã đặt"** → 1Click cộng vào kế hoạch (không gợi ý đặt trùng).
4. **Hàng sắp về** – danh sách đã đặt; hàng về và nhập kho trên Pancake xong thì bấm **"Đã về"**. Quá ngày về 3 ngày mà chưa bấm thì 1Click tự thôi cộng (coi như tồn Pancake đã tăng).

- **Ví dụ:** váy size S còn 5 cái, bán 3 cái/ngày. Đặt ngày 16/11 phải đủ bán tới 07/12: cần 3 × 32 = 96 cái, có 5 → gợi ý **91 cái**. Size L thiếu 2 cái vẫn đặt **20 cái** (tối thiểu). Cả mẫu 111 cái → sản xuất 10 ngày, về khoảng 26/11.
- Các con số đều do code tính và có unit test (`src/lib/inventory/plan.test.ts`).

### Sẽ bổ sung ở các giai đoạn sau

- Thêm quy tắc thuế mới: *(Giai đoạn 7)*
- Thêm mẫu KPI mới: *(Giai đoạn 6)*
- Thêm nền tảng content mới: *(Giai đoạn 4)*

## 7. Deploy bản mới lên Vercel

**Web thật:** https://shop.nhankhoitu.com.vn (dự phòng: https://1click-shop.vercel.app)

| Nơi | Là gì | Ghi chú |
|---|---|---|
| GitHub `namhoangcoaching-maker/1click-shop` (Private) | Nơi cất code | Repo `1click` là của web tìm bài hot, **không đụng vào**. |
| Vercel, team `1click`, project `1click-shop` (gói Hobby), máy chủ đặt ở **Sydney** (`vercel.json`) cạnh database cho nhanh | Máy chủ chạy web | Gói Hobby chỉ cho dùng phi thương mại. Khi thu tiền khách nên nâng gói Pro. |
| Cloudflare, tên miền `nhankhoitu.com.vn` | Tên miền | Bản ghi **CNAME `shop`** → Vercel, **DNS only (đám mây xám)**. Bản ghi `idea` (web tìm bài hot) và tên miền gốc (trang Tài Chính Cá Nhân) **giữ nguyên**. |

**Đưa bản mới lên mạng:** mỗi lần Claude Code commit và chạy `git push`, Vercel **tự** dựng lại web sau khoảng 1–2 phút. Xem tiến trình: Vercel → project `1click-shop` → **Deployments** (dòng trên cùng phải là **Ready** màu xanh).

**Bản mới bị lỗi?** Vercel → **Deployments** → bấm dấu ⋮ ở bản cũ đang chạy tốt → **Promote to Production** (hoặc **Instant Rollback**): web quay lại bản cũ ngay, rồi nhờ Claude Code sửa.

**Khóa bí mật trên Vercel:** Settings → **Environment Variables**, có đúng 5 biến: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET` (phải **giống hệt** `.env.local`, kể cả dấu `=` cuối). Sửa biến xong phải **Redeploy** mới có hiệu lực. `SUPABASE_DB_URL` chỉ dùng trên máy, không đưa lên Vercel.

**Thay đổi database:** Vercel không tự chạy migration. Khi có file mới trong `supabase/migrations/`, chạy `npm.cmd run db:migrate` trên máy **trước** khi push code dùng bảng mới.

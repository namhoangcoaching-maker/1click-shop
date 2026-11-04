# HƯỚNG DẪN 1CLICK

> File này luôn được cập nhật sau mỗi bước. Nếu thấy chỗ nào không khớp với thực tế, hãy nhắn Claude Code: *"HUONG_DAN.md đang sai ở mục …, sửa lại giúp tôi"*.

**Tiến độ:** Giai đoạn 0 – Bước 0.1 (khởi tạo dự án) ✅ · Bước 0.2 (hệ thống thiết kế) ✅ · Bước 0.3 (menu trái) ✅ · Bước 0.4 (đăng nhập email, đợt 1) ✅ · Bước 0.5 (nhiều shop + khóa bảo vệ dữ liệu) ✅ · Bước 0.6 (trang Kết nối Pancake POS) ✅

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
| `supabase/migrations/` | **Cấu trúc database**, mỗi file `.sql` là một lần thay đổi, đánh số thứ tự. `0001_organizations.sql`: bảng Doanh nghiệp, Thành viên và các khóa bảo vệ. `0002_connections.sql`: bảng Kết nối (khóa Pancake đã mã hóa). Không sửa file đã chạy rồi; muốn đổi thì nhờ Claude Code tạo file mới. |
| `scripts/` | Lệnh quản trị chạy trên máy: áp cấu trúc database (`db-migrate.mjs`), gắn người vào shop (`db-add-member.mjs`). |
| `src/app/dang-nhap/` | **Trang Đăng nhập** (`/dang-nhap`): `page.tsx` là khung trang, `login-form.tsx` là ô nhập và nút. |
| `src/proxy.ts` | **Người gác cổng**: chạy trước mỗi lượt mở trang, chưa đăng nhập thì đưa về `/dang-nhap` (sau khi đăng nhập sẽ quay lại đúng trang định mở). |
| `src/lib/auth/` | Đăng nhập/đăng xuất (`actions.ts`), kiểm tra ô nhập và câu báo lỗi tiếng Việt (`login.ts`), danh sách trang không cần đăng nhập (`paths.ts`). |
| `src/lib/supabase/` | Kết nối tới Supabase (cơ sở dữ liệu + tài khoản). Thường không cần sửa. |
| `src/components/layout/account-menu.tsx` | Khối email + nút Đăng xuất ở cuối menu trái. |
| `src/app/(app)/page.tsx` | **Trang Tổng quan** (`/`, trang chủ), hiện dùng số liệu giả: thứ tự và cách xếp các khối nằm ở đây. |
| `src/app/(app)/content`, `tao-noi-dung`, `nhan-su`, `thue`, `dong-tien` | Các trang "Đang xây dựng", mỗi trang ghi sẵn tính năng sẽ có. |
| `src/app/(app)/ket-noi/` | **Trang Kết nối** (`/ket-noi`): `page.tsx` khung trang + danh sách "Sắp có", `pancake-form.tsx` ô dán khóa Pancake và nút Kiểm tra & lưu. |
| `src/lib/connections/` | Lưu / ngắt kết nối (`actions.ts`, chỉ Chủ shop), đọc trạng thái kết nối (`queries.ts`, không bao giờ đọc khóa). |
| `src/lib/pancake/shops.ts` | Gọi Pancake POS để kiểm tra khóa (lệnh "Thông tin cửa hàng") và câu báo lỗi tiếng Việt. Tài liệu API Pancake: https://docs.pancake.biz/pos/api/en |
| `src/lib/crypto/secret-box.ts` | **Mã hóa khóa API của khách** trước khi lưu (AES-256-GCM, dùng `ENCRYPTION_KEY`). |
| `src/components/layout/nav-items.ts` | **Danh sách mục menu trái**: thêm, bớt, đổi tên, đổi thứ tự, đổi biểu tượng ở đây. |
| `src/components/layout/app-shell.tsx` | Giao diện menu trái và nút ☰ trên điện thoại. |
| `src/components/overview/` | **Từng khối của trang Tổng quan**, mỗi khối một file: `summary-cards` (Hàng chốt, Hàng hoàn, Tồn kho), `order-sources` (Nguồn đơn), `cashflow-summary` (Dòng tiền), `tax-summary` (Thuế), `top-products` (Top 5 SP), `ad-costs` (Chi phí QC), `top-content` (Content), `staff-summary` (Nhân sự). |
| `src/components/dashboard/panel.tsx` | Khung **thẻ trắng** có biểu tượng tròn, ô xám bên trong, thanh tiến độ. |
| `src/components/dashboard/metric-strip.tsx` | **Dải chỉ số** Doanh số / Doanh thu / Lợi nhuận… bấm vào để đổi biểu đồ. |
| `src/components/dashboard/trend-chart.tsx` | **Biểu đồ đường** kỳ này (xanh) và kỳ trước (xám nét đứt). |
| `src/app/(app)/ton-kho/page.tsx` | **Trang Tồn kho** (`/ton-kho`, số liệu giả): báo động mã cần sản xuất, bảng tồn theo mã, lọc theo trạng thái. |
| `src/components/inventory/` | Bảng tồn kho và nhãn trạng thái (Hết hàng, Sản xuất ngay, Sắp đến hạn, Bán chậm, Đủ hàng). |
| `src/lib/inventory/stock.ts` | **Công thức tồn kho**: tốc độ bán, số ngày đủ bán, khi nào phải sản xuất, nên sản xuất bao nhiêu. Các ngưỡng nằm ở `STOCK_RULES` đầu file. |
| `src/lib/overview/recommendations.ts` | **Quy tắc "Đề xuất của AI"**: cần sản xuất, tập trung content, xả kho, chi phí quảng cáo cao. Các ngưỡng nằm ở `RECOMMENDATION_RULES` đầu file. |
| `src/components/overview/recommendations.tsx` | Giao diện khối Đề xuất. |
| `src/lib/overview/types.ts` | Danh sách các con số mà trang Tổng quan cần. |
| `src/lib/overview/demo-data.ts` | **Số liệu giả** cho bản mẫu. Giai đoạn 1 sẽ thay bằng dữ liệu Pancake thật. |
| `src/app/globals.css` | **Màu sắc** toàn web (xanh dương nhấn, xanh lá tăng, đỏ giảm, cam cảnh báo, nền xám). Đổi màu thì sửa phần `:root` ở đây. |
| `src/components/ui/` | Các khối giao diện có sẵn (nút, ô nhập, thẻ…) của shadcn/ui. Thường không cần sửa. |
| `src/components/dashboard/stat-card.tsx` | **Khối số** (nhãn xám, số to, ↑/↓ %). Rê chuột để xem giá trị kỳ trước. |
| `src/components/dashboard/trend-badge.tsx` | Mũi tên ↑/↓ % màu xanh/đỏ, dùng trong thẻ và bảng. |
| `src/components/dashboard/date-filter.tsx` | **Bộ lọc thời gian** "Hôm nay / 7 ngày qua…" và "So sánh với". |
| `src/components/dashboard/refresh-button.tsx` | Nút **Tải lại**. |
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

**Chạy test khóa bảo vệ dữ liệu trên database thật:** `npm run test:db` (cần mạng). Lệnh này tạo tạm vài tài khoản `@test.1click.local`, kiểm tra shop A không đọc/sửa được dữ liệu shop B, rồi tự xóa. Phải ra `20 passed` (hoặc nhiều hơn khi có thêm bảng).

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

**Hiện có:** shop **Ecobath**, Chủ là `namhoangcoaching@gmail.com`.

**Vai trò:** Chủ shop (toàn quyền, thêm/bớt thành viên, sửa thông tin shop) · Quản lý · Nhân viên (chỉ xem; sau này chỉ thấy lương/KPI của mình). Mỗi shop luôn phải còn ít nhất một Chủ.

**Khóa bảo vệ dữ liệu (RLS):** quy tắc nằm ngay trong database: người của shop nào chỉ đọc được dữ liệu shop đó, kể cả khi code web có lỗi. Chỉ quản trị 1Click (dùng khóa secret trên máy) mới tạo được shop mới.

**Quên mật khẩu / đổi mật khẩu cho ai đó:** Authentication → Users → bấm vào người đó → **Reset password** (gửi email đặt lại) hoặc xóa và tạo lại.

**Khóa một người:** Authentication → Users → bấm dấu ⋮ ở dòng người đó → **Ban user** (hoặc **Delete user**).

**Giữ nguyên cài đặt:** Authentication → Sign In / Providers → **Allow new users to sign up** đang **TẮT**. Đừng bật cho đến khi quyết định mở đăng ký công khai.

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

### Quy tắc báo động tồn kho và đề xuất

- **Báo động "Sản xuất ngay"** khi: số ngày đủ bán < thời gian sản xuất + 3 ngày dự phòng.
  Ví dụ: bán 7 cái/ngày, còn 60 cái → đủ bán 8,6 ngày; sản xuất 8 ngày + 3 = 11 ngày → báo động, nên sản xuất 164 cái (đủ bán 21 ngày sau khi hàng về).
- **Thời gian sản xuất của từng sản phẩm** ghi trong Pancake: Sản phẩm → mở sản phẩm → ô **Ghi chú nội bộ**, ghi `SX: 8` (8 là số ngày). Cũng hiểu `SX 8 ngày`, `Sản xuất: 8 ngày`, hoặc ghi chú chỉ có số `8`. Không ghi thì tạm tính 7 ngày và hiện trong "Dữ liệu cần kiểm tra". Lưu ý: phải có dấu `:` hoặc khoảng trắng giữa "SX" và số (viết dính `SX098` sẽ không được hiểu, để tránh nhầm với mã sản phẩm).
- Tốc độ bán = trung bình 30 ngày gần nhất. Đủ bán quá 90 ngày = bán chậm.
- Chi phí quảng cáo vượt 12% tổng doanh thu, hoặc 25% doanh thu của một kênh → đề xuất tối ưu.
- Muốn đổi các con số này: nhờ Claude Code *"Đổi số ngày dự phòng tồn kho thành 5 ngày"*. Sau này mỗi doanh nghiệp sẽ tự chỉnh trong phần cấu hình.
- Các con số đều do code tính và có unit test; AI chỉ diễn giải, không tự tính.

### Sẽ bổ sung ở các giai đoạn sau

- Thêm quy tắc thuế mới: *(Giai đoạn 7)*
- Thêm mẫu KPI mới: *(Giai đoạn 6)*
- Thêm nền tảng content mới: *(Giai đoạn 4)*

## 7. Deploy bản mới lên Vercel

*(Bổ sung ở Bước 0.7)*

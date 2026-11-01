# HƯỚNG DẪN 1CLICK

> File này luôn được cập nhật sau mỗi bước. Nếu thấy chỗ nào không khớp với thực tế, hãy nhắn Claude Code: *"HUONG_DAN.md đang sai ở mục …, sửa lại giúp tôi"*.

**Tiến độ:** Giai đoạn 0 – Bước 0.1 (khởi tạo dự án) ✅ · Bước 0.2 (hệ thống thiết kế) ✅

---

## 1. Bản đồ thư mục

| Đường dẫn | Dùng để làm gì |
|---|---|
| `PROJECT_BRIEF.md` | Yêu cầu sản phẩm gốc. Muốn đổi yêu cầu lớn thì sửa ở đây và báo Claude Code. |
| `HUONG_DAN.md` | File bạn đang đọc. |
| `src/app/` | **Các trang web.** Mỗi thư mục con là một đường dẫn, ví dụ `src/app/thue/page.tsx` là trang `/thue`. |
| `src/app/layout.tsx` | Khung chung của mọi trang: font chữ, tiêu đề tab trình duyệt. |
| `src/app/page.tsx` | Trang chủ (`/`). Hiện là trang chào tạm. |
| `src/app/design/page.tsx` | **Bản mẫu trang Tổng quan** (`/design`) với số liệu giả: thứ tự và cách xếp các khối trên trang nằm ở đây. |
| `src/components/overview/` | **Từng khối của trang Tổng quan**, mỗi khối một file: `summary-cards` (Hàng chốt, Hàng hoàn, Tồn kho), `order-sources` (Nguồn đơn), `cashflow-summary` (Dòng tiền), `tax-summary` (Thuế), `top-products` (Top 5 SP), `ad-costs` (Chi phí QC), `top-content` (Content), `staff-summary` (Nhân sự). |
| `src/components/dashboard/panel.tsx` | Khung **thẻ trắng** có biểu tượng tròn, ô xám bên trong, thanh tiến độ. |
| `src/components/dashboard/metric-strip.tsx` | **Dải chỉ số** Doanh số / Doanh thu / Lợi nhuận… bấm vào để đổi biểu đồ. |
| `src/components/dashboard/trend-chart.tsx` | **Biểu đồ đường** kỳ này (xanh) và kỳ trước (xám nét đứt). |
| `src/app/design/ton-kho/page.tsx` | **Bản mẫu trang Tồn kho** (`/design/ton-kho`): báo động mã cần sản xuất, bảng tồn theo mã, lọc theo trạng thái. |
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
| `.env.local` | **Khóa bí mật thật** (sẽ tạo ở bước 0.4). Chỉ nằm trên máy bạn, không bao giờ lên GitHub. |
| `package.json` | Danh sách thư viện và các lệnh `npm run …`. |
| `node_modules/` | Thư viện đã tải về. Không sửa. Lỡ xóa thì chạy `npm install` để tải lại. |

## 2. Chạy, dừng, xem lỗi

**Chạy web trên máy:**
1. Trong VS Code, mở Terminal: menu **Terminal → New Terminal** (hoặc phím tắt ``Ctrl + ` ``).
2. Gõ `npm run dev` rồi Enter.
3. Khi thấy dòng `Local: http://localhost:3000`, mở trình duyệt vào địa chỉ đó.
4. Sửa code và lưu file (`Ctrl + S`): trình duyệt tự cập nhật, không cần chạy lại.

**Dừng:** bấm vào cửa sổ Terminal đó rồi nhấn `Ctrl + C`.

**Xem lỗi:**
- Lỗi phía server: hiện màu đỏ trong cửa sổ Terminal đang chạy `npm run dev`.
- Lỗi trên trang: Next.js hiện khung lỗi đỏ ngay trên trình duyệt; ngoài ra có thể nhấn `F12` → tab **Console**.
- Cách nhanh nhất: copy nguyên đoạn lỗi, dán cho Claude Code kèm câu *"Tôi gặp lỗi này khi …"*.

**Chạy unit test:** `npm test`. Dòng cuối phải là `Tests  N passed`. Nếu có dòng `failed` nghĩa là một công thức đang tính sai: đừng đưa lên mạng, dán kết quả cho Claude Code.

**Kiểm tra trước khi đưa lên mạng:** `npm test` rồi `npm run build`. Cả hai không báo lỗi là ổn.

**Vì sao số liệu hiện khung xám một chút rồi mới ra số?** Đây là chủ ý: khung trang (tiêu đề, menu) hiện ngay, phần số liệu tải sau. Nhờ vậy trang luôn mở nhanh, kể cả khi lấy dữ liệu từ Pancake mất vài giây.

## 3. Nhờ Claude Code sửa hoặc thêm tính năng

Mẫu câu hay dùng:
- *"Ở trang Tổng quan, đổi thẻ Doanh thu thành hiển thị thêm số đơn. Làm xong cho tôi xem cách kiểm tra."*
- *"Tôi gặp lỗi sau khi bấm nút Lưu ở trang Kết nối: (dán lỗi). Tìm nguyên nhân và sửa."*
- *"Giải thích cho tôi file src/app/layout.tsx làm gì, bằng tiếng Việt dễ hiểu."*
- *"Đổi màu nhấn của web từ xanh dương sang xanh ngọc, cho tôi xem ở trang /design."*
- *"Ở trang Tổng quan, đưa khối Dòng tiền lên ngay dưới Kinh doanh."*
- *"Thêm lựa chọn 'Quý này' vào bộ lọc thời gian, có unit test."*
- *"Commit những thay đổi vừa rồi với message rõ ràng."*
- *"Tiếp tục bước tiếp theo trong lộ trình của PROJECT_BRIEF.md."*

Mẹo: mô tả **cái bạn thấy** và **cái bạn muốn thấy**, không cần biết code.

## 4. Quay lại phiên bản cũ bằng git

Mỗi bước làm xong đều được lưu lại một "mốc" (commit).

- Xem danh sách mốc: `git log --oneline` (nhấn `q` để thoát).
- **Bỏ hết thay đổi chưa lưu mốc** (quay về mốc gần nhất): `git restore .`
  ⚠️ Không lấy lại được những thay đổi vừa bỏ.
- **Quay lại một mốc cũ nhưng vẫn giữ lịch sử** (an toàn): nhờ Claude Code *"Hoàn tác commit <mã> giúp tôi"*. Lệnh dùng là `git revert <mã>`.
- Không chắc chắn thì hỏi Claude Code trước, đừng tự chạy lệnh có chữ `--hard` hay `--force`.

## 5. Mở rộng hệ thống

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

## 6. Deploy bản mới lên Vercel

*(Bổ sung ở Bước 0.7)*

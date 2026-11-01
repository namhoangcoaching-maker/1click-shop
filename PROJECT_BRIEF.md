# PROJECT BRIEF – 1Click: Website quản trị cho doanh nghiệp nhỏ / 1 người

> **Cách dùng:** đặt file này vào thư mục dự án, mở VS Code tại thư mục đó, mở Claude Code và gõ:
> "Đọc kỹ PROJECT_BRIEF.md rồi bắt đầu Giai đoạn 0. Làm từng bước, hỏi tôi trước khi sang bước tiếp theo."

---

## 1. Vai trò của bạn (Claude Code)

Bạn là kỹ sư full-stack kiêm product designer, cùng tôi xây một sản phẩm SaaS thật để bán cho khách. Tôi không phải lập trình viên chuyên nghiệp, nên:

- Giải thích ngắn gọn bằng tiếng Việt mỗi khi đưa ra quyết định kỹ thuật quan trọng.
- Làm **từng bước nhỏ**. Mỗi bước phải chạy được và kiểm tra được trước khi sang bước sau.
- **Trước mỗi giai đoạn:** trình bày kế hoạch ngắn (các file, các bảng dữ liệu, các màn hình) và chờ tôi đồng ý.
- **Sau mỗi bước:** chạy thử, sửa lỗi, commit git với message rõ ràng, hướng dẫn tôi tự kiểm tra trên trình duyệt, và **cập nhật file `HUONG_DAN.md`** (xem mục 9).
- Khi thiếu thông tin (API key, tài liệu API, quyết định nghiệp vụ), dừng lại và hỏi tôi, không tự bịa.

## 2. Sản phẩm là gì

**Tên sản phẩm và thương hiệu: 1Click.** Dùng tên 1Click cho tên dự án, tiêu đề web, logo tạm, email gửi báo cáo, tên bot Telegram. Không dùng tên Ecobath cho sản phẩm.

Website 1Click giúp doanh nghiệp nhỏ và chủ shop online ở Việt Nam **chuẩn hóa vận hành và bớt phụ thuộc nhân sự** (content, kế toán, trực page, theo dõi tiền).

**Nguyên tắc cốt lõi:** website **không làm lại Pancake**. Nó tổng hợp các con số quan trọng, phân tích và đề xuất hành động. Ai cần xem chi tiết thì có **link sang Pancake**. Chatbot trả lời khách do Pancake đảm nhận; website chỉ đọc dữ liệu về để phân tích.

Khách hàng dùng thử đầu tiên của 1Click: shop Ecobath (phụ kiện nhà tắm inox SUS304), đang dùng Pancake POS và bán qua Shopee, TikTok Shop. Ecobath chỉ là một khách hàng (một doanh nghiệp trong hệ thống), không phải tên sản phẩm.

**Phong cách giao diện:** học theo trang "Tổng quan" của Pancake POS, vì khách đã quen: thẻ số liệu có so sánh với kỳ trước (↑ / ↓ %), bộ lọc thời gian ("Hôm nay", "So sánh với: Trước đó 1 ngày"), bảng sắp xếp và lọc được từng cột, chọn kho, nút Tải lại. Tên cột và thuật ngữ dùng giống Pancake: Doanh số, Doanh thu, Lợi nhuận, Chiết khấu, Đơn chốt, GTTB, Nguồn đơn…

## 3. Sáu mục chính (menu bên trái)

### 3.1. Tổng quan (trang chủ)

Một màn hình đủ để chủ shop nắm tình hình. Có bộ lọc thời gian và so sánh kỳ trước.

**Cột chính (bên trái, rộng):**
- Thẻ số liệu: Doanh số, Doanh thu, Lợi nhuận, Đơn chốt, GTTB, chi phí quảng cáo.
- Nguồn đơn: Shopee, TikTok, Facebook, Website… (doanh thu, lợi nhuận, đơn chốt từng nguồn).
- Top 5 sản phẩm bán chạy.
- Tồn kho: tổng số lượng và **giá trị tồn quy ra tiền** (theo giá vốn).
- Chi phí quảng cáo từng kênh.
- 3 video và 3 hình ảnh có **lượt view cao nhất** trong kỳ.
- Thuế: số hóa đơn đã xuất trên số đơn bán ra, số hóa đơn cần điều chỉnh, ngày đến hạn khai thuế gần nhất.
- Dòng tiền tóm tắt: tổng thu, tổng chi, kết quả âm hay dương.

**Cột phụ (bên phải):** tóm tắt Nhân sự, gồm hiệu suất, tiến độ KPI, chấm công hôm nay, lương tạm tính tháng này.

### 3.2. Content (kế hoạch, báo cáo, đề xuất)

**a) Cấu hình đầu vào** (khách tự nhập, sửa được bất cứ lúc nào):
- Thông tin thương hiệu: tên, câu chuyện, khách hàng mục tiêu.
- Sản phẩm dùng để làm content (chọn từ danh sách sản phẩm Pancake, kèm mô tả và ảnh).
- Mô tả ý tưởng muốn triển khai.
- Gu thương hiệu: dạng nội dung muốn nhắm tới, phong cách hình ảnh và giọng văn.
- Tối đa 5 hình ảnh và 5 video tham chiếu (tùy chọn).
- Nền tảng đăng: chọn nhiều trong Facebook, TikTok, Instagram, YouTube. YouTube chỉ có video, không có hình ảnh.
- Số lượng mỗi tháng: khách chọn trong khoảng 30 đến 60.

**b) Kế hoạch tháng** (giao diện bảng kiểu Sheet, hai tab: Hình ảnh và Video). Mỗi dòng gồm:
- Tiêu đề
- Tóm tắt ý tưởng (hình ảnh hoặc video muốn hướng tới)
- Prompt chi tiết để tạo trên Higgsfield, có nút "Tạo nội dung" (mục 3.3)
- Nền tảng đăng
- Link bài đăng (khách dán vào)
- Các chỉ số tự lấy về từ link: **view, tim/like, share, lưu, bình luận**
- Đề xuất của AI: nên làm tiếp dạng này không, dựa **chỉ trên lượt view**
- Cột tích chọn của khách: "Muốn làm tiếp"

Bảng lọc và sắp xếp được theo từng chỉ số. **Không có thang điểm tổng hợp**: khách tự lọc xem chỉ số nào cao nhất.

**c) Vòng lặp tháng sau:** khi tạo kế hoạch tháng mới, AI lấy đầu vào là cấu hình (a) cùng các dòng khách đã tích "Muốn làm tiếp", rồi đề xuất nội dung mới dựa trên những dạng đó.

### 3.3. Tạo nội dung (Higgsfield API)

- Tài liệu: https://docs.higgsfield.ai (API dạng bất đồng bộ: gửi yêu cầu, rồi chờ kết quả bằng polling hoặc webhook).
- **Dùng một API key chung của hệ thống** (của tôi), không bắt khách nhập key.
- Mỗi gói thuê bao có **hạn mức lượt tạo** mỗi tháng (credit). Hiển thị số credit còn lại, chặn khi hết, ghi lại chi phí từng lượt tạo để tôi theo dõi lỗ lãi.
- Tạo từ prompt trong kế hoạch Content (3.2b) hoặc nhập prompt tự do. Chọn model và tỷ lệ khung hình, hiển thị chi phí ước tính trước khi tạo.
- Kết quả lưu vào thư viện của khách, gắn với dòng content tương ứng.

### 3.4. Nhân sự

- **Chấm công:** check-in và check-out bằng điện thoại trên web trước (GPS hoặc wifi); máy ZKTeco qua ADMS làm sau.
- **Lương:** lõi chung gồm ngày công, phụ cấp, bảo hiểm.
- **KPI dạng cấu hình**, không code riêng cho từng khách. Thư viện mẫu gắn được cho từng nhân sự hoặc bộ phận: phần trăm doanh số, theo số lượng, bậc thang theo phần trăm chỉ tiêu, theo tỷ lệ hoàn thành, trừ phạt. Chỉ công thức KPI là khác nhau giữa các doanh nghiệp.
- Nhân viên xem được **"lương tạm tính đến hôm nay"** và còn thiếu bao nhiêu để lên bậc thưởng tiếp theo. Mỗi người chỉ thấy lương của mình.
- Hiệu suất: đơn chốt, doanh số, tỷ lệ chốt theo nhân viên (từ Pancake).

### 3.5. Thuế

- Nguồn hóa đơn: Pancake đang xuất hóa đơn qua https://invoice.pancake.vn/ (Pancake POS kết nối hóa đơn điện tử qua Sinvoice). **Kiểm tra API nào trả về số hóa đơn, mã tra cứu, trạng thái** trước khi làm. Hỏi tôi nếu không tìm thấy.
- Màn hình:
  - Tỷ lệ đơn đã xuất hóa đơn trên tổng đơn bán ra.
  - Danh sách **hóa đơn cần điều chỉnh**: mã hóa đơn, số hóa đơn, lý do, hạn xử lý, link sang Pancake.
  - Danh sách **đơn chưa xuất hóa đơn**: trạng thái, cần lưu ý gì.
  - **Lịch thuế:** ngày cần điều chỉnh hóa đơn, ngày khai và nộp thuế; nhắc trước 7 ngày và 1 ngày.
- **Cấu hình loại hình doanh nghiệp:** Hộ kinh doanh hoặc Công ty, và doanh thu năm trước. Hệ thống tự xác định nghĩa vụ và kỳ khai.
- **Quy định thuế phải lưu thành bảng cấu hình trong database (có ngày hiệu lực), KHÔNG hard-code trong code**, vì luật thay đổi thường xuyên (riêng năm 2026 ngưỡng hộ kinh doanh đã đổi hai lần). Giá trị khởi tạo, cập nhật đến 11/2026; tôi sẽ kiểm tra lại với kế toán:
  - Hộ kinh doanh, doanh thu năm **≤ 1 tỷ**: không nộp thuế GTGT và TNCN, không bắt buộc hóa đơn điện tử, thông báo doanh thu chậm nhất 31/1 năm sau (Nghị định 68/2026, sửa đổi bởi Nghị định 141/2026).
  - Hộ kinh doanh **> 1 tỷ đến 50 tỷ**: khai và nộp thuế GTGT theo quý, bắt buộc hóa đơn điện tử. **> 50 tỷ**: khai theo tháng.
  - Công ty, doanh thu năm trước **≤ 50 tỷ** hoặc mới thành lập: khai thuế GTGT theo quý; **> 50 tỷ**: khai theo tháng.
  - Hạn nộp tờ khai: theo tháng là ngày 20 tháng sau; theo quý là ngày cuối cùng của tháng đầu quý sau.
  - Khi hộ kinh doanh có doanh thu lũy kế sắp vượt ngưỡng, hiển thị cảnh báo sớm.
- Luôn hiển thị dòng: "Thông tin tham khảo, vui lòng xác nhận với kế toán hoặc cơ quan thuế."

### 3.6. Dòng tiền (ba tab: Thu, Chi phí, Công nợ)

- **Thu:** doanh thu đơn hàng theo kênh, thanh toán online (MoMo, VNPAY), COD đã đối soát và chưa đối soát, tiền sàn về.
- **Chi phí:** tất cả chi phí trong tháng gồm:
  - lương nhân sự (từ mục Nhân sự)
  - chi phí quảng cáo từng kênh (Facebook, TikTok, Shopee)
  - các khoản chi tạo trên Pancake (phiếu chi)
  - nhập hàng, phí sàn
- **Công nợ:** phải thu khách hàng và phải trả nhà cung cấp, lấy từ Pancake.
- **Kết quả:** Thu trừ Chi ra kết quả âm hay dương, biểu đồ theo ngày và tháng, dự báo và cảnh báo sắp thiếu tiền.

### Báo cáo tự động
Báo cáo hằng ngày (buổi sáng) và hằng tuần, gửi qua Telegram trước, Zalo sau. Ngắn gọn, có hành động cụ thể.

## 4. Kiểm tra chất lượng dữ liệu (bắt buộc)

Dữ liệu thật của khách dùng thử (Ecobath) trên Pancake đang có các lỗi sau. Website phải **phát hiện và hiển thị banner cảnh báo kèm hướng dẫn sửa trên Pancake**, không được im lặng tính sai:

- **Sản phẩm chưa có giá vốn:** lợi nhuận đang hiện bằng 100% doanh thu, giá trị tồn kho bằng 0đ. Liệt kê các sản phẩm thiếu giá vốn.
- **Đơn không gán nhân viên** (chỉ có "Hệ thống"): KPI theo nhân viên sẽ sai. Cho phép cấu hình quy tắc gán, ví dụ theo kênh hoặc theo người xử lý.
- **Sản phẩm sàn chưa liên kết** (dòng sản phẩm không tên "-"): top sản phẩm bị lệch. Liệt kê để khách liên kết.

## 5. Nguồn dữ liệu & API

| Nguồn | Dùng cho | Ghi chú |
|---|---|---|
| Pancake POS API – `https://pos.pages.fm/api/v1` | Đơn, sản phẩm, tồn kho, kho, khách hàng, phiếu chi, công nợ, nhân viên | API key + Shop ID (POS → Cài đặt → API) |
| Pancake Page API – `https://pages.fm/api/public_api/v1`, `v2` | Hội thoại, tin nhắn, thống kê (phân tích chat) | page_access_token. Tài liệu: docs.pancake.vn |
| Hóa đơn Pancake (invoice.pancake.vn / Sinvoice) | Hóa đơn đã xuất, cần điều chỉnh | Cần kiểm tra API |
| Facebook Graph & Marketing API | Số liệu bài đăng và Reels; chi phí quảng cáo | Page token; quyền ads_read; app review |
| Instagram Graph API | Số liệu bài ảnh và Reels | Tài khoản Business hoặc Creator liên kết Page |
| TikTok Display API / Business API | Số liệu video và ảnh; chi phí quảng cáo (cả GMV Max) | OAuth của chủ kênh; kiểm tra xem bài dạng ảnh có trả số liệu không |
| YouTube Data API v3 | Số liệu video từ link | Chỉ cần API key cho số liệu public |
| Shopee Open Platform | Chi phí ads, phí sàn (nếu Pancake không có) | Làm sau |
| Higgsfield API | Tạo ảnh và video | Key chung của hệ thống |
| Claude API | Kế hoạch content, đề xuất, tóm tắt báo cáo | Key ở server; Haiku để phân loại, Sonnet để viết |

**Quy tắc:** mỗi tích hợp là một module riêng (`/lib/integrations/<ten>`), dữ liệu cache vào database. Không gọi API trực tiếp từ giao diện. **Mọi phép tính tiền (doanh thu, lợi nhuận, lương, KPI, thuế, dòng tiền) do code làm, không do AI làm.** AI chỉ diễn giải và đề xuất.

## 6. Công nghệ

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui; bảng kiểu Sheet dùng **TanStack Table** (sắp xếp, lọc từng cột, sửa trực tiếp, xuất Excel); biểu đồ dùng Recharts
- Supabase: Postgres, Auth, Row Level Security, cron/edge functions
- Deploy trên Vercel
- Giữ đơn giản. Không thêm công nghệ mới khi chưa hỏi tôi.

## 7. Thiết kế

- Bố cục giống Pancake POS: menu dọc bên trái có logo 1Click và logo shop của khách, nội dung dạng thẻ trắng trên nền xám nhạt, màu nhấn xanh dương, số tăng màu xanh lá, số giảm màu đỏ.
- Font: Be Vietnam Pro hoặc Inter. Giao diện tiếng Việt, tiền VND (1.250.000 đ), múi giờ Asia/Ho_Chi_Minh.
- Responsive. Trên điện thoại, thẻ số liệu xếp dọc, bảng cuộn ngang được.
- Nếu có skill `frontend-design`, hãy dùng nó.

## 8. Bảo mật (bắt buộc từ ngày đầu)

- **Multi-tenant:** mọi bảng có `org_id`, bật Row Level Security; viết test chứng minh khách A không đọc được dữ liệu khách B.
- Token và API key của khách: chỉ ở server, mã hóa khi lưu, không gửi xuống trình duyệt.
- Bí mật của hệ thống (Claude, Higgsfield…) nằm trong `.env.local`, có trong `.gitignore`.
- Vai trò: chủ doanh nghiệp, quản lý, nhân viên. Nhân viên chỉ thấy lương và KPI của mình.
- Prompt AI nằm ở server, có biện pháp chống prompt injection.
- Có giới hạn credit Higgsfield và giới hạn gọi Claude theo từng khách, để lỗi code không làm cháy tiền.
- Viết unit test cho mọi công thức tính tiền và quy tắc thuế.

## 9. Làm việc trong VS Code & file HUONG_DAN.md

- Giai đoạn 0, hướng dẫn tôi từng bước: cài VS Code, Node.js, Git, extension Claude Code, mở dự án, chạy web ở máy (`npm run dev`), xem tại http://localhost:3000.
- Tạo và luôn cập nhật file **`HUONG_DAN.md`** bằng tiếng Việt dễ hiểu, gồm:
  - Bản đồ thư mục: thư mục hay file nào làm việc gì (ví dụ "muốn sửa thẻ Doanh thu ở trang Tổng quan thì vào file …").
  - Cách chạy, cách dừng, cách xem lỗi.
  - Cách nhờ Claude Code sửa hoặc thêm tính năng (mẫu câu lệnh hay dùng).
  - Cách quay lại phiên bản cũ bằng git khi sửa hỏng.
  - Cách thêm một quy tắc thuế mới, một mẫu KPI mới, một nền tảng content mới.
  - Cách deploy bản mới lên Vercel.

## 10. Lộ trình – làm theo đúng thứ tự

1. **Giai đoạn 0 – Nền móng:** cài đặt VS Code và các công cụ; khởi tạo dự án và git; Supabase, đăng nhập; schema multi-tenant; layout có menu 6 mục và trang "Kết nối"; hệ thống design; tạo HUONG_DAN.md.
2. **Giai đoạn 1 – Tổng quan (phần bán hàng):** kết nối Pancake POS; đồng bộ đơn, sản phẩm, tồn kho; các thẻ số liệu, nguồn đơn, top 5, tồn kho quy ra tiền; banner kiểm tra dữ liệu (mục 4). Chạy thử với dữ liệu của khách dùng thử Ecobath.
3. **Giai đoạn 2 – Báo cáo tự động** qua Telegram.
4. **Giai đoạn 3 – Dòng tiền:** Thu, Chi phí (Pancake trước, ads nhập CSV, sau đó API), Công nợ.
5. **Giai đoạn 4 – Content:** cấu hình đầu vào, tạo kế hoạch tháng, bảng Sheet, lấy số liệu từ link (YouTube trước, rồi Facebook, Instagram, TikTok), đề xuất theo view, vòng lặp tháng sau.
6. **Giai đoạn 5 – Tạo nội dung:** tích hợp Higgsfield, hệ thống credit.
7. **Giai đoạn 6 – Nhân sự:** chấm công, KPI cấu hình, lương tạm tính.
8. **Giai đoạn 7 – Thuế:** tìm nguồn dữ liệu hóa đơn, bảng quy định thuế, lịch thuế, danh sách cần điều chỉnh.
9. **Giai đoạn 8 – Phân tích chat** (Pancake Page API).

## 11. Việc đầu tiên

Bắt đầu Giai đoạn 0. Trước khi code:
1. Kiểm tra máy tôi đã có VS Code, Node.js, Git chưa; nếu chưa, hướng dẫn tôi cài từng bước.
2. Liệt kê các tài khoản tôi cần tạo (GitHub, Supabase, Vercel) và hướng dẫn từng bước.
3. Trình bày kế hoạch Giai đoạn 0 và chờ tôi đồng ý.

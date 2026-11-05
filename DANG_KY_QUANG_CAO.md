# Đăng ký để 1Click tự lấy tiền quảng cáo Shopee và TikTok

Cả Shopee và TikTok đều bắt **chủ shop tự đăng ký một "ứng dụng"** với họ và **chờ duyệt**. Duyệt xong, anh/chị bấm "cho phép" một lần, sau đó 1Click tự lấy chi phí quảng cáo theo ngày.

Trong lúc chờ duyệt, anh/chị nhập tay bằng **phiếu chi trên Pancake** (xem mục 3).

> ⚠️ **Không gửi** mật khẩu, "Partner Key", "Secret" hay mã truy cập qua chat. Khi 1Click làm xong phần kết nối, trang **Kết nối** sẽ có ô để dán (mã được mã hóa giống khóa Pancake).

Hai địa chỉ cần dùng khi đăng ký (chép nguyên văn):

| Dùng cho | Địa chỉ |
|---|---|
| Tên miền của web (Redirect URL Domain) | `shop.nhankhoitu.com.vn` |
| Shopee: địa chỉ nhận kết quả cho phép (Redirect URL) | `https://shop.nhankhoitu.com.vn/ket-noi/shopee/callback` |
| TikTok: Advertiser redirect URL | `https://shop.nhankhoitu.com.vn/ket-noi/tiktok/callback` |

---

## 1. Shopee (Shopee Open Platform)

### Điều kiện: kiểm tra trước

Ở Việt Nam, Shopee chỉ mở cho shop là **Shop Yêu thích (Preferred Seller)** hoặc **Shopee Mall**. Shop thường sẽ bị từ chối, nên anh/chị kiểm tra Sugar Crush trên Kênh Người Bán trước.

### Các bước

1. **Tạo tài khoản nhà phát triển**
   - Vào https://open.shopee.com, bấm **Log In** rồi **Sign up**, nhập email.
   - Email này **không đổi được** về sau, nên dùng email lâu dài của shop.
   - Mở hộp thư lấy mã xác minh (không thấy thì xem mục Spam), nhập mã, đặt mật khẩu.
2. **Chọn loại tài khoản và nộp hồ sơ**
   - Chọn **Shopee Seller**, rồi chọn:
     - **Registered Business Seller** nếu shop có giấy phép kinh doanh (hộ kinh doanh / công ty), nộp giấy tờ doanh nghiệp;
     - **Individual Seller** nếu bán cá nhân, nộp giấy tờ tùy thân.
   - Hai loại này đều chỉ dùng cho **chính shop của mình**, đúng nhu cầu của 1Click.
   - Gửi duyệt và chờ Shopee trả lời qua email.
3. **Tạo ứng dụng**
   - Khi tài khoản được duyệt, vào **Console**, mở **App List** và tạo App mới loại **Seller In House System** (ứng dụng riêng cho shop mình).
   - Tên gợi ý: `1Click Sugar Crush`.
   - Ô **Redirect URL Domain** (cả Test và Live): nhập `shop.nhankhoitu.com.vn`.
   - Nếu có chỗ chọn nhóm API (API permission / module), chọn **Ads**: 1Click chỉ cần **đọc chi phí quảng cáo**. Nếu không thấy mục Ads, chụp màn hình gửi mình, có thể phải gửi yêu cầu (Raise Ticket) cho Shopee.
   - Gửi App đi duyệt.
4. **Chờ duyệt rồi báo mình.** Duyệt xong, App sẽ có **Partner ID** và **Partner Key**. Anh/chị chỉ cần báo "Shopee đã duyệt", **không gửi** hai mã này qua chat.
5. **Cho phép 1Click đọc shop Sugar Crush.** Bước này làm sau khi mình xong phần kết nối:
   - Trong App List, bấm **Authorize**, điền Redirect URL ở bảng trên.
   - Đăng nhập tài khoản Shopee của Sugar Crush và bấm đồng ý.
   - Shopee cho tối đa **365 ngày**, sau đó phải bấm cho phép lại. 1Click sẽ nhắc trước.

### 1Click sẽ lấy được gì

- Chi phí quảng cáo **theo ngày** của cả shop (quảng cáo tìm kiếm / khám phá), kèm lượt hiển thị, lượt bấm, doanh thu từ quảng cáo.
- Xem lại được tối đa **6 tháng** về trước.

---

## 2. TikTok (TikTok API for Business)

Tiền quảng cáo TikTok Shop (**GMV Max**) nằm ở **TikTok Ads Manager**, nên đăng ký bằng **tài khoản TikTok For Business** đang chạy quảng cáo cho Sugar Crush.

### Các bước

1. **Đăng ký nhà phát triển**
   - Vào https://business-api.tiktok.com/portal và đăng nhập bằng tài khoản TikTok For Business.
   - Bấm **Become a Developer** (hoặc **Register as developer**), điền thông tin liên hệ và công ty. Mỗi tài khoản chỉ làm một lần.
   - Chờ TikTok duyệt.
2. **Tạo ứng dụng** (vào **My Apps**, bấm **Create New App**)
   - Tên: `1Click Sugar Crush`; mô tả: "Ứng dụng nội bộ đọc báo cáo chi phí quảng cáo của shop".
   - **Logo**: ảnh JPG/PNG, tối đa 512×512. Bắt buộc, nếu thiếu thì lúc bấm cho phép sẽ báo lỗi.
   - **Advertiser redirect URL**: địa chỉ TikTok ở bảng đầu trang.
   - **Scope of permission** (quyền): chọn các quyền **đọc báo cáo** (Reporting) và **GMV Max**. Không cần quyền tạo/sửa quảng cáo.
   - Gửi duyệt. Theo các bên tích hợp khác, thường mất khoảng **1–2 tuần**; TikTok không công bố thời gian. Nếu bị từ chối, xem góp ý ở mục **History** của App, sửa rồi gửi lại.
3. **Chờ duyệt rồi báo mình.** App sẽ có **App ID** và **Secret**. Như với Shopee, chỉ báo "TikTok đã duyệt", **không gửi** mã qua chat.
4. **Cho phép 1Click đọc tài khoản quảng cáo.** Làm sau khi mình xong phần kết nối: mở **Advertiser authorization URL** (trong trang App), chọn tài khoản quảng cáo của Sugar Crush và bấm đồng ý.

### 1Click sẽ lấy được gì

- Chi phí (**Cost**) GMV Max theo ngày, kèm số đơn và doanh thu từ quảng cáo.
- Ngày tính theo **múi giờ của tài khoản quảng cáo**. Nên để múi giờ Việt Nam (GMT+7) cho khớp các số khác trên 1Click.

---

## 3. Trong lúc chờ duyệt: nhập tay bằng phiếu chi Pancake

1. Trên Pancake, vào **Thu chi** và tạo **phiếu chi**:
   - số tiền quảng cáo đã chi, cho từng ngày hoặc từng tuần;
   - **Thời điểm phát sinh** = ngày chạy quảng cáo;
   - gắn thẻ **riêng cho từng kênh**, ví dụ một thẻ cho Shopee, một thẻ cho TikTok.
2. Vào 1Click, trang **Dòng tiền**, khung **Thẻ chi phí**: đặt tên thẻ **bắt đầu bằng "Quảng cáo"** rồi tên kênh **đúng như tên nguồn đơn trên Pancake**, ví dụ **Quảng cáo Shopee**, **Quảng cáo TikTok**.
3. Từ đó 1Click tự:
   - trừ vào dòng **Quảng cáo** ở Lợi nhuận kinh doanh và Dòng tiền thực tế (tách riêng, không lẫn với chi phí thường);
   - thêm cột trong bảng tiền chi theo ngày;
   - **cảnh báo** khi quảng cáo **> 12% tổng doanh thu** hoặc **> 25% doanh thu của kênh đó**.

Mẹo: quảng cáo Shopee thường trừ thẳng từ **ví Shopee** (nạp ngân sách quảng cáo). Anh/chị vẫn tạo phiếu chi như trên để 1Click trừ cả ở Dòng tiền thực tế.

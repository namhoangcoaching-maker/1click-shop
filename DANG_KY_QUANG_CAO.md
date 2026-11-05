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

Theo tài liệu Shopee (đọc ngày 05/11/2026). Sugar Crush là **Shop Yêu thích**, đủ điều kiện ở Việt Nam (chỉ nhận Shop Yêu thích hoặc Mall).

### Bước 1: Tạo tài khoản nhà phát triển (khoảng 5 phút)

1. Vào https://open.shopee.com, bấm **Log In** rồi **Sign up**.
2. Nhập email.
   - Email này **không đổi được** về sau, nên dùng email lâu dài của shop.
   - Shopee sẽ gửi thông báo duyệt và cảnh báo về địa chỉ này.
3. Mở hộp thư lấy **mã xác minh**. Không thấy thì xem Spam, hoặc bấm **Resend**.
4. Nhập mã, **đặt mật khẩu**. Trang tự đăng nhập vào Shopee Open Platform.

### Bước 2: Khai báo là người bán và nộp duyệt (Shopee xử lý trong 3 ngày làm việc)

1. Vào **Console**, chọn **App Management**, rồi **App List**. Shopee hỏi loại tài khoản: chọn **Shopee Seller**.
2. Shopee chuyển sang trang **đăng nhập tài khoản người bán**: đăng nhập tài khoản Shopee của **Sugar Crush** (tài khoản Kênh Người Bán) để xác minh.
3. Ô **Seller Type**, chọn:
   - **Registered Business Seller** nếu shop có đăng ký kinh doanh (hộ kinh doanh hoặc công ty), chuẩn bị ảnh/PDF giấy phép;
   - **Individual Seller** nếu bán cá nhân, chuẩn bị giấy tờ tùy thân.
4. Ô **Key Account Manager's Email**: **để trống**, trừ khi shop có nhân viên Shopee phụ trách (email đuôi @shopee.com).
5. Bấm **Next**, điền thông tin hồ sơ, bấm **Submit**.
6. Chờ email kết quả. Nếu bị từ chối, lý do có trong email hoặc ở **Go to Profile** (trang App List); bấm **Edit** sửa rồi gửi lại.

### Bước 3: Tạo ứng dụng (sau khi hồ sơ được duyệt)

1. Trong Console, bấm **Create App**, phần **Basic Information** điền:
   - **App Type**: **Seller In House System**. Đây là loại duy nhất có cả quyền Ads (loại ERP không có Ads).
   - **App Name**: `1Click Sugar Crush`.
   - **App Description**: "Ứng dụng nội bộ của shop Sugar Crush: đọc chi phí quảng cáo và số liệu bán hàng để quản trị."
   - **App Logo**: logo shop.
   - **Redirect URL Domain** (Test và Live, nếu có ô): `shop.nhankhoitu.com.vn`.
2. Tạo xong sẽ có **Test Partner ID** và **Test Key** (chỉ để thử). **Không gửi** mã này qua chat.
3. Trong trang chi tiết App, mục **API Permission**: kiểm tra có nhóm **Ads**. Không thấy thì chụp màn hình gửi mình.

### Bước 4: Đưa ứng dụng lên chạy thật (Shopee duyệt khoảng 24 giờ)

1. Ở **App List**, chọn App, bấm **Go Live**, điền thông tin rồi gửi.
2. Nếu có mục **IT Assets / địa chỉ IP**: web 1Click chạy trên máy chủ đám mây (Vercel), IP thay đổi, nên chọn **IP address(es) unavailable**. Lý do ghi: "Web chạy trên dịch vụ đám mây Vercel, địa chỉ IP thay đổi theo hệ thống."
3. Duyệt xong, mục **App Key** có **Live Partner_id** và **Live Key** (mã thật). Trạng thái App chuyển sang **Online**.
4. **Báo mình "Shopee đã Online"**, **không gửi** Live Key qua chat. Mình làm trang Kết nối để anh/chị tự dán vào (mã được mã hóa).

### Bước 5: Cho phép 1Click đọc shop (làm khi mình báo trang Kết nối đã sẵn)

1. Trên 1Click, trang **Kết nối**, bấm **Kết nối Shopee**. 1Click mở trang của Shopee.
2. Đăng nhập tài khoản người bán Sugar Crush và bấm đồng ý.
3. Mỗi lần cho phép dùng được **tối đa 365 ngày**. 1Click sẽ nhắc trước khi hết hạn.

### 1Click sẽ lấy được gì

- Chi phí quảng cáo **theo ngày** của cả shop, kèm lượt hiển thị, lượt bấm, doanh thu từ quảng cáo.
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

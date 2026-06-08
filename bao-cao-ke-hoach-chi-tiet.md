# Kế hoạch viết báo cáo đồ án hệ thống dịch vụ đặt vé/tra cứu phim

> Mục tiêu: xây dựng một bản báo cáo nhóm hoàn chỉnh, mạch lạc, đúng trọng tâm **mô tả bài toán – phân tích thiết kế – triển khai – đánh giá**, bảo đảm **không quá 50 trang** (không tính phụ lục nếu có).

---

## 1. Mục tiêu của báo cáo

Báo cáo cần chứng minh rằng nhóm đã:

- Hiểu đúng bài toán nghiệp vụ của hệ thống.
- Phân tích rõ yêu cầu người dùng, yêu cầu chức năng và phi chức năng.
- Thiết kế được giải pháp theo hướng dịch vụ, nêu rõ các vấn đề hệ thống phải giải quyết và cách áp dụng các pattern/phương pháp phù hợp.
- Triển khai được sản phẩm có giao diện và chức năng minh họa rõ ràng.
- Đánh giá được mức độ hoàn thành, ưu điểm, hạn chế và hướng phát triển tiếp theo.

---

## 2. Cấu trúc báo cáo đề xuất

### 2.1. Mở đầu

#### 2.1.1. Giới thiệu nhóm
- Tên đề tài.
- Tên lớp/môn học.
- Danh sách thành viên nhóm.
- Giảng viên hướng dẫn.
- Thời gian thực hiện.

#### 2.1.2. Phân chia công việc
Trình bày bảng phân công nhiệm vụ cho từng thành viên, bao gồm:
- Họ tên.
- Vai trò chính.
- Công việc phụ trách.
- Tỷ lệ đóng góp (%).

**Lưu ý:** tổng tỷ lệ đóng góp phải bằng **100%**.

##### Mẫu bảng đề xuất
| STT | Họ và tên | Vai trò | Công việc phụ trách | Tỷ lệ đóng góp |
|-----|-----------|---------|---------------------|----------------|
| 1 | Nguyễn Văn A | Nhóm trưởng | Tổng hợp báo cáo, phân tích yêu cầu | 20% |
| 2 | Trần Văn B | Backend | Thiết kế dịch vụ, API, triển khai chính | 45% |
| 3 | Lê Văn C | Frontend | Giao diện, luồng chức năng | 20% |
| 4 | Phạm Thị D | Kiểm thử & tài liệu | Test, chỉnh sửa báo cáo, slide | 15% |

---

## 3. Phần 1: Mô tả bài toán

> Đây là phần rất quan trọng vì đặt nền tảng cho toàn bộ báo cáo.

### 3.1. Bối cảnh bài toán
Trình bày ngắn gọn hệ thống đang giải quyết vấn đề gì, ví dụ:
- Người dùng cần tra cứu phim, lịch chiếu, suất chiếu.
- Người dùng cần đặt vé nhanh chóng và tiện lợi.
- Quản trị viên cần quản lý phim, suất chiếu, banner, thông tin khuyến mãi.
- Hệ thống cần hỗ trợ trải nghiệm trực tuyến, giảm thao tác thủ công.

### 3.2. Phân tích yêu cầu người dùng
Mô tả theo từng nhóm người dùng:

#### 3.2.1. Người dùng khách/khách vãng lai
- Xem danh sách phim.
- Xem phim đang chiếu và sắp chiếu.
- Xem chi tiết phim.
- Xem lịch chiếu/suất chiếu.
- Xem banner khuyến mãi hoặc nội dung nổi bật.

#### 3.2.2. Người dùng đã đăng ký/đã đăng nhập
- Đặt vé.
- Chọn suất chiếu.
- Chọn ghế.
- Thanh toán (nếu có trong phạm vi đồ án).
- Xem lịch sử đặt vé.
- Quản lý thông tin cá nhân.

#### 3.2.3. Quản trị viên
- Quản lý phim.
- Quản lý suất chiếu.
- Quản lý rạp/phòng/ghế.
- Quản lý banner/trang chủ.
- Theo dõi dữ liệu hệ thống.

### 3.3. Yêu cầu chức năng
Liệt kê theo module và viết rõ ràng, có thể chia thành các nhóm sau:

#### 3.3.1. Chức năng cho khách hàng
- Xem trang chủ.
- Xem danh sách phim.
- Lọc phim đang chiếu/sắp chiếu.
- Xem thông tin chi tiết phim.
- Xem lịch chiếu theo phim.
- Tìm kiếm phim.
- Đặt vé.

#### 3.3.2. Chức năng cho quản trị viên
- Thêm/sửa/xóa phim.
- Thêm/sửa/xóa lịch chiếu.
- Quản lý banner trang chủ.
- Quản lý thông báo/khuyến mãi.
- Quản lý người dùng (nếu có).

#### 3.3.3. Chức năng hệ thống
- Xác thực người dùng.
- Phân quyền.
- Đồng bộ dữ liệu giữa frontend và backend.
- Xử lý lỗi API.
- Lưu trạng thái giao diện/hành vi người dùng cần thiết.

### 3.4. Yêu cầu phi chức năng
Đây là phần **bắt buộc phải viết kỹ**.

Nên trình bày theo các nhóm:

#### 3.4.1. Hiệu năng
- Thời gian tải trang chấp nhận được.
- API phản hồi nhanh.
- Tối ưu khi danh sách phim/suất chiếu lớn.

#### 3.4.2. Tính khả dụng và trải nghiệm người dùng
- Giao diện dễ hiểu.
- Điều hướng rõ ràng.
- Tương thích nhiều kích thước màn hình.

#### 3.4.3. Độ tin cậy
- Hệ thống không bị lỗi khi API thất bại một phần.
- Có cơ chế hiển thị thông báo lỗi thân thiện.
- Dữ liệu banner/phim vẫn có dữ liệu mặc định khi mất kết nối.

#### 3.4.4. Bảo mật
- Phân quyền người dùng và admin.
- Bảo vệ API nhạy cảm.
- Không lộ thông tin đăng nhập.

#### 3.4.5. Bảo trì và mở rộng
- Kiến trúc dễ thay đổi.
- Tách frontend/backend rõ ràng.
- Có thể bổ sung module mới mà ít ảnh hưởng phần còn lại.

#### 3.4.6. Tính tương thích
- Hoạt động tốt trên trình duyệt phổ biến.
- Giao diện responsive.

### 3.5. Mô tả bài toán bằng Use Case

#### 3.5.1. Biểu đồ Use Case tổng quan
Nên có một biểu đồ tổng thể thể hiện:
- Actor: Khách hàng, Người dùng đăng nhập, Quản trị viên.
- Các use case chính: xem phim, xem chi tiết, đặt vé, quản lý phim, quản lý suất chiếu, quản lý banner...

#### 3.5.2. Danh sách Use Case chi tiết
Mỗi use case nên có:
- Tên use case.
- Mô tả ngắn.
- Actor chính.
- Tiền điều kiện.
- Hậu điều kiện.
- Luồng chính.
- Luồng thay thế/ngoại lệ.

##### Mẫu đặc tả Use Case
**Tên UC:** Xem danh sách phim
- **Actor:** Khách hàng
- **Mục tiêu:** Hiển thị danh sách phim đang chiếu/sắp chiếu.
- **Tiền điều kiện:** Người dùng mở trang web.
- **Hậu điều kiện:** Người dùng xem được thông tin phim.
- **Luồng chính:**
  1. Người dùng truy cập trang chủ.
  2. Hệ thống tải danh sách phim.
  3. Hệ thống hiển thị phim theo tab.
- **Ngoại lệ:** Nếu API lỗi, hệ thống hiển thị thông báo và dữ liệu dự phòng.

### 3.6. Trình bày công nghệ sử dụng
Phần này nên nêu rõ **công nghệ nào, dùng để làm gì, vì sao chọn**.

#### 3.6.1. Frontend
- React.js.
- React Router.
- Hooks: `useState`, `useEffect`, `useMemo`.
- Kiến trúc component hóa.
- CSS / SCSS / styled approach tùy dự án.

#### 3.6.2. Backend
- Ngôn ngữ backend: **Go**.
- Mô hình API: **RESTful API**.
- Xử lý dữ liệu phim, suất chiếu, banner, đặt vé.
- Ưu tiên hiệu năng, dễ mở rộng và phù hợp triển khai dịch vụ.

#### 3.6.3. Cơ sở dữ liệu
- Hệ quản trị CSDL.
- Các bảng chính: phim, suất chiếu, người dùng, đặt vé, banner...

#### 3.6.4. Công cụ hỗ trợ
- Git/GitHub.
- Postman.
- VS Code.
- Công cụ vẽ UML.

#### 3.6.5. Lý do chọn công nghệ
Nên trình bày dạng so sánh ngắn gọn:
- Dễ phát triển giao diện.
- Dễ mở rộng.
- Tách biệt rõ frontend/backend.
- Phù hợp đồ án nhóm.

---

## 4. Phân tích thiết kế

> Đây là phần trọng tâm thứ hai, đặc biệt là thiết kế theo hướng dịch vụ.

### 4.1. Phân tích thiết kế chức năng bằng UML

#### 4.1.1. Biểu đồ hoạt động (Activity Diagram)
Nên vẽ cho các luồng tiêu biểu như:
- Xem danh sách phim.
- Xem chi tiết phim.
- Đặt vé.
- Quản lý phim.

Mỗi biểu đồ cần thể hiện:
- Điểm bắt đầu/kết thúc.
- Các bước xử lý.
- Điều kiện rẽ nhánh.
- Xử lý lỗi hoặc ngoại lệ.

#### 4.1.2. Biểu đồ tuần tự (Sequence Diagram)
Nên có cho các tình huống chính:
- Người dùng mở trang chủ và tải phim.
- Người dùng chọn phim và xem chi tiết.
- Người dùng đặt vé.
- Admin cập nhật banner/phim.

Mỗi sequence diagram cần thể hiện:
- Actor.
- Frontend.
- Backend/API.
- Database (nếu cần).
- Luồng request/response rõ ràng.

### 4.2. Thiết kế mô hình hướng dịch vụ

> Đây là phần quan trọng nhất theo yêu cầu của thầy. Cần làm rõ: hệ thống phải giải quyết vấn đề gì, thiết kế dịch vụ ra sao, áp dụng pattern nào.

#### 4.2.1. Vấn đề hệ thống cần giải quyết
Trình bày các vấn đề thực tế:
- Dữ liệu phim, lịch chiếu, banner được cập nhật liên tục.
- Cần tách giao diện ra khỏi nghiệp vụ.
- Cần dễ mở rộng thêm tính năng.
- Cần đảm bảo việc gọi dữ liệu từ nhiều nguồn không làm rối giao diện.
- Cần xử lý lỗi từng phần thay vì làm sập toàn bộ trang.

#### 4.2.2. Định hướng thiết kế theo dịch vụ
Mô tả các lớp dịch vụ/module dịch vụ trong hệ thống, ví dụ:
- Dịch vụ phim.
- Dịch vụ suất chiếu.
- Dịch vụ banner.
- Dịch vụ đặt vé.
- Dịch vụ người dùng.

Mỗi dịch vụ nên nêu:
- Trách nhiệm.
- Dữ liệu đầu vào/đầu ra.
- API liên quan.
- Cách frontend gọi dịch vụ.

#### 4.2.3. Phân rã chức năng theo service/module
Có thể trình bày theo bảng:

| Service/Module | Trách nhiệm | Dữ liệu xử lý | Giao tiếp |
|---------------|-------------|---------------|----------|
| Movie Service | Quản lý phim | tên phim, mô tả, poster | REST API |
| Showtime Service | Quản lý lịch chiếu | suất chiếu, phòng, thời gian | REST API |
| Banner Service | Quản lý banner trang chủ | ảnh banner, trạng thái | REST API |
| Booking Service | Đặt vé | ghế, suất chiếu, đơn đặt | REST API |

#### 4.2.4. Áp dụng pattern thiết kế
Nên nêu rõ các pattern đã dùng hoặc phù hợp với hệ thống:

- **Service Layer**: tách logic nghiệp vụ khỏi giao diện.
- **Repository Pattern**: tách truy cập dữ liệu khỏi logic xử lý.
- **DTO Pattern**: đóng gói dữ liệu truyền giữa các tầng.
- **Adapter/Mapper Pattern**: chuyển đổi dữ liệu từ API sang dữ liệu hiển thị.
- **Singleton/Shared Service** nếu dự án có service dùng chung.
- **Component-based design** ở frontend để tái sử dụng giao diện.
- **Fallback/Default Data Pattern** trong các phần như banner, dữ liệu phim khi API lỗi.

#### 4.2.5. Luồng dữ liệu trong hệ thống
Mô tả từ giao diện đến backend:
1. Người dùng thao tác trên UI.
2. Frontend gọi API.
3. Service xử lý dữ liệu.
4. Backend trả về response.
5. Frontend render kết quả.
6. Nếu lỗi, hệ thống hiển thị thông báo phù hợp.

#### 4.2.6. Kiến trúc tổng thể
Nên mô tả ngắn gọn theo mô hình:
- Presentation layer.
- Application/Service layer.
- Data access layer.
- Database.

Nếu dự án có frontend riêng, hãy nhấn mạnh:
- Frontend là lớp trình bày.
- Backend là lớp xử lý nghiệp vụ và cung cấp API.
- CSDL là nơi lưu trữ tập trung.

#### 4.2.7. Tính mở rộng và bảo trì
Nêu rõ cách thiết kế giúp hệ thống dễ phát triển:
- Thêm phim mới không ảnh hưởng các màn hình khác.
- Bổ sung tính năng khuyến mãi chỉ cần thêm module riêng.
- Tách component giúp tái sử dụng.
- Thay đổi API không làm thay đổi toàn bộ giao diện.

---

## 5. Kết quả triển khai, đánh giá

### 5.1. Giao diện các chức năng
Trình bày ảnh chụp màn hình hoặc hình minh họa các màn hình chính:
- Trang chủ.
- Danh sách phim.
- Tab phim đang chiếu/sắp chiếu.
- Chi tiết phim.
- Trang đặt vé.
- Trang quản trị (nếu có).

**Lưu ý:** mỗi ảnh nên có chú thích, ví dụ:
- Hình 5.1. Trang chủ hệ thống.
- Hình 5.2. Danh sách phim đang chiếu.

### 5.2. Mô tả kết quả đạt được
Nêu rõ:
- Những chức năng đã hoàn thành.
- Mức độ đáp ứng yêu cầu ban đầu.
- Những phần đã triển khai tốt.
- Dữ liệu/luồng nghiệp vụ đã chạy ổn định.

### 5.3. Đánh giá
Phần này nên chia thành 3 ý:

#### 5.3.1. Ưu điểm
- Giao diện trực quan.
- Chức năng chính đầy đủ.
- Kiến trúc tách lớp rõ.
- Dễ mở rộng.

#### 5.3.2. Hạn chế
- Một số chức năng nâng cao chưa hoàn thiện.
- Chưa tích hợp thanh toán thực.
- Chưa có tối ưu nâng cao cho dữ liệu lớn.
- Phụ thuộc vào dữ liệu API.

#### 5.3.3. Hướng phát triển
- Bổ sung đặt vé online hoàn chỉnh.
- Tích hợp thanh toán.
- Thêm thông báo tự động.
- Thêm đánh giá phim, bình luận.
- Cải thiện tối ưu hiệu năng và bảo mật.

---

## 6. Gợi ý phân bổ số trang để không quá 50 trang

Một phân bổ hợp lý như sau:

| Phần | Nội dung | Số trang gợi ý |
|------|----------|-----------------|
| Mở đầu | Giới thiệu nhóm, phân công | 1–2 trang |
| Phần 1 | Mô tả bài toán, yêu cầu, UC, công nghệ | 10–14 trang |
| Phân tích thiết kế | UML, thiết kế hướng dịch vụ, pattern | 15–18 trang |
| Kết quả triển khai, đánh giá | Giao diện, kết quả, nhận xét | 10–12 trang |
| Kết luận + tài liệu tham khảo | Tóm tắt, hướng phát triển | 1–2 trang |
| **Tổng** |  | **Khoảng 40–48 trang** |

---

## 7. Cách viết cho báo cáo nhìn chuyên nghiệp

### 7.1. Văn phong
- Viết học thuật, rõ ràng, ngắn gọn.
- Ưu tiên câu chủ động và mô tả có cấu trúc.
- Tránh lan man, tránh kể lể lịch sử không cần thiết.

### 7.2. Trình bày
- Mỗi hình, bảng đều có số thứ tự và chú thích.
- Dùng thống nhất font, cỡ chữ, khoảng cách dòng.
- Mỗi mục nên có 1–3 đoạn ngắn, tránh quá dài.

### 7.3. Về biểu đồ
- Biểu đồ UC: dùng cho mô tả chức năng tổng quan.
- Use Case Specification: dùng cho các chức năng quan trọng.
- Activity Diagram: mô tả luồng xử lý.
- Sequence Diagram: mô tả tương tác giữa các thành phần.

---

## 8. Dàn ý chi tiết để triển khai ngay thành báo cáo

### Chương 1. Mở đầu
1.1 Giới thiệu đề tài
1.2 Thành viên nhóm
1.3 Phân công công việc và tỷ lệ đóng góp

### Chương 2. Mô tả bài toán
2.1 Bối cảnh và mục tiêu hệ thống
2.2 Phân tích yêu cầu người dùng
2.3 Yêu cầu chức năng
2.4 Yêu cầu phi chức năng
2.5 Biểu đồ Use Case tổng quan
2.6 Đặc tả các Use Case chính
2.7 Công nghệ sử dụng

### Chương 3. Phân tích thiết kế
3.1 Phân tích chức năng bằng UML
3.2 Biểu đồ Activity
3.3 Biểu đồ Sequence
3.4 Thiết kế mô hình hướng dịch vụ
3.5 Phân rã service/module
3.6 Áp dụng pattern thiết kế
3.7 Kiến trúc tổng thể hệ thống

### Chương 4. Kết quả triển khai và đánh giá
4.1 Giao diện các chức năng
4.2 Kết quả đạt được
4.3 Đánh giá ưu điểm, hạn chế
4.4 Hướng phát triển

### Kết luận
- Tóm tắt đóng góp của nhóm.
- Khẳng định mức độ hoàn thành mục tiêu.

### Tài liệu tham khảo
- Sách, tài liệu môn học, website công nghệ, tài liệu framework, API.

---

## 9. Checklist trước khi nộp

- [ ] Đã có thông tin nhóm và bảng đóng góp đủ 100%.
- [ ] Đã mô tả rõ yêu cầu người dùng, chức năng và phi chức năng.
- [ ] Đã có biểu đồ UC và đặc tả các UC chính.
- [ ] Đã mô tả công nghệ sử dụng.
- [ ] Đã có Activity và Sequence diagram.
- [ ] Đã làm rõ thiết kế theo hướng dịch vụ.
- [ ] Đã nêu pattern áp dụng.
- [ ] Đã chèn giao diện minh họa.
- [ ] Đã có đánh giá và hướng phát triển.
- [ ] Tổng số trang không vượt quá 50.

---

## 10. Gợi ý quan trọng khi viết phần “thiết kế hướng dịch vụ”

Để phần này đạt điểm tốt, nên trả lời được 4 câu hỏi sau:

1. **Hệ thống đang gặp vấn đề gì?**
   - Dữ liệu phân tán, nhiều chức năng, cần mở rộng, cần xử lý lỗi linh hoạt.

2. **Dịch vụ nào cần được tách ra?**
   - Phim, suất chiếu, đặt vé, banner, người dùng.

3. **Mỗi dịch vụ giải quyết việc gì?**
   - Mỗi service có trách nhiệm rõ ràng, ít phụ thuộc lẫn nhau.

4. **Áp dụng pattern nào để hệ thống dễ bảo trì?**
   - Service Layer, Repository, DTO, Mapper, Fallback data, Component reuse.

Nếu viết được đầy đủ 4 ý này, phần kiến trúc và hướng dịch vụ sẽ rất thuyết phục.

---

## 11. Phần mô tả chi tiết những gì đã sử dụng và đã làm trong dự án hiện tại

Phần này nên viết theo hướng "đi từ thực tế triển khai của nhóm", tức là không chỉ nêu ý tưởng mà phải mô tả rõ **dự án hiện tại đang có gì, đã làm được gì, dùng công nghệ nào, và kiến trúc được tổ chức ra sao**.

### 11.1. Tổng quan hệ thống đang triển khai
Dự án hiện tại là một hệ thống đặt vé/xem phim theo hướng dịch vụ, trong đó:
- **Frontend** được xây dựng bằng **React**.
- **Backend** được xây dựng bằng **Go**.
- Hệ thống backend được chia thành nhiều service độc lập.
- Có **API Gateway** làm cổng vào duy nhất cho phía client.
- Các service giao tiếp với nhau qua HTTP, và một số luồng có dùng message/event để xử lý bất đồng bộ.

Mô hình này giúp hệ thống tách biệt rõ ràng giữa giao diện, nghiệp vụ và dữ liệu, phù hợp với yêu cầu mở rộng sau này.

### 11.2. Những công nghệ đã sử dụng trong dự án
#### Frontend
- **React 18**: xây dựng giao diện người dùng theo component.
- **React Router DOM**: điều hướng giữa các trang.
- **Vite**: công cụ build nhanh, hỗ trợ phát triển frontend hiện đại.
- **Hooks** như `useState`, `useEffect`, `useMemo`: quản lý trạng thái và tối ưu render.
- **React QR Code**: hỗ trợ sinh mã QR trong các màn hình liên quan đến vé/thanh toán nếu cần.

#### Backend
- **Go**: ngôn ngữ chính của toàn bộ backend.
- **net/http**: xây dựng server và route handler.
- **httputil.ReverseProxy**: triển khai API Gateway để chuyển tiếp request đến từng service.
- **PostgreSQL**: lưu trữ dữ liệu nghiệp vụ.
- **database/sql** và driver `lib/pq`: kết nối CSDL.
- **Prometheus**: thu thập metrics HTTP.
- **OpenTelemetry**: tracing và quan sát hệ thống.
- **NATS**: xử lý event/message giữa các service ở những luồng cần bất đồng bộ.
- **Stripe integration**: phục vụ luồng thanh toán.

#### Công cụ phát triển
- **Git/GitHub**: quản lý mã nguồn.
- **Postman**: kiểm thử API.
- **VS Code / Cursor**: phát triển và chỉnh sửa mã nguồn.
- **Markdown**: viết tài liệu báo cáo.

### 11.3. Kiến trúc backend hiện tại
Backend của dự án được tổ chức theo mô hình **microservices**. Các service chính đã xuất hiện trong hệ thống gồm:
- `api-gateway`
- `auth-service`
- `user-service`
- `catalog-service`
- `booking-service`
- `payment-service`
- `order-service`

Mỗi service đảm nhận một trách nhiệm rõ ràng:
- **API Gateway**: nhận request từ frontend, điều hướng đến service phù hợp, đồng thời xử lý CORS, rate limit, logging, tracing và một phần resilience.
- **Auth Service**: xử lý xác thực và các luồng liên quan đến đăng nhập/xác thực người dùng.
- **User Service**: quản lý thông tin người dùng.
- **Catalog Service**: quản lý dữ liệu danh mục như phim, thể loại, suất chiếu, rạp/phòng, và dữ liệu quản trị liên quan.
- **Booking Service**: quản lý đặt chỗ, giữ ghế, đặt vé và các luồng liên quan đến booking.
- **Payment Service**: xử lý thanh toán.
- **Order Service**: quản lý đơn hàng / thông tin đơn sau khi đặt.

### 11.4. Những phần đã triển khai trong backend
Từ mã nguồn hiện tại, có thể mô tả các phần chính đã làm như sau:

#### 11.4.1. API Gateway
API Gateway là điểm vào duy nhất cho client và đã được triển khai với các chức năng sau:
- Chuyển tiếp request đến đúng service theo prefix của đường dẫn.
- Hỗ trợ CORS cho frontend chạy ở localhost và domain triển khai.
- Gắn `X-Request-ID` cho từng request để theo dõi log.
- Ghi log truy cập kèm thời gian xử lý.
- Thu thập metrics cho Prometheus.
- Áp dụng giới hạn tần suất request (rate limiting).
- Có timeout cho request.
- Có cơ chế retry và circuit breaker để tăng độ ổn định khi service phía sau bị lỗi.
- Hỗ trợ health check và readiness check.

#### 11.4.2. Booking Service
Booking Service đang xử lý các chức năng nghiệp vụ quan trọng:
- Kết nối PostgreSQL để lưu dữ liệu.
- Tự động tạo/đảm bảo schema dữ liệu trước khi chạy.
- Quản lý booking repository và reservation repository.
- Giao tiếp với Payment Service để phục vụ thanh toán.
- Giao tiếp với Order Service để đồng bộ dữ liệu đơn hàng.
- Tích hợp NATS để phát event khi có hoạt động cần xử lý bất đồng bộ.
- Có metrics, log, tracing và graceful shutdown.

#### 11.4.3. Các service dữ liệu và nghiệp vụ khác
Các service còn lại trong dự án cũng đã được tổ chức theo mô hình rõ ràng, mỗi service có:
- `main.go` để khởi động server.
- `handler` để xử lý HTTP routes.
- `repository` hoặc `model` để quản lý dữ liệu.
- `cmd/server` để chuẩn hóa cấu trúc chạy ứng dụng.

### 11.5. Những phần đã triển khai ở frontend
Frontend hiện tại đã làm được các chức năng chính:
- Trang chủ hiển thị banner động.
- Danh sách phim theo tab.
- Phân biệt phim đang chiếu và phim sắp chiếu.
- Hiển thị phim nổi bật.
- Gọi API để lấy dữ liệu phim, lịch chiếu và banner.
- Xử lý lỗi khi API không phản hồi đầy đủ.
- Lưu banner dự phòng vào `localStorage` để tăng tính ổn định giao diện.

Một số điểm kỹ thuật nổi bật ở frontend:
- Dùng component để tái sử dụng giao diện.
- Dùng `useMemo` để nhóm lịch chiếu theo phim và tối ưu render.
- Dùng `useEffect` để gọi API khi trang được tải.
- Có carousel/banner tự động chuyển đổi theo thời gian.
- Giao diện có các nút chuyển tab, liên kết điều hướng và các trạng thái hiển thị rõ ràng.

### 11.6. Những pattern và kỹ thuật đã áp dụng
Trong dự án hiện tại có thể nêu rõ các pattern/kỹ thuật sau:
- **Microservices Architecture**: chia hệ thống thành nhiều dịch vụ nhỏ, độc lập.
- **API Gateway Pattern**: gom điểm vào và định tuyến request.
- **Service Layer**: tách logic nghiệp vụ ra khỏi handler.
- **Repository Pattern**: tách truy cập dữ liệu khỏi logic xử lý.
- **Reverse Proxy Pattern**: triển khai trong gateway.
- **Circuit Breaker**: tránh gọi liên tục đến service đang lỗi.
- **Retry Pattern**: thử lại request idempotent khi tạm thời lỗi.
- **Rate Limiting**: hạn chế request từ một client trong khoảng thời gian nhất định.
- **Observability Pattern**: dùng logging, metrics, tracing để theo dõi hệ thống.
- **Component Reuse** ở frontend để chia nhỏ giao diện thành từng khối độc lập.

### 11.7. Kết quả hiện tại của dự án
Từ những gì đã làm được, có thể mô tả kết quả dự án như sau:
- Hệ thống đã có cấu trúc rõ ràng theo hướng dịch vụ.
- Frontend và backend được tách biệt.
- Các service backend giao tiếp qua HTTP qua API Gateway.
- Các chức năng hiển thị phim, banner, lịch chiếu và luồng booking đã có nền tảng triển khai.
- Hệ thống có sẵn các cơ chế hỗ trợ vận hành như log, metrics, tracing và graceful shutdown.
- Giao diện frontend đã có các thành phần chính phục vụ người dùng cuối.

### 11.8. Cách đưa phần này vào báo cáo
Khi viết báo cáo, phần này nên được dùng như một mục riêng trong chương “Phân tích thiết kế” hoặc “Kết quả triển khai”, với cách trình bày theo thứ tự:
1. Tổng quan kiến trúc hiện tại.
2. Công nghệ sử dụng.
3. Các service đã làm.
4. Chức năng đã hoàn thiện ở frontend/backend.
5. Pattern kỹ thuật đã áp dụng.
6. Kết quả đạt được.

## 12. Kết luận ngắn cho kế hoạch

Báo cáo nên đi theo mạch:

**Bối cảnh → yêu cầu → use case → công nghệ → thiết kế UML → thiết kế hướng dịch vụ → triển khai → đánh giá**

Cách trình bày này giúp báo cáo logic, đúng trọng tâm, dễ đạt yêu cầu của giảng viên và vẫn kiểm soát được dung lượng dưới 50 trang.

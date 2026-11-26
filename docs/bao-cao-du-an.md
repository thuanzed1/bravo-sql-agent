# Walkthrough: Chuyển đổi SQL Server ↔ PostgreSQL (Bidirectional Converter)

Đã hoàn tất 100% tính năng chuyển đổi qua lại giữa **T-SQL (SQL Server)** và **PostgreSQL** trong ứng dụng **BRAVO SQL Agent**.

---

## 1. Các điểm nổi bật đã triển khai

### A. Nút chuyển đổi 1-Click trên mỗi khối code (SqlBlock)
- Trên mỗi khối mã SQL xuất hiện nút **`🔄 → PostgreSQL`** (nếu code hiện tại là T-SQL) hoặc **`🔄 → T-SQL`** (nếu code hiện tại là PostgreSQL).
- Nhãn Dialect được cập nhật trực quan (`T-SQL` hoặc `PostgreSQL`).
- Khi click, hệ thống tự động gửi yêu cầu chuyển đổi tới mô hình AI đang chọn (Gemini / OpenAI / Ollama) và tạo phiên phản hồi mới với code đã được dịch chính xác cú pháp.

### B. Lệnh `/convert` trên thanh CommandBar
- Gõ `/convert` kèm đoạn code SQL bất kỳ để chuyển đổi.
- **Tự động nhận diện (Auto-detect)**: AI tự động phân tích cú pháp nguồn là T-SQL hay PostgreSQL để chuyển đổi sang hệ còn lại.
- **Hỗ trợ tập tin đính kèm**: Nếu bạn đính kèm file `.sql` qua nút 📎 rồi gõ `/convert`, AI sẽ đọc file và xuất bản chuyển đổi, kèm nút **`💾 Ghi vào file`** để lưu đè ngay lập tức.

### C. Cơ chế "Training" AI không cần Python (In-Context Learning)
Toàn bộ bảng quy tắc ánh xạ được cấu hình trực tiếp vào **System Prompt** chuyên biệt, đảm bảo AI tuân thủ nghiêm ngặt nguyên tắc: **Chỉ chuyển đổi cú pháp, tuyệt đối không thêm bớt sửa xóa logic nghiệp vụ**:
- `TOP n` ↔ `LIMIT n`
- `ISNULL(x, y)` ↔ `COALESCE(x, y)`
- `GETDATE()` ↔ `NOW()`
- `DATEADD()` ↔ `+ INTERVAL 'n ...'`
- `DATEDIFF()` ↔ `DATE_PART()`
- `[cột]` ↔ `"cột"`
- `dbo.Bảng` ↔ `public.Bảng`
- `nvarchar` / `datetime` ↔ `varchar` / `timestamp`
- `int IDENTITY` ↔ `SERIAL`

---

## 4. Tích hợp Tài liệu Huấn luyện AI — Chuẩn Code SQL BRAVO
Đã nạp toàn bộ bộ quy tắc và checklist nghiệp vụ vào **System Instruction** của AI Agent:
- **Mục 0**: Định vị vai trò chuyên gia Kho - Kế toán BRAVO.
- **Mục 1 (Rule bắt buộc)**:
  - Cấm subquery trong SELECT list.
  - DISTINCT chỉ dùng cho trường index; GROUP BY tối đa 1 trường (trường thừa bọc `MAX()`).
  - Hạn chế NULL (số → 0, chuỗi → `' '`), SUM trên tập dữ liệu đã gộp sẵn.
  - `FROM` từ bảng gốc (`CTCT`) trước khi JOIN danh mục.
  - `BEGIN...END` cho khối > 2 lệnh con; biến không dấu `varchar`, có dấu `nvarchar`.
  - Nghiệp vụ NXT: **CẤM TUYỆT ĐỐI JOIN trực tiếp bảng phát sinh với bảng tồn đầu**, bắt buộc qua bảng Temp trung gian (`UNION ALL`).
  - Tối ưu bảng Temp `#NhapXuat` tái sử dụng, tránh lặp lại subquery.
- **Mục 2 (Phong cách tối ưu từ bài chữa thực tế)**:
  - Bọc `ISNULL(ROUND(...))` có chọn lọc, không tràn lan.
  - Ghép chuỗi điều kiện lọc động bằng Dynamic SQL thay vì tổ hợp nhánh IF.
  - Báo cáo subtotal đa cấp bằng cột đánh dấu cấp hiển thị (`STT1 = 1, 2, 3`).
  - Idempotent: luôn xoá bảng tạm trước khi tạo (`IF OBJECT_ID('tempdb..#...') IS NOT NULL DROP TABLE...`).
  - Gộp lệnh bằng `SELECT...INTO...UNION ALL`.
  - Giới hạn CTE tối đa 1 `WITH AS` / 1 bài, ưu tiên bảng Temp `#`.
  - Window function đổ ra bảng tạm trước khi lọc `WHERE`.
---

## 5. Nút Chuyển đổi Giao diện Tối ↔ Sáng (Dark / Light Mode)
Đã tích hợp nút chuyển đổi giao diện tiện lợi:
- **Vị trí**: Nằm ở góc trên cùng bên phải thanh **TitleBar** (ngay cạnh nút "Khung lệnh Ctrl+K").
- **Biểu tượng**: 
  - Đang ở chế độ Tối → Hiển thị biểu tượng ☀️ **Mặt trời** (Bấm để chuyển sang Sáng).
  - Đang ở chế độ Sáng → Hiển thị biểu tượng 🌙 **Mặt trăng** (Bấm để chuyển sang Tối).
- **Trải nghiệm Light Mode**:
  - Tông màu nền chuyển sang màu trắng/xám trang nhã (`#ffffff` / `#f6f8fa`), chữ màu đen đậm dễ đọc (`#1f2328`).
  - Màu cú pháp SQL (Syntax Highlighting) tự động chuyển sang palette ban ngày sắc nét: Từ khóa màu đỏ (`#cf222e`), chuỗi màu xanh navy (`#0a3069`), số màu xanh dương (`#0550ae`).
  - Tự động ghi nhớ lựa chọn của người dùng vào `localStorage`, lần sau mở app lên sẽ giữ nguyên giao diện yêu thích.

---

## 6. Tính năng Sửa & Ghi File SQL Thông Minh (Smart Patching / Non-Destructive Editing)
Đã triển khai cơ chế chỉnh sửa và ghi file SQL an toàn, đáp ứng chính xác 6 nguyên tắc bất biến:
1. **Tuyệt đối không xóa toàn bộ file cũ**: File gốc được bảo toàn 100%, chỉ can thiệp vào đúng vùng mã cần sửa hoặc chèn thêm.
2. **Cơ chế Tìm-và-Thay-thế Thông minh (Smart Patching)**:
   - *Chiến lược 1 (Routine AST Matching)*: Tự động phát hiện tên đối tượng (`CREATE/ALTER PROCEDURE`, `VIEW`, `FUNCTION`, `TABLE`) để thay thế chính xác khối lệnh cũ mà không làm xáo trộn các thủ tục khác trong file.
   - *Chiến lược 2 (Statement Similarity Matching)*: So sánh độ tương đồng token (Jaccard Similarity) để tìm đúng câu query (SELECT / UPDATE / INSERT) cần chỉnh sửa.
3. **Chế độ Thêm mới (Append)**: Khi tạo query/procedure mới, code được nối thêm vào cuối file kèm dòng header ghi chú thời gian và phân cách rõ ràng, không làm ảnh hưởng code cũ.
4. **Xác định rõ phạm vi thay đổi**: Trước khi ghi, hệ thống phân tích và hiển thị thông báo chi tiết: dòng bắt đầu, dòng kết thúc, số dòng bị tác động (ví dụ: `Đã thay thế [dbo].[sp_BaoCaoTonKho] tại dòng 45 → 98`).
5. **Bảo toàn nguyên vẹn**: Giữ nguyên comment, định dạng, biến, thứ tự các thủ tục khác trong file.
6. **Bộ nút điều khiển linh hoạt trên SqlBlock**:
   - 🎯 **Sửa đoạn code liên quan (Mặc định)**: Tự động phân tích và thay thế đúng vị trí cần sửa.
   - ➕ **Ghi nối thêm vào cuối**: Nối đoạn code mới vào cuối file hiện tại.
   - ⚠️ **Ghi đè toàn bộ file**: Chỉ thực hiện khi người dùng chủ động chọn và có xác nhận cảnh báo.




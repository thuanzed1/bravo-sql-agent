# BỘ TESTCASE VÀ KỊCH BẢN DEMO ĐỀ ÁN: BRAVO SQL AGENT
**Hệ thống AI Trợ lý Kỹ sư Dữ liệu & Quản trị Kho - Kế toán BRAVO ERP**  
*Cơ sở dữ liệu mẫu: `Quan_Ly_Kho_Hang.sql` (~49.000 dòng dữ liệu thực tế)*  
*Mã đề án: Đề án Công nghệ phần mềm / Hệ thống thông tin — Học kỳ II, Năm 3*  
*Ngày cập nhật: 01/11/2026*

---

## 📌 1. TỔNG QUAN VỀ KHO DỮ LIỆU `Quan_Ly_Kho_Hang.sql`
Đề án được xây dựng và kiểm thử trực tiếp trên cơ sở dữ liệu **Quan_Ly_Kho_Hang** (chuẩn ERP doanh nghiệp), bao gồm:
- **`DMKho` (10 kho)**: Mạng lưới kho hàng từ Bắc vào Nam (`K01` Kho tổng Hà Nội, `K02` Hải Phòng, `K03` Đà Nẵng, `K04` TP.HCM, `K05` Bình Dương, ..., `K10` Hà Đông).
- **`DMVT` (400 vật tư hàng hóa)**: Phân theo 5 nhóm ngành công nghiệp nặng và tiêu dùng:
  - `Loai_Vt = 1`: **Thép** (`THEP-001` đến `THEP-080`: Thép cuộn D6 Hòa Phát, Pomina, Việt Nhật...)
  - `Loai_Vt = 2`: **Điện** (`DIEN-001` đến `DIEN-080`: Dây cáp điện Cadivi, Trần Phú, thiết bị Sino...)
  - `Loai_Vt = 3`: **Nhựa** (`NHUA-001` đến `NHUA-080`: Ống nhựa Tiền Phong, Bình Minh, Hoa Sen...)
  - `Loai_Vt = 4`: **Bao bì** (`BB-001` đến `BB-080`: Thùng carton 3 lớp, 5 lớp, màng PE, pallet...)
  - `Loai_Vt = 5`: **Hóa chất** (`HC-001` đến `HC-080`: Sơn lót epoxy 2 thành phần, dung môi...)
- **`DMDT` (220 đối tác)**:
  - `Loai_Dt = 1`: **150 Khách hàng** (`KH001` đến `KH150`: Công ty Xây dựng Hưng Thịnh, Đại Dương, Nam Long...)
  - `Loai_Dt = 2`: **70 Nhà cung cấp** (`NCC001` đến `NCC070`: Tập đoàn Hòa Phát, Cadivi, Nhựa Tiền Phong...)
- **`Ton_Dau` (2.390 dòng tồn đầu kỳ)**: Số dư tồn kho ban đầu theo Năm (`2025`, `2026`), Kỳ (`1`), Kho (`K01`..`K10`) và Mã vật tư. Khóa chính: `(Nam, Ky, Ma_Kho, Ma_Vt)`.
- **`CT` (7.135 chứng từ)**:
  - `Loai_Ct = 1`: **Nhập mua** từ Nhà cung cấp (`PN2025-...`, `PN2026-...`).
  - `Loai_Ct = 2`: **Xuất bán** cho Khách hàng (`PX2025-...`, `PX2026-...`).
- **`CTCT` (39.130 dòng chi tiết)**: Chi tiết mặt hàng xuất/nhập, đảm bảo ràng buộc CHECK `Tien = So_Luong * Don_Gia` và `So_Luong > 0`.

---

## 🕒 2. PHÂN BỔ THỜI GIAN DEMO (TỔNG: 10 - 15 PHÚT)

| STT | Phân đoạn trình bày | Thời lượng | Trọng tâm cần nhấn mạnh |
| :---: | :--- | :---: | :--- |
| **1** | Mở ứng dụng & Giao diện IDE (Theme Sáng/Tối, Command Palette) | 1.5 phút | Thiết kế VS Code hiện đại, thân thiện kỹ sư phần mềm. |
| **2** | Schema Explorer & Ràng buộc toàn vẹn của `Quan_Ly_Kho_Hang` | 1.5 phút | 6 bảng chuẩn BRAVO ERP, ràng buộc CHECK và khóa ngoại FK. |
| **3** | Nghiệp vụ BRAVO: Sinh Báo cáo Tồn kho (`/tonkho`) | 2.5 phút | Công thức NXT: Tồn đầu + Nhập (Loai_Ct=1) - Xuất (Loai_Ct=2). |
| **4** | Tối ưu hóa hiệu năng truy vấn (`/optimize`) | 2.0 phút | Chuyển đổi 2 subquery quét bảng thành Single-Pass Scan (`CASE WHEN`). |
| **5** | Giải thích & Chẩn đoán lỗi cơ sở dữ liệu (`/explain`, `/debug`) | 1.5 phút | Trợ lý hỗ trợ Junior Dev hiểu quy ước ERP và bắt lỗi vi phạm FK/CHECK. |
| **6** | Chuyển đổi 2 chiều T-SQL ↔ PostgreSQL (Bidirectional Converter) | 2.0 phút | 1-Click hoặc lệnh `/convert`, dịch chuẩn `COALESCE`, `public.`, `LIMIT`. |
| **7** | **Smart Patching: Sửa file SQL an toàn (Non-Destructive)** | 2.5 phút | **Điểm ăn điểm cao nhất**: Chỉ sửa đúng Procedure, giữ nguyên 100% file gốc. |
| **8** | Nạp CSDL động từ DDL & Cấu hình Đa AI (Gemini / Ollama / Mock) | 1.5 phút | Nạp trực tiếp `Quan_Ly_Kho_Hang.sql`, hoạt động kể cả khi mất mạng. |

---

## 📋 3. MA TRẬN TESTCASE CHI TIẾT (10 TESTCASES CHÍNH)

```
========================================================================================
MÃ TC   PHÂN HỆ TÍNH NĂNG            ĐẦU VÀO (INPUT / THAO TÁC)     KẾT QUẢ MONG ĐỢI
========================================================================================
TC01    UI/UX & Developer Theme      Bấm nút Mặt trời/Mặt trăng ☀️/🌙  Đổi màu Dark/Light mode;
                                     Bấm Ctrl+K                     mở CommandBar nhanh.

TC02    Schema Browser Inspector     Mở tab Schema (Ctrl+4), xem    Hiển thị 6 bảng, 400 VT,
                                     DMVT, CT, Ton_Dau, CTCT        PK, FK, CHECK Loai_Ct, Loai_Vt.

TC03    Sinh T-SQL Tồn kho BRAVO     /tonkho tháng 1/2025 cho       T-SQL tính Tồn cuối Kho K01,
                                     Kho tổng Hà Nội (K01)          ISNULL(..., 0), Result Table 10 dòng.

TC04    Tối ưu hóa hiệu năng         /optimize                      Chuyển 2 subquery thành
                                                                    Conditional Sum, giảm ~45% I/O.

TC05    Giải thích & Chẩn đoán lỗi   /explain Loai_Ct và Loai_Vt    Phân biệt Nhập (1) / Xuất (2);
                                     /debug Lỗi Foreign Key CTCT    cảnh báo lỗi vi phạm FK và CHECK.

TC06    Chuyển đổi T-SQL ↔ Postgres  Nút [🔄 → PostgreSQL] hoặc    Dịch ISNULL->COALESCE, dbo->public,
                                     /convert TOP 10 DMVT           TOP->LIMIT, giữ 100% logic.

TC07    Smart Patching Sửa File      Đính kèm demo_sample_procedure 🎯 Sửa đúng Stored Procedure
                                     Yêu cầu tối ưu doanh thu       sp_BaoCaoDoanhThuTheoDoiTuong.

TC08    Nạp Schema DDL Động          Tab Schema -> Nhập từ file     Parser đọc Quan_Ly_Kho_Hang.sql
                                     chọn Quan_Ly_Kho_Hang.sql      và nạp trực tiếp lên Sidebar.

TC09    Đa Mô hình AI & Offline      Sidebar Settings -> Đổi AI     Test Connection thành công; ngắt
                                     Gemini / OpenAI / Ollama / Mock mạng tự động chuyển Offline Mock.

TC10    State Persistence            F5 trình duyệt, mở tab         Bảo lưu 100% phiên chat,
                                     Lịch sử (Ctrl+2), Đã lưu       history và saved queries (localStorage).
========================================================================================
```

---

## 🎬 4. KỊCH BẢN THỰC HIỆN TỪNG BƯỚC TRÊN MÀN HÌNH

### 🟢 BƯỚC 1: KHỞI ĐỘNG VÀ GIỚI THIỆU GIAO DIỆN CHUẨN IDE (TC01)
* **Thao tác**:
  1. Chạy file `start-app.bat` hoặc lệnh `npm run dev` tại thư mục dự án.
  2. Mở trình duyệt tại `http://localhost:5173`.
  3. Bấm vào icon ☀️ **Mặt trời** ở góc trên bên phải thanh TitleBar: Giao diện chuyển ngay sang **Light Mode** ban ngày trang nhã.
  4. Bấm lại 🌙 **Mặt trăng**: Chuyển về **Dark Mode** lập trình viên.
  5. Nhấn **`Ctrl+K`**: Con trỏ nhảy ngay vào thanh CommandBar ở đáy màn hình.
* **Lời thuyết minh mẫu**:
  > *"Kính thưa Thầy, hệ thống BRAVO SQL Agent được thiết kế theo chuẩn Developer-first, phong cách VS Code IDE với đầy đủ TitleBar, ActivityBar, Sidebar, CommandBar và StatusBar. Ứng dụng hỗ trợ Dark/Light Mode và hệ thống phím tắt chuyên nghiệp như Ctrl+K, Ctrl+1..4 giúp thao tác nhanh chóng."*

---

### 🟢 BƯỚC 2: TRA CỨU CSDL `Quan_Ly_Kho_Hang` TRONG SCHEMA BROWSER (TC02)
* **Thao tác**:
  1. Nhấn **`Ctrl+4`** (hoặc click icon 🗄️ **Schema** trên ActivityBar bên trái).
  2. Mở rộng bảng **`DMVT`**: Chỉ cho Thầy thấy 400 vật tư, cột `Loai_Vt` có ràng buộc CHECK `(1: Thép, 2: Điện, 3: Nhựa, 4: Bao bì, 5: Hóa chất)`.
  3. Mở rộng bảng **`DMKho`**: 10 kho hàng từ `K01` đến `K10`.
  4. Mở rộng bảng **`CT`**: Ràng buộc `Loai_Ct IN (1, 2)` (1: Nhập mua, 2: Xuất bán).
  5. Mở rộng bảng **`Ton_Dau`**: Khóa chính kết hợp 4 trường `(Nam, Ky, Ma_Kho, Ma_Vt)`.
  6. Gõ từ khóa `THEP` vào ô tìm kiếm nhanh: Hệ thống lọc ngay các thông tin liên quan.
* **Lời thuyết minh mẫu**:
  > *"Ở tab Schema, hệ thống hiển thị trực quan toàn bộ cấu trúc CSDL QuanLyKho với gần 49.000 dòng. Điểm quan trọng là Agent đọc và nắm rõ các ràng buộc CHECK và khóa ngoại FK để khi sinh truy vấn luôn đảm bảo tính toàn vẹn dữ liệu."*

---

### 🟢 BƯỚC 3: SINH TRUY VẤN BÁO CÁO CÂN ĐỐI TỒN KHO BRAVO (TC03)
* **Thao tác**:
  1. Click vào thanh CommandBar (hoặc gõ `Ctrl+K`).
  2. Dán câu lệnh:
     ```text
     /tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)
     ```
  3. Nhấn **Enter**.
* **Quan sát kết quả**:
  - Hộp **Suy luận của Agent (Reasoning Steps)**:
    - *Xác định schema CSDL Quan_Ly_Kho_Hang: DMVT, DMKho, CT, CTCT, Ton_Dau.*
    - *RAG: Tồn cuối = Tồn đầu (Ton_Dau) + Nhập (Loai_Ct=1) - Xuất (Loai_Ct=2).*
    - *Lọc kỳ: Tháng 01/2025, Kho K01, c.Dinh_Chi = 0.*
  - Đoạn code **T-SQL** chuẩn mực được sinh ra trong khối SqlBlock:
    ```sql
    SELECT td.Ma_Vt, vt.Ten_vt, vt.Dvt,
           td.So_Luong AS Ton_Dau_SL,
           ISNULL(nhap.SL_Nhap, 0) AS Nhap_SL,
           ISNULL(xuat.SL_Xuat, 0) AS Xuat_SL,
           td.So_Luong + ISNULL(nhap.SL_Nhap, 0) - ISNULL(xuat.SL_Xuat, 0) AS Ton_Cuoi_SL
    FROM dbo.Ton_Dau td
    INNER JOIN dbo.DMVT vt ON td.Ma_Vt = vt.Ma_vt
    LEFT JOIN (...) nhap ON td.Ma_Vt = nhap.Ma_Vt
    LEFT JOIN (...) xuat ON td.Ma_Vt = xuat.Ma_Vt
    WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'
    ORDER BY td.Ma_Vt;
    ```
  - Bảng **Result Table** hiển thị dữ liệu trực quan: `THEP-001` (Thép Hòa Phát), `DIEN-001` (Dây điện Cadivi), `NHUA-001` (Ống Tiền Phong)...
* **Lời thuyết minh mẫu**:
  > *"Thưa Thầy, theo quy chuẩn BRAVO ERP, khi tính tồn kho, cấm tuyệt đối JOIN trực tiếp bảng phát sinh với bảng tồn đầu vì sẽ gây sai lệch nếu vật tư không có phát sinh hoặc phát sinh nhiều lần. Agent đã tự động gom nhóm chứng từ nhập riêng (Loai_Ct=1), chứng từ xuất riêng (Loai_Ct=2) rồi mới liên kết với Ton_Dau và bọc ISNULL an toàn."*

---

### 🟢 BƯỚC 4: TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN VỚI SINGLE-PASS SCAN (TC04)
* **Thao tác**:
  1. Gõ vào CommandBar:
     ```text
     /optimize
     ```
  2. Nhấn **Enter**.
* **Quan sát kết quả**:
  - Agent phân tích Execution Plan: 2 subquery LEFT JOIN trước đó làm SQL Server phải quét bảng `CT` và `CTCT` 2 lần độc lập.
  - Agent đưa ra giải pháp: Gom lại thành **1 lượt JOIN duy nhất** kết hợp **Conditional Aggregation (`CASE WHEN`)**:
    ```sql
    ISNULL(SUM(CASE WHEN c.Loai_Ct = 1 THEN ct2.So_Luong END), 0) AS Nhap_SL,
    ISNULL(SUM(CASE WHEN c.Loai_Ct = 2 THEN ct2.So_Luong END), 0) AS Xuat_SL
    ```
  - Thời gian thực thi giảm ~45% (từ 0.068s xuống 0.038s), cực kỳ tối ưu trên 39.130 dòng chi tiết của `CTCT`.
* **Lời thuyết minh mẫu**:
  > *"Với lệnh /optimize, Agent đóng vai trò như một chuyên gia DBA, chuyển đổi kỹ thuật truy vấn sang Single-Pass Scan, giảm gần một nửa số lượt đọc ổ đĩa (I/O) trên database thực tế."*

---

### 🟢 BƯỚC 5: GIẢI THÍCH NGHIỆP VỤ & CHẨN ĐOÁN LỖI (TC05)
* **Thao tác A (Explain)**:
  - Gõ: `/explain Ràng buộc Loai_Ct và Loai_Vt`
  - Agent giải thích chi tiết:
    - `Loai_Ct`: `1` = Nhập mua từ NCC, `2` = Xuất bán cho Khách hàng.
    - `Loai_Vt`: `1` = Thép, `2` = Điện, `3` = Nhựa, `4` = Bao bì, `5` = Hóa chất.
* **Thao tác B (Debug)**:
  - Gõ: `/debug Lỗi Foreign Key FK_CTCT_CT khi chèn dòng chi tiết`
  - Agent phân tích nguyên tắc toàn vẹn: Bảng `CT` là bảng cha (Header), `CTCT` là bảng con (Detail). Bắt buộc phải INSERT chứng từ vào `CT` trước khi chèn chi tiết vào `CTCT`, đồng thời `Ma_Vt` phải có sẵn trong `DMVT`.
* **Lời thuyết minh mẫu**:
  > *"Tính năng /explain và /debug giúp các lập trình viên mới tiếp cận dự án hiểu ngay quy tắc nghiệp vụ đặc thù của BRAVO ERP mà không cần tra cứu tài liệu thủ công."*

---

### 🟢 BƯỚC 6: CHUYỂN ĐỔI 2 CHIỀU T-SQL ↔ POSTGRESQL (TC06)
* **Thao tác 1 (Nút 1-Click trên SqlBlock)**:
  1. Trên khối code SQL tối ưu ở Bước 4, chỉ vào nút **`🔄 → PostgreSQL`**.
  2. Bấm nút.
  3. Hệ thống sinh ngay mã PostgreSQL chuẩn:
     - `ISNULL(...)` tự động dịch sang `COALESCE(...)`.
     - `dbo.` đổi sang `public.`.
     - `LIMIT 10` đặt ở cuối query thay vì `TOP 10`.
  4. Bấm lại nút **`🔄 → T-SQL`** để chuyển ngược lại.
* **Thao tác 2 (Lệnh `/convert` trên CommandBar)**:
  - Gõ:
    ```text
    /convert SELECT TOP 10 Ma_Vt, Ten_vt FROM dbo.DMVT WHERE ISNULL(Dvt, '') <> ''
    ```
  - Agent tự nhận diện dialect nguồn là T-SQL và trả về PostgreSQL tương ứng.
* **Lời thuyết minh mẫu**:
  > *"Khi doanh nghiệp có nhu cầu chuyển dịch hệ thống từ SQL Server sang PostgreSQL để tiết kiệm chi phí bản quyền, bộ chuyển đổi hai chiều của Agent cam kết chỉ dịch cú pháp, bảo toàn 100% logic kinh doanh."*

---

### 🟢 BƯỚC 7: SMART PATCHING — SỬA FILE SQL AN TOÀN KHÔNG PHÁ HỦY (TC07)
* **Mục tiêu**: **Tính năng "vũ khí bí mật" đạt điểm số tối đa**!
* **Chuẩn bị sẵn**: File `demo_files/demo_sample_procedure.sql` có sẵn 3 Stored Procedure:
  - `sp_ThongKeDanhMucVatTu` (Dòng 7 - 15)
  - `sp_BaoCaoDoanhThuTheoDoiTuong` (Dòng 18 - 32)
  - `sp_ThongKeChungTuTrongKy` (Dòng 35 - 46)
* **Thao tác thực hiện**:
  1. Bấm vào icon 📎 **Kẹp giấy** trên thanh CommandBar.
  2. Chọn file: `demo_files/demo_sample_procedure.sql`.
  3. Tên file `demo_sample_procedure.sql` xuất hiện trên CommandBar với tag màu xanh.
  4. Nhập prompt:
     ```text
     Tối ưu lại Stored Procedure sp_BaoCaoDoanhThuTheoDoiTuong để chỉ tính phiếu xuất Loai_Ct = 2 trong năm 2025
     ```
  5. Nhấn **Enter**.
  6. AI sinh ra đoạn mã mới cho thủ tục `sp_BaoCaoDoanhThuTheoDoiTuong`.
  7. Bấm vào nút menu **Lưu** trên khối code:
     - Chọn: **🎯 Sửa đoạn code liên quan (Smart Patch)**.
  8. Hệ thống thông báo rõ:
     > `Đã thay thế [dbo].[sp_BaoCaoDoanhThuTheoDoiTuong] tại dòng 18 → 32.`
  9. Mở file `demo_files/demo_sample_procedure.sql` ra kiểm tra:
     - Thủ tục 1 (`sp_ThongKeDanhMucVatTu`) và Thủ tục 3 (`sp_ThongKeChungTuTrongKy`) vẫn **nguyên vẹn 100%**!
* **Lời thuyết minh mẫu**:
  > *"Thưa Thầy, các công cụ AI khác khi yêu cầu sửa file thường ghi đè toàn bộ dẫn đến mất code và comment của khách hàng. Chúng em đã tự xây dựng thuật toán Routine AST Matching và Token Similarity. Agent tự tìm đúng vị trí của Stored Procedure cần vá trong file và chỉ thay thế đúng phạm vi đó, bảo vệ an toàn tuyệt đối cho mã nguồn."*

---

### 🟢 BƯỚC 8: NẠP CSDL ĐỘNG TỪ DDL & ĐA MÔ HÌNH AI (TC08 & TC09 & TC10)
* **Thao tác**:
  1. Mở tab **Schema (Ctrl+4)** -> Bấm **"📁 Nhập từ file SQL"** -> Chọn `Quan_Ly_Kho_Hang.sql`: Bộ parser tự động nạp cấu trúc DDL.
  2. Mở tab **Settings (Ctrl+5)**:
     - Giới thiệu danh sách Provider: **Gemini 2.5 Flash**, **OpenAI GPT-4o**, **Ollama Qwen-Coder**, **Mock Engine**.
     - Bấm **"Kiểm tra kết nối"**: Hiện tick xanh `Kết nối thành công`.
  3. Mở tab **Lịch sử (Ctrl+2)** và **Đã lưu (Ctrl+3)**:
     - Bấm F5 tải lại trang: Toàn bộ phiên làm việc, câu query đã lưu và lịch sử đều được giữ nguyên vẹn nhờ cơ chế `usePersistentState`.
* **Lời thuyết minh mẫu**:
  > *"Dự án hỗ trợ linh hoạt cả Cloud AI lẫn Local AI bảo mật offline qua Ollama, đồng thời cơ chế lưu trữ bền vững giúp kỹ sư an tâm làm việc lâu dài mà không sợ mất dữ liệu."*

---

## ⚡ 5. BẢNG CHEAT-SHEET CÁC CÂU LỆNH DEMO (DÁN TRỰC TIẾP KHI TRÌNH BÀY)

| STT | Câu lệnh / Prompt copy-paste | Tính năng minh họa |
| :---: | :--- | :--- |
| **1** | `/tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)` | Báo cáo cân đối Nhập - Xuất - Tồn chuẩn BRAVO ERP |
| **2** | `/optimize` | Tối ưu hóa Execution Plan sang Single-Pass Scan |
| **3** | `/explain Ràng buộc Loai_Ct và Loai_Vt` | Giải thích nghiệp vụ danh mục và chứng từ |
| **4** | `/debug Lỗi Foreign Key FK_CTCT_CT khi chèn dòng chi tiết` | Chẩn đoán lỗi toàn vẹn dữ liệu |
| **5** | `/convert SELECT TOP 10 Ma_Vt, Ten_vt FROM dbo.DMVT WHERE ISNULL(Dvt, '') <> ''` | Chuyển đổi cú pháp T-SQL sang PostgreSQL |
| **6** | `Tối ưu lại Stored Procedure sp_BaoCaoDoanhThuTheoDoiTuong` *(đính kèm file)* | Smart Patching sửa file không phá hủy |

---

## 🛡️ 6. BỘ CÂU HỎI VẤN ĐÁP TIỀM NĂNG CỦA HỘI ĐỒNG (Q&A DEFENSE)

### ❓ Câu 1 của Thầy: *"Tại sao trong CSDL Quan_Ly_Kho_Hang, bảng Ton_Dau lại cần khóa chính 4 trường (Nam, Ky, Ma_Kho, Ma_Vt)?"*
* **Trả lời tự tin**:
  > *"Dạ thưa Thầy, một doanh nghiệp có thể có nhiều kho hàng khác nhau (`K01` Hà Nội, `K04` TP.HCM...). Cùng một mã thép `THEP-001`, số dư tồn đầu kỳ ở mỗi kho là độc lập. Đồng thời, số dư tồn đầu kỳ được chốt theo từng Năm tài chính và từng Kỳ kế toán (tháng). Do đó, để định danh duy nhất một dòng số dư đầu kỳ của một mặt hàng cụ thể tại một kho nhất định trong một thời điểm, khóa chính bắt buộc phải gồm cả 4 trường `(Nam, Ky, Ma_Kho, Ma_Vt)`."*

### ❓ Câu 2 của Thầy: *"Tại sao khi tính tồn kho lại gom nhóm theo Loai_Ct = 1 và 2 thay vì tính trực tiếp?"*
* **Trả lời tự tin**:
  > *"Dạ thưa Thầy, trong bảng chứng từ `CT`, `Loai_Ct = 1` là Nhập mua từ Nhà cung cấp (làm tăng tồn kho), còn `Loai_Ct = 2` là Xuất bán cho Khách hàng (làm giảm tồn kho). Nếu không phân loại hoặc join trực tiếp, các chứng từ nhập và xuất sẽ bị nhân chéo với nhau gây bùng nổ dữ liệu (Cartesian product). Phép gom nhóm bằng `CASE WHEN c.Loai_Ct = 1 THEN ...` vừa đảm bảo đúng bản chất kế toán, vừa cho phép quét bảng chi tiết `CTCT` đúng 1 lần duy nhất."*

### ❓ Câu 3 của Thầy: *"Cơ chế Smart Patching của nhóm xử lý thế nào nếu trong file có nhiều Stored Procedure có tên gần giống nhau?"*
* **Trả lời tự tin**:
  > *"Dạ thưa Thầy, hệ thống trích xuất tên thủ tục bằng biểu thức chính quy AST chính xác: bóc tách từ khóa `CREATE/ALTER PROCEDURE [schema].[tên_thủ_tục]`. Thuật toán so khớp tên chính xác tuyệt đối (Exact Match trên Identifier), đồng thời xác định phạm vi kết thúc của thủ tục bằng từ khóa `END; GO` hoặc khối `GO` kế tiếp. Do đó, dù có `sp_BaoCaoDoanhThu` và `sp_BaoCaoDoanhThuChiTiet`, hệ thống vẫn nhận diện và thay thế chính xác 100% thủ tục đích."*

### ❓ Câu 4 của Thầy: *"Lỗi kinh điển 'String or binary data would be truncated (Msg 2628)' khi chèn dòng 'TỔNG CỘNG' vào bảng tạm xảy ra do đâu và hệ thống ngăn chặn thế nào?"*
* **Trả lời tự tin**:
  > *"Dạ thưa Thầy, khi dùng cú pháp `SELECT ... INTO #KetQua`, SQL Server sẽ tự suy diễn kiểu dữ liệu và độ rộng cột dựa vào dòng của vế SELECT đầu tiên. Ví dụ ở bước tạo chi tiết từng tháng: `SELECT N'Tháng ' + CAST(Thang AS NVARCHAR(2)) AS Ky_Bao_Cao` thì SQL Server gán cứng cột `Ky_Bao_Cao` chỉ rộng `NVARCHAR(8)`. Khi sang bước chèn dòng tổng cộng cuối bảng: `INSERT INTO #KetQua SELECT N'TỔNG CỘNG'`, chuỗi này dài 9 ký tự vượt quá 8 ký tự nên SQL Server quăng lỗi Msg 2628.*
  > *AI Agent của hệ thống được huấn luyện quy tắc bắt buộc: trước khi xuất code, AI tự động rà soát độ dài tối đa (Max Length Pre-check) của mọi nhãn text/biến sẽ đổ vào cột. Khi phát hiện nguy cơ, AI chỉ cần CAST 1 lần duy nhất ngay tại biến truyền vào: `N'Tháng ' + CAST(Thang AS NVARCHAR(50)) AS Ky_Bao_Cao` (SQL Server tự động cộng chuỗi thành NVARCHAR(56) vừa vặn), tuyệt đối không bọc lồng 2 lần CAST cồng kềnh, triệt tiêu hoàn toàn lỗi truncate chuỗi mà mã lệnh vẫn tự nhiên, ngắn gọn."*

---
*Tài liệu được chuẩn bị hoàn chỉnh nhằm đảm bảo buổi bảo vệ đề án diễn ra mạch lạc, tự tin và đạt kết quả cao nhất!*

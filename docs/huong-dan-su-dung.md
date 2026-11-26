# BẢN HƯỚNG DẪN SỬ DỤNG TOÀN DIỆN BRAVO SQL STUDIO (TỪ A ĐẾN Z)

> **Dự án**: Trợ lý Trí tuệ Nhân tạo Hỗ trợ Viết, Tối ưu & Chuyển đổi T-SQL Chuẩn BRAVO ERP  
> **Phiên bản**: 1.0.0 Enterprise Fullstack  
> **Môi trường hoạt động**: Microsoft Windows (Desktop App / Web Browser), SQL Server 2019/2022

---

## MỤC LỤC
1. [Bản chất công nghệ: AI được "train" như thế nào & Cơ chế RAG](#1-bản-chất-công-nghệ-ai-được-train-như-thế-nào--cơ-chế-rag)
2. [Kiến trúc hệ thống Fullstack](#2-kiến-trúc-hệ-thống-fullstack)
3. [Hướng dẫn cài đặt & Khởi động 1-Click](#3-hướng-dẫn-cài-đặt--khởi-động-1-click)
4. [Chi tiết toàn bộ tính năng & Giao diện (A-Z)](#4-chi-tiết-toàn-bộ-tính-năng--giao-diện-a-z)
   - [4.1 Thanh điều hướng Activity Bar & 5 Phân hệ Sidebar](#41-thanh-điều-hướng-activity-bar--5-phân-hệ-sidebar)
   - [4.2 Khung làm việc IDE & Thẻ Tab thông minh](#42-khung-làm-việc-ide--thẻ-tab-thông-minh)
   - [4.3 Khối mã nguồn SqlBlock & Trình thực thi số liệu thật](#43-khối-mã-nguồn-sqlblock--trình-thực-thi-số-liệu-thật)
   - [4.4 Hệ thống Slash Commands chuyên sâu](#44-hệ-thống-slash-commands-chuyên-sâu)
   - [4.5 Đính kèm tệp & Cơ chế Smart Patching bảo toàn mã nguồn](#45-đính-kèm-tệp--cơ-chế-smart-patching-bảo-toàn-mã-nguồn)
   - [4.6 Lớp khiên bảo mật CSDL (Query Guard Sandbox)](#46-lớp-khiên-bảo-mật-csdl-query-guard-sandbox)
5. [Bộ 10 Quy tắc Vàng BRAVO T-SQL được nạp sẵn](#5-bộ-10-quy-tắc-vàng-bravo-t-sql-được-nạp-sẵn)
6. [Bảng tra cứu phím tắt (Keyboard Shortcuts)](#6-bảng-tra-cứu-phím-tắt-keyboard-shortcuts)
7. [Xử lý sự cố thường gặp (Troubleshooting)](#7-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. BẢN CHẤT CÔNG NGHỆ: AI ĐƯỢC "TRAIN" NHƯ THẾ NÀO & CƠ CHẾ RAG

### 1.1 Phần mềm có thực sự "train" AI theo tư duy BRAVO không?
Trong khoa học dữ liệu và kỹ thuật AI hiện đại, có 2 cách để một mô hình AI nắm vững chuyên môn:
1. **Model Fine-Tuning (Huấn luyện lại trọng số mạng nơ-ron):** Dùng hàng nghìn file SQL để cập nhật weights. Nhược điểm: Chi phí cực kỳ tốn kém, tính "đóng băng" (khi schema CSDL của khách hàng thay đổi cột hay thêm bảng mới thì mô hình bị lỗi thời ngay), và vẫn dễ bị ảo giác (hallucination).
2. **In-Context Learning & Expert System Instruction (Phương pháp ứng dụng đang dùng):** Đây là kỹ thuật tiên tiến nhất được các hãng lớn (như Cursor, GitHub Copilot) áp dụng. Toàn bộ triết lý thiết kế cơ sở dữ liệu và quy chuẩn viết mã T-SQL của BRAVO ERP được chuẩn hóa thành một **Bộ quy tắc chuyên gia (Style Guide)** và tự động nạp vào **ngữ cảnh nhận thức (System Prompt)** của AI trong từng phiên làm việc.

> AI trong phần mềm của bạn không viết code theo kiểu "tự do của ChatGPT ngoài web". Nó bị **ràng buộc tuyệt đối** bởi 10 quy tắc vàng của BRAVO (cấm subquery trong SELECT, cấm JOIN trực tiếp bảng tồn đầu và phát sinh, bắt buộc Single-Pass scan, gom nhóm tối đa 1 trường, xử lý truncate chuỗi chỉ với 1 lần CAST, định dạng thụt lề 4 khoảng trắng).

### 1.2 Ứng dụng có tuân thủ RAG (Retrieval-Augmented Generation) không?
**CÓ, ứng dụng tuân thủ nghiêm ngặt mô hình RAG 3 tầng (Multi-Layer RAG)**:

```
[SQL Server Thật] ──► sys.tables, sys.columns ──► (1) Schema RAG
[Knowledge Base]  ──► 10 Quy tắc BRAVO ERP   ──► (2) Rule RAG      ──► Ghép vào AI Prompt ──► Sinh mã chuẩn 100%
[File Đính Kèm]   ──► Bóc tách AST Procedure  ──► (3) File AST RAG
```

* **Tầng 1 - Schema RAG**: Thay vì đưa một schema giả định, ứng dụng truy vấn thẳng vào các view hệ thống của SQL Server (`sys.tables`, `sys.columns`, `sys.foreign_keys`, `sys.partitions`) để kéo chính xác 100% tên bảng, kiểu dữ liệu, khóa chính/ngoại thực tế của database đang mở nạp vào AI.
* **Tầng 2 - Rule RAG**: Tự động trích xuất các quy tắc tương ứng với từng Slash Command (ví dụ lệnh `/tonkho` kích hoạt rule 1.7 về NXT, lệnh `/optimize` kích hoạt rule 1.2 về Single-Pass scan).
* **Tầng 3 - File AST RAG**: Khi người dùng tải lên file `.sql`, hệ thống tự động bóc tách cú pháp cây để chỉ lấy đúng Stored Procedure cần chỉnh sửa, không làm xáo trộn các đoạn mã xung quanh.

---

## 2. KIẾN TRÚC HỆ THỐNG FULLSTACK

Hệ thống được tổ chức theo mô hình **Fullstack 3 tầng độc lập, bảo mật và hiệu năng cao**:

```
bravo-sql-agent/
├── server/                    Backend Server (Node.js + Express)
│   ├── index.js               REST API phục vụ cổng 5000
│   ├── sqlEngine.js           Native Driver chạy sqlcmd UTF-8 (-f 65001) với Windows Auth
│   ├── schemaService.js       Trích xuất metadata động từ sys.tables & sys.columns
│   └── queryGuard.js          Khiên bảo vệ CSDL (chặn các lệnh DROP, TRUNCATE, ALTER...)
├── src/                       Frontend Studio (React 19 + TypeScript + Tailwind v4)
│   ├── components/            Giao diện (ActivityBar, Sidebar, SqlBlock, CommandBar...)
│   ├── services/              backendApi, aiClient, fileModifier, sqlFormatter
│   ├── data/                  sqlStyleGuide.ts (Bộ quy tắc chuẩn BRAVO nạp AI)
│   ├── types.ts               Hệ thống kiểu dữ liệu định danh chặt chẽ
│   └── usePersistentState.ts  Lưu trữ dữ liệu bền vững qua LocalStorage
├── database/                  Script nạp CSDL gốc Quan_Ly_Kho_Hang.sql (49.000+ bản ghi)
└── docs/                      Tài liệu kiểm thử, báo cáo đồ án và hướng dẫn
```

---

## 3. HƯỚNG DẪN CÀI ĐẶT & KHỞI ĐỘNG 1-CLICK

### 3.1 Yêu cầu môi trường
* **Hệ điều hành**: Windows 10 hoặc Windows 11.
* **Môi trường chạy**: Đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 18+ trở lên).
* **Cơ sở dữ liệu**: Microsoft SQL Server (bản Express, Developer hoặc Enterprise) đang bật service `MSSQLSERVER`.

### 3.2 Khởi động ứng dụng (2 cách)
* **Cách 1 (Khuyên dùng - 1 Click đúp)**:
  * Ra màn hình chính (Desktop) của máy tính.
  * Click đúp vào biểu tượng **`BRAVO SQL Studio`**.
  * Cửa sổ dòng lệnh tự bật Backend (port 5000) và Frontend (port 5173), đồng thời **trình duyệt mặc định tự động mở ra ngay lập tức**.
* **Cách 2 (Khởi động qua thư mục dự án)**:
  * Vào thư mục `bravo-sql-agent`, click đúp tệp **`Start-App.bat`** (hoặc mở terminal gõ `npm run dev`).

### 3.3 Tắt ứng dụng
* Đóng cửa sổ dòng lệnh màu đen (hoặc nhấn tổ hợp phím `Ctrl + C` trong cửa sổ đó).

---

## 4. CHI TIẾT TOÀN BỘ TÍNH NĂNG & GIAO DIỆN (A-Z)

### 4.1 Thanh điều hướng Activity Bar & 5 Phân hệ Sidebar
Ở góc cực trái màn hình có thanh Activity Bar gồm 5 biểu tượng tương ứng với 5 phân hệ:

#### 1. Phân hệ Phiên làm việc (Chat Sessions) - `Ctrl + 1`
* **Nút "+ Phiên mới"**: Tạo ngay một tab hội thoại mới tinh để làm việc với yêu cầu khác mà không làm mất hội thoại cũ.
* **Danh sách phiên**: Hiển thị tên phiên, thời gian hoạt động cuối cùng và số lượng tin nhắn.
* **Đổi tên & Xóa**: Di chuột vào từng phiên để xóa hoặc lưu trữ. Toàn bộ phiên được tự động ghi nhớ bền vững, tắt máy bật lại vẫn còn nguyên.

#### 2. Phân hệ Nhật ký truy vấn (History) - `Ctrl + 2`
* Tự động ghi lại mọi câu lệnh T-SQL mà bạn đã bấm nút **"Chạy"**.
* Hiển thị chi tiết: Thời gian thực thi (ví dụ `0.048s`), trạng thái thành công (tick xanh) hoặc thất bại (icon đỏ), và 2 dòng xem trước câu lệnh.
* **Nút "Chạy lại"**: Bấm để chạy lại câu lệnh trực tiếp vào CSDL mà không cần gõ lại.

#### 3. Phân hệ Thư viện truy vấn (Saved Queries) - `Ctrl + 3`
* Tích hợp sẵn các câu lệnh mẫu kinh điển của nghiệp vụ kho BRAVO:
  * *Báo cáo cân đối Nhập - Xuất - Tồn Kho K01*.
  * *Danh sách phiếu nhập mua vật tư chưa định chỉ (Dinh_Chi = 0)*.
* **Nút "Dán vào lệnh"**: Tự động đưa câu lệnh xuống Command Bar để bạn chỉnh sửa tham số.
* **Nút "Chạy"**: Thực thi ngay lập tức.

#### 4. Phân hệ Quản lý Cơ sở dữ liệu (Database Schema) - `Ctrl + 4`
* **Bộ chọn CSDL (Database Switcher)**: Cho phép chuyển đổi linh hoạt giữa các database đang có trên SQL Server của bạn (`Quan_Ly_Kho_Hang`, `QLBH`, `AdventureWorks`...).
* **Nút "Đồng bộ từ SQL Server (Live)"**:
  * Khi bấm: Nút chuyển sang xoay tròn và hiển thị `Đang đồng bộ từ SQL Server...`.
  * Kết nối trực tiếp vào `sys.tables`, `sys.columns`, `sys.foreign_keys`, cập nhật chính xác số lượng bản ghi thực tế từng bảng.
  * Hiển thị **Thẻ kết quả chi tiết (Live Sync Card)**: Tên CSDL, tên máy chủ, số bảng, tổng số bản ghi và độ trễ mili-giây.
* **Nút "+ Nhập Database mới (.sql)"**: Cho phép tải lên file script DDL (`CREATE TABLE`) từ bên ngoài nếu bạn muốn AI làm việc với database độc lập mà không cần kết nối SQL Server thật.
* **Cây thư mục Bảng & Cột**:
  * Tìm kiếm bảng/cột nhanh qua ô `Tìm bảng hoặc cột...`.
  * Xem số dòng thực tế (`400 rows`, `39.130 rows`...).
  * Mở rộng từng bảng để xem: Tên cột, kiểu dữ liệu (`nvarchar(20)`, `numeric(18,2)`), biểu tượng chìa khóa vàng cho Khóa chính (`PK`), biểu tượng mũi tên xanh cho Khóa ngoại (`FK`).

#### 5. Phân hệ Cài đặt AI (Settings) - `Bánh răng góc dưới`
* Hỗ trợ 4 nhà cung cấp AI linh hoạt:
  * **Google Gemini**: Dùng model `gemini-1.5-flash` hoặc `gemini-2.0-flash` (tốc độ cao, suy luận sắc bén).
  * **OpenAI**: Dùng `gpt-4o-mini` hoặc `gpt-4o`.
  * **Ollama (Local AI Offline)**: Kết nối vào máy tính cục bộ (`http://localhost:11434`), hoàn toàn miễn phí, bảo mật 100% dữ liệu nội bộ công ty.
  * **Chế độ Offline (Dữ liệu mẫu)**: Chạy hoàn toàn ngoại tuyến không cần Internet, dựa trên bộ quy tắc dựng sẵn.
* **Nút "Kiểm tra kết nối"**: Bấm để đo độ trễ (latency ms) và xác thực API key.

---

### 4.2 Khung làm việc IDE & Thẻ Tab thông minh
* **Hệ thống Tab đa nhiệm**: Mỗi phiên làm việc là một Tab hiển thị ở thanh trên cùng (giống giao diện Visual Studio / SSMS).
* Bạn có thể chuyển đổi qua lại giữa các bài toán truy vấn một cách mượt mà.
* Tự động đặt tên Tab theo nội dung yêu cầu nghiệp vụ đầu tiên của bạn.

---

### 4.3 Khối mã nguồn SqlBlock & Trình thực thi số liệu thật
Khi AI sinh ra câu lệnh SQL, mã nguồn được đặt trong khối `SqlBlock` với đầy đủ tiện ích:
1. **Nút "▶ Chạy" (Execute)**:
   * Gửi câu lệnh T-SQL xuống Backend Node.js.
   * Backend dùng driver native chạy thẳng vào database trên SQL Server máy bạn.
   * Hiển thị ngay **Bảng dữ liệu thực tế (Data Grid)** với số dòng thật, hỗ trợ sắp xếp cột và cuộn xem mượt mà.
   * Đo lường thời gian chạy thật (ví dụ: `0.048s`, `15 dòng`).
2. **Nút "Copy"**: Sao chép toàn bộ mã T-SQL chuẩn thụt lề vào Clipboard để paste sang SSMS.
3. **Nút "Tải .sql"**: Xuất câu lệnh thành file `.sql` chuẩn UTF-8 lưu về máy tính.
4. **Nút "⇄ PostgreSQL"**: Tự động kích hoạt cơ chế chuyển đổi cú pháp T-SQL sang chuẩn PostgreSQL (đổi các hàm `ISNULL` -> `COALESCE`, `GETDATE()` -> `CURRENT_TIMESTAMP`, `#Temp` -> `TEMPORARY TABLE`...).

---

### 4.4 Hệ thống Slash Commands chuyên sâu
Nhập dấu gạch chéo `/` tại thanh lệnh để mở menu gợi ý nhanh:

| Lệnh | Ý nghĩa nghiệp vụ | Ví dụ sử dụng |
| :--- | :--- | :--- |
| **`/tonkho`** | Lập Báo cáo Cân đối Nhập - Xuất - Tồn theo chuẩn BRAVO ERP (cân bằng phương trình kế toán: Tồn cuối = Tồn đầu + Nhập - Xuất). | `/tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)` |
| **`/optimize`** | Phân tích và tối ưu hóa câu lệnh SQL: khử subquery lồng trong SELECT, chuyển từ Multi-Pass sang Single-Pass Scan. | `/optimize Tối ưu query trên để chỉ quét bảng CTCT 1 lần duy nhất` |
| **`/diff`** | Sinh bảng so sánh trực quan đối chiếu giữa cách viết non tay (Anti-pattern) và cách viết chuẩn mực tối ưu của BRAVO. | `/diff So sánh câu lệnh tồn kho thông thường và câu lệnh tối ưu` |
| **`/explain`** | Giải thích cặn kẽ thuật toán tính toán và logic liên kết giữa bảng chi tiết `CTCT`, bảng đầu phiếu `CT` và danh mục `DMVT`. | `/explain Giải thích logic kiểm tra chứng từ chưa định chỉ Dinh_Chi = 0` |
| **`/debug`** | Phân tích và chẩn đoán lỗi SQL Server: lỗi vi phạm khóa ngoại, lỗi chia cho 0, lỗi ép sai kiểu dữ liệu, lỗi truncate chuỗi. | `/debug Chẩn đoán lỗi Msg 2628 String or binary data would be truncated` |
| **`/convert`** | Biên dịch toàn bộ câu lệnh T-SQL sang chuẩn ANSI SQL / PostgreSQL. | `/convert Chuyển đổi báo cáo tồn kho trên sang PostgreSQL` |

---

### 4.5 Đính kèm tệp & Cơ chế Smart Patching bảo toàn mã nguồn
* **Nút "Đính kèm .sql"**: Cho phép bạn gắn một file Stored Procedure hoặc script SQL dài hàng nghìn dòng vào cuộc trò chuyện.
* **Cơ chế Smart Patching (Sửa không phá hủy)**:
  * Khi bạn yêu cầu: *"Hãy sửa thủ tục `sp_BaoCaoDoanhThu` để bổ sung thêm cột Đơn vị tính"*.
  * AI **KHÔNG BAO GIỜ** viết lại toàn bộ file từ đầu (dễ gây mất mát code cũ).
  * Bộ phân tích cú pháp AST sẽ tìm chính xác khối `CREATE/ALTER PROCEDURE [schema].[sp_BaoCaoDoanhThu]` trong file của bạn và chỉ thay thế đúng thủ tục đó, giữ nguyên 100% các thủ tục, hàm, view và comment khác.
  * Hỗ trợ lưu đè trực tiếp lên file trên ổ đĩa thông qua File System Access API.

---

### 4.6 Lớp khiên bảo mật CSDL (Query Guard Sandbox)
Để ngăn ngừa rủi ro mất dữ liệu hoặc bị tấn công khi kết nối vào SQL Server thật:
* Bộ lọc `server/queryGuard.js` tự động quét câu lệnh trước khi cho phép thực thi.
* **Chặn triệt để các hành vi phá hoại**:
  * Các lệnh xóa cấu trúc: `DROP DATABASE`, `DROP TABLE`, `ALTER TABLE`.
  * Các lệnh phá hủy dữ liệu diện rộng: `TRUNCATE TABLE`, `DELETE FROM ...` (không có WHERE).
  * Các lệnh can thiệp hệ thống máy chủ: `xp_cmdshell`, `sp_configure`, `SHUTDOWN`.
* Đảm bảo môi trường làm việc luôn an toàn tuyệt đối cho người dùng và doanh nghiệp.

---

## 5. BỘ 10 QUY TẮC VÀNG BRAVO T-SQL ĐƯỢC NẠP SẴN

| Quy tắc | Nội dung quy định bắt buộc |
| :--- | :--- |
| **Rule 1.1** | **Cấm Subquery trong SELECT list**: Tuyệt đối không viết `SELECT (SELECT ... FROM ...) AS Col1`. Thay bằng JOIN hoặc gộp trước. |
| **Rule 1.2** | **Tối ưu GROUP BY / DISTINCT**: GROUP BY tối đa 1 trường duy nhất (trường mã đã đánh index). Trường tên thừa bọc bằng `MAX()` để không phải so sánh chuỗi text dài. |
| **Rule 1.3** | **Xử lý triệt để NULL & SUM**: Số NULL đưa về 0 (`ISNULL(col, 0)`), chuỗi đưa về `' '`. Ưu tiên SUM trên tập đã gộp ít dòng nhất. |
| **Rule 1.4** | **Bắt đầu FROM từ bảng gốc**: Luôn FROM từ bảng phát sinh chi tiết (`CTCT`) rồi mới JOIN sang bảng danh mục (`DMVT`), không làm ngược lại. |
| **Rule 1.5** | **Quản lý biến & Khối lệnh**: Biến có dấu tiếng Việt dùng `nvarchar`, không dấu dùng `varchar`. Khối lệnh thực thi có > 2 câu lệnh bắt buộc bọc trong `BEGIN ... END`. |
| **Rule 1.6** | **Kiểm soát kiểu dữ liệu UNION ALL**: Ép kiểu tường minh `CAST(0 AS NUMERIC(18, 2))` cho các cột số, tuyệt đối không để số nguyên `0` ngầm định. |
| **Rule 1.7** | **CẤM TUYỆT ĐỐI JOIN Tồn đầu với Phát sinh**: Không được JOIN trực tiếp `Ton_Dau` với `CTCT` (gây nhân đôi dữ liệu Cartesian). Bắt buộc gom qua bảng tạm `#Temp` bằng `UNION ALL`. |
| **Rule 1.8** | **Chuẩn hóa hàm xếp hạng**: Hiểu rõ bản chất nghiệp vụ để dùng đúng: `RANK()` (nhảy bậc), `DENSE_RANK()` (liên tục), `ROW_NUMBER()` (tăng dần duy nhất). |
| **Rule 1.9** | **Cấu trúc bảng Idempotent**: Luôn có dòng xóa bảng an toàn ở đầu script: `IF OBJECT_ID('tempdb..#Temp') IS NOT NULL DROP TABLE #Temp;`. |
| **Rule 1.10** | **Phòng chống lỗi Truncate (Msg 2628) với 1 lần CAST**: Tự rà soát độ dài chuỗi lớn nhất. Khi ghép chuỗi tạo nhãn, chỉ cần CAST 1 lần mở rộng ngay tại biến: `N'Tháng ' + CAST(Thang AS NVARCHAR(50)) AS Ky_Bao_Cao`, độ rộng tự động đạt 56 ký tự, chứa vừa mọi dòng `N'TỔNG CỘNG'`. |

---

## 6. BẢNG TRA CỨU PHÍM TẮT (KEYBOARD SHORTCUTS)

* **`Ctrl + K`**: Nhảy ngay con trỏ chuột vào thanh nhập lệnh Command Bar.
* **`Ctrl + 1`**: Đóng / Mở tab **Phiên làm việc**.
* **`Ctrl + 2`**: Đóng / Mở tab **Nhật ký truy vấn (History)**.
* **`Ctrl + 3`**: Đóng / Mở tab **Thư viện truy vấn đã lưu**.
* **`Ctrl + 4`**: Đóng / Mở tab **Cấu trúc CSDL (Database Schema)**.
* **`Enter`**: Gửi yêu cầu truy vấn đến AI.
* **`Shift + Enter`**: Xuống dòng trong ô nhập lệnh.
* **`Esc`**: Đóng menu gợi ý Slash Command.

---

## 7. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 7.1 "Đồng bộ từ SQL Server (Live)" báo lỗi đỏ không kết nối được?
* **Nguyên nhân**: Backend Server chưa chạy hoặc SQL Server trên máy đang dừng.
* **Cách khắc phục**:
  1. Kiểm tra xem service `MSSQLSERVER` trong Windows Services đã ở trạng thái `Running` chưa.
  2. Khởi động lại ứng dụng bằng cách click đúp file **`Start-App.bat`** (đảm bảo cửa sổ dòng lệnh màu đen đang mở).

### 7.2 AI báo lỗi hết hạn API Key hoặc phản hồi chậm?
* **Cách khắc phục**:
  1. Vào phân hệ Cài đặt (biểu tượng bánh răng góc dưới bên trái).
  2. Nhập API Key mới của Google Gemini (miễn phí tại Google AI Studio).
  3. Hoặc chọn nhà cung cấp **Ollama** để chạy hoàn toàn offline trên card đồ họa máy tính của bạn.

### 7.3 Chạy câu lệnh SQL báo lỗi "Incorrect syntax near..."?
* **Cách khắc phục**:
  * Sao chép toàn bộ dòng thông báo lỗi (ví dụ: `Msg 102, Level 15...`) và dán vào thanh lệnh với cú pháp:  
    `/debug [nội dung lỗi]`
  * AI sẽ phân tích chính xác vị trí sai và tự động trả lại câu lệnh đã được sửa lỗi theo chuẩn BRAVO.

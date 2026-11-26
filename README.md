# BRAVO SQL Studio

Trợ lý thông minh hỗ trợ viết, tối ưu hóa và chuyển đổi mã T-SQL và PostgreSQL theo chuẩn quy tắc nghiệp vụ BRAVO ERP.

## Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, KaTeX, Lucide Icons
- **Backend Server**: Node.js, Express, mssql/sqlcmd Native Engine
- **Cơ sở dữ liệu**: Microsoft SQL Server (database `Quan_Ly_Kho_Hang` với hơn 49.000 bản ghi)
- **Kiểm tra & chất lượng mã nguồn**: Oxlint, TypeScript Compiler (`tsc`)

## Cài đặt và khởi chạy

1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

2. Cấu hình biến môi trường:
   ```bash
   cp .env.example .env
   ```
   Cập nhật `VITE_GEMINI_API_KEY` hoặc `VITE_OPENAI_API_KEY` trong file `.env` nếu cần sử dụng nhà cung cấp AI trực tuyến (hoặc dùng chế độ offline mặc định).

3. Khởi chạy toàn bộ hệ thống (Frontend + Backend Server):
   ```bash
   npm run dev
   ```
   > Lệnh này sẽ tự động khởi động đồng thời cả Backend API (cổng 5000) kết nối vào SQL Server và Vite Dev Server (cổng 5173).

4. Kiểm tra mã nguồn và build:
   ```bash
   npx oxlint
   npx tsc --noEmit
   npm run build
   ```

## Cấu trúc thư mục

```text
bravo-sql-agent/
├── database/          Script khởi tạo và dữ liệu mẫu SQL Server (Quan_Ly_Kho_Hang.sql)
├── docs/              Tài liệu báo cáo dự án và kịch bản kiểm thử (testcases)
├── server/            Backend Server (Node.js + Express kết nối trực tiếp SQL Server)
│   ├── index.js       Khởi tạo REST API và định tuyến endpoints
│   ├── queryGuard.js  Bộ lọc bảo mật T-SQL (chặn các lệnh phá hoại DROP, ALTER...)
│   ├── schemaService.js Trích xuất cấu trúc bảng & quan hệ trực tiếp từ sys.tables
│   └── sqlEngine.js   Trình thực thi T-SQL trực tiếp vào SQL Server thật
├── public/            Tài nguyên tĩnh (favicon, icon)
├── src/
│   ├── components/    Các thành phần giao diện (CommandBar, ConversationArea, SqlBlock...)
│   ├── data/          Tài liệu quy tắc chuẩn SQL BRAVO (sqlStyleGuide.ts) và schema CSDL
│   ├── services/      Các dịch vụ AI client adapter, format SQL, backend API client
│   ├── App.tsx        Thành phần giao diện chính (đồng bộ Live DB & thực thi câu lệnh)
│   ├── main.tsx       Điểm khởi tạo ứng dụng React
│   ├── index.css      Cấu hình giao diện và Tailwind CSS
│   ├── types.ts       Định nghĩa kiểu dữ liệu TypeScript dùng chung
│   └── usePersistentState.ts  Hook lưu trữ trạng thái vào localStorage
├── .env.example       Mẫu cấu hình biến môi trường
├── package.json       Cấu hình dự án và dependencies
└── vite.config.ts     Cấu hình Vite và proxy kết nối backend (/api -> localhost:5000)
```

## Tài liệu chi tiết

- [Hướng dẫn sử dụng toàn diện từ A đến Z](docs/huong-dan-su-dung.md)
- [Kịch bản kiểm thử demo](docs/testcases.md)
- [Báo cáo dự án và hướng dẫn sử dụng](docs/bao-cao-du-an.md)
- [Hướng dẫn khôi phục cơ sở dữ liệu](database/README.md)

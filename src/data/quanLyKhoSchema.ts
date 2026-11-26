import type { TableSchema, TableRelationship, SlashCommand } from '../types';

export const TABLES_SCHEMA: TableSchema[] = [
  {
    name: 'DMVT',
    fullName: 'dbo.DMVT (Danh mục vật tư, hàng hóa)',
    rowCount: 400,
    description: 'Danh mục vật tư ngành Thép, Điện, Nhựa, Bao bì, Hóa chất',
    columns: [
      { name: 'Ma_vt', type: 'nvarchar(20)', isPk: true, nullable: false, description: 'Mã vật tư (Khóa chính)' },
      { name: 'Ten_vt', type: 'nvarchar(200)', nullable: false, description: 'Tên vật tư hàng hóa' },
      { name: 'Dvt', type: 'nvarchar(20)', nullable: true, description: 'Đơn vị tính (Cuộn, Kg, Cây, Thùng...)' },
      { name: 'Loai_Vt', type: 'int', checkConstraint: 'Loai_Vt IN (1,2,3,4,5)', description: '1: Thép, 2: Điện, 3: Nhựa, 4: Bao bì, 5: Hóa chất' },
      { name: 'Dinh_Chi', type: 'int', defaultValue: '0', checkConstraint: 'Dinh_Chi IN (0,1)', description: '0: Đang sử dụng; 1: Ngừng dùng' }
    ]
  },
  {
    name: 'DMKho',
    fullName: 'dbo.DMKho (Danh mục kho hàng)',
    rowCount: 10,
    description: 'Danh mục các kho lưu trữ vật tư và thành phẩm',
    columns: [
      { name: 'Ma_Kho', type: 'nvarchar(20)', isPk: true, nullable: false, description: 'Mã kho (Khóa chính)' },
      { name: 'Ten_Kho', type: 'nvarchar(200)', nullable: false, description: 'Tên kho hàng' },
      { name: 'Dinh_Chi', type: 'int', defaultValue: '0', checkConstraint: 'Dinh_Chi IN (0,1)', description: '0: Hoạt động; 1: Đóng kho' }
    ]
  },
  {
    name: 'DMDT',
    fullName: 'dbo.DMDT (Danh mục đối tượng, khách hàng, nhà cung cấp)',
    rowCount: 220,
    description: 'Đối tác kinh doanh bao gồm khách hàng và nhà cung cấp',
    columns: [
      { name: 'Ma_Dt', type: 'nvarchar(20)', isPk: true, nullable: false, description: 'Mã đối tượng (Khóa chính)' },
      { name: 'Ten_Dt', type: 'nvarchar(200)', nullable: false, description: 'Tên đối tượng' },
      { name: 'Loai_Dt', type: 'int', checkConstraint: 'Loai_Dt IN (1,2)', description: '1: Khách hàng; 2: Nhà cung cấp' },
      { name: 'Dinh_Chi', type: 'int', defaultValue: '0', checkConstraint: 'Dinh_Chi IN (0,1)', description: '0: Đang giao dịch; 1: Ngừng' }
    ]
  },
  {
    name: 'Ton_Dau',
    fullName: 'dbo.Ton_Dau (Tồn kho đầu kỳ)',
    rowCount: 25740,
    description: 'Số lượng và giá trị tồn kho đầu mỗi kỳ kế toán (đã chốt sổ lũy kế từng tháng Ky = 1..12 theo Kho, Năm, Kỳ và Vật tư)',
    columns: [
      { name: 'Nam', type: 'int', isPk: true, nullable: false, description: 'Năm tài chính (2025, 2026)' },
      { name: 'Ky', type: 'int', isPk: true, nullable: false, description: 'Kỳ kế toán tương ứng với Tháng (1..12)' },
      { name: 'Ma_Kho', type: 'nvarchar(20)', isPk: true, isFk: true, fkRef: 'DMKho(Ma_Kho)', description: 'Mã kho lưu trữ (PK, FK)' },
      { name: 'Ma_Vt', type: 'nvarchar(20)', isPk: true, isFk: true, fkRef: 'DMVT(Ma_vt)', description: 'Mã vật tư (PK, FK)' },
      { name: 'So_Luong', type: 'numeric(18,2)', checkConstraint: 'So_Luong >= 0', description: 'Số lượng tồn đầu kỳ' },
      { name: 'Tien', type: 'numeric(18,2)', description: 'Giá trị tiền tồn đầu kỳ' }
    ]
  },
  {
    name: 'CT',
    fullName: 'dbo.CT (Chứng từ nhập - xuất kho)',
    rowCount: 7135,
    description: 'Thông tin chung phiếu nhập mua (1) và xuất bán (2)',
    columns: [
      { name: 'So_Ct', type: 'nvarchar(20)', isPk: true, nullable: false, description: 'Số chứng từ (Khóa chính)' },
      { name: 'Ngay_Ct', type: 'datetime', nullable: false, description: 'Ngày lập chứng từ' },
      { name: 'Ma_Dt', type: 'nvarchar(20)', isFk: true, fkRef: 'DMDT(Ma_Dt)', description: 'Mã đối tác (FK)' },
      { name: 'Ma_Kho', type: 'nvarchar(20)', isFk: true, fkRef: 'DMKho(Ma_Kho)', description: 'Mã kho phát sinh (FK)' },
      { name: 'Loai_Ct', type: 'int', checkConstraint: 'Loai_Ct IN (1,2)', description: '1: Nhập mua; 2: Xuất bán' },
      { name: 'Dien_Giai', type: 'nvarchar(500)', nullable: true, description: 'Diễn giải chứng từ' },
      { name: 'Dinh_Chi', type: 'int', defaultValue: '0', checkConstraint: 'Dinh_Chi IN (0,1)', description: '0: Có hiệu lực; 1: Hủy bỏ' }
    ]
  },
  {
    name: 'CTCT',
    fullName: 'dbo.CTCT (Chi tiết dòng chứng từ)',
    rowCount: 39130,
    description: 'Chi tiết từng mặt hàng trên phiếu nhập/xuất (CHÚ Ý: Bảng này chỉ có 6 cột trên, KHÔNG CÓ cột Dinh_Chi hay Ngay_Ct; Dinh_Chi nằm ở bảng cha CT)',
    columns: [
      { name: 'So_Ct', type: 'nvarchar(20)', isPk: true, isFk: true, fkRef: 'CT(So_Ct)', description: 'Số chứng từ (PK, FK)' },
      { name: 'Stt_Dong', type: 'int', isPk: true, nullable: false, description: 'Số thứ tự dòng hàng (PK)' },
      { name: 'Ma_Vt', type: 'nvarchar(20)', isFk: true, fkRef: 'DMVT(Ma_vt)', description: 'Mã vật tư (FK)' },
      { name: 'So_Luong', type: 'numeric(18,2)', checkConstraint: 'So_Luong > 0', description: 'Số lượng giao dịch' },
      { name: 'Don_Gia', type: 'numeric(18,2)', description: 'Đơn giá giao dịch' },
      { name: 'Tien', type: 'numeric(18,2)', checkConstraint: 'Tien = So_Luong * Don_Gia', description: 'Thành tiền' }
    ]
  }
];

export const RELATIONSHIPS: TableRelationship[] = [
  { fromTable: 'Ton_Dau', fromColumn: 'Ma_Kho', toTable: 'DMKho', toColumn: 'Ma_Kho', description: 'Số dư tồn kho trỏ tới danh mục kho' },
  { fromTable: 'Ton_Dau', fromColumn: 'Ma_Vt', toTable: 'DMVT', toColumn: 'Ma_vt', description: 'Số dư tồn kho trỏ tới danh mục vật tư' },
  { fromTable: 'CT', fromColumn: 'Ma_Dt', toTable: 'DMDT', toColumn: 'Ma_Dt', description: 'Chứng từ phát sinh trỏ tới đối tác giao dịch' },
  { fromTable: 'CT', fromColumn: 'Ma_Kho', toTable: 'DMKho', toColumn: 'Ma_Kho', description: 'Chứng từ phát sinh trỏ tới kho hàng' },
  { fromTable: 'CTCT', fromColumn: 'So_Ct', toTable: 'CT', toColumn: 'So_Ct', description: 'Dòng chi tiết gắn với chứng từ cha' },
  { fromTable: 'CTCT', fromColumn: 'Ma_Vt', toTable: 'DMVT', toColumn: 'Ma_vt', description: 'Dòng chi tiết trỏ tới danh mục vật tư' }
];

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/query',
    label: '/query',
    description: 'Luồng 1: Viết & chạy câu truy vấn SQL mới từ mô tả tiếng Việt',
    shortcut: 'Ctrl+Q',
    iconType: 'query',
    flows: ['generate'],
    example: '/query Top 5 khách hàng mua nhiều hàng nhất năm 2025'
  },
  {
    command: '/tonkho',
    label: '/tonkho',
    description: 'Luồng 1: Sinh bảng cân đối Nhập - Xuất - Tồn chuẩn BRAVO ngay từ đầu',
    shortcut: 'Ctrl+T',
    iconType: 'tonkho',
    flows: ['generate'],
    example: '/tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)'
  },
  {
    command: '/optimize',
    label: '/optimize',
    description: 'Luồng 2: Nhận code SQL thô của coder (dán trực tiếp hoặc file .sql) để tối ưu',
    shortcut: 'Ctrl+O',
    iconType: 'optimize',
    flows: ['optimize'],
    example: '/optimize SELECT td.Ma_Vt, (SELECT Ten_vt FROM DMVT WHERE Ma_Vt = td.Ma_Vt) AS Ten_vt FROM Ton_Dau td'
  },
  {
    command: '/debug',
    label: '/debug',
    description: 'Luồng 2: Chẩn đoán lỗi trong code SQL thô (vi phạm FK, CHECK, NULL, Truncate...)',
    shortcut: 'Ctrl+D',
    iconType: 'debug',
    flows: ['optimize'],
    example: '/debug Lỗi Foreign Key FK_CTCT_CT khi insert So_Ct chưa có trong CT'
  },
  {
    command: '/diff',
    label: '/diff',
    description: 'Luồng 2: So sánh khác biệt giữa code thô ban đầu và bản tối ưu BRAVO',
    iconType: 'diff',
    flows: ['optimize'],
    example: '/diff query ban đầu vs query đã tối ưu'
  },
  {
    command: '/explain',
    label: '/explain',
    description: 'Giải thích logic query, CHECK constraint, hoặc execution plan',
    shortcut: 'Ctrl+E',
    iconType: 'explain',
    flows: ['generate', 'optimize'],
    example: '/explain Ràng buộc Loai_Ct (1: Nhập, 2: Xuất) và Loai_Vt (1 đến 5)'
  },
  {
    command: '/schema',
    label: '/schema',
    description: 'Tra cứu cấu trúc bảng, kiểu dữ liệu, ràng buộc khoá chính/khoá ngoại',
    iconType: 'schema',
    flows: ['generate', 'optimize'],
    example: '/schema Xem toàn bộ cấu trúc bảng CT, CTCT và Ton_Dau'
  },
  {
    command: '/convert',
    label: '/convert',
    description: 'Chuyển đổi T-SQL ↔ PostgreSQL (giữ nguyên logic, chỉ đổi cú pháp)',
    iconType: 'convert',
    flows: ['generate', 'optimize'],
    example: '/convert SELECT TOP 10 Ma_Vt, Ten_vt FROM dbo.DMVT WHERE ISNULL(Dvt, \'\') <> \'\''
  },
  {
    command: '/learn',
    label: '/learn',
    description: 'Nạp tri thức mới cho hệ thống (gõ quy tắc, kèm file .sql mẫu)',
    iconType: 'learn',
    flows: ['generate', 'optimize'],
    example: '/learn Bảng DMVT luôn lọc Dinh_Chi = 0 để loại vật tư ngừng sử dụng'
  }
];

export const SAMPLE_PROMPTS = [
  'Tính tồn kho cuối kỳ T1/2025 cho Kho tổng Hà Nội K01 (Tồn đầu + Nhập - Xuất)',
  '/query Top 5 khách hàng có doanh thu xuất kho lớn nhất năm 2025',
  `/optimize SELECT td.Ma_Vt, (SELECT Ten_vt FROM DMVT WHERE Ma_Vt = td.Ma_Vt) AS Ten_vt, td.So_Luong AS Ton_Dau, ISNULL(nhap.SL, 0) AS Nhap
FROM Ton_Dau td
LEFT JOIN (SELECT ct2.Ma_Vt, SUM(ct2.So_Luong) AS SL FROM CTCT ct2 INNER JOIN CT c ON ct2.So_Ct = c.So_Ct WHERE c.Loai_Ct = 1 GROUP BY ct2.Ma_Vt) nhap ON td.Ma_Vt = nhap.Ma_Vt
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'`,
  '/explain Ý nghĩa các giá trị Loai_Vt (1: Thép, 2: Điện, 3: Nhựa, 4: Bao bì, 5: Hóa chất)',
  '/schema Cấu trúc bảng CTCT và các quan hệ Foreign Key'
];

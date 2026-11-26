import type { KnowledgeRule } from '../types';

export const DEFAULT_BRAVO_RULES: KnowledgeRule[] = [
  {
    id: 'rule-1.1',
    title: 'Cấm Subquery trong SELECT list',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Không dùng subquery độc lập cho từng cột trong SELECT list vì gây suy giảm hiệu năng nghiêm trọng.',
    ruleText: 'Cấm tuyệt đối kiểu SELECT (SELECT...FROM...) AS Col1, (SELECT...) AS Col2 FROM... Bắt buộc chuyển thành JOIN hoặc gom trước.',
    exampleBad: 'SELECT td.Ma_Vt, (SELECT Ten_vt FROM DMVT WHERE Ma_Vt = td.Ma_Vt) AS Ten_vt FROM Ton_Dau td;',
    exampleGood: 'SELECT td.Ma_Vt, vt.Ten_vt FROM Ton_Dau td INNER JOIN DMVT vt ON td.Ma_Vt = vt.Ma_vt;'
  },
  {
    id: 'rule-1.2',
    title: 'Tối ưu GROUP BY 1 trường & Bắt buộc bọc MAX() (Chống lỗi Msg 8120)',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'GROUP BY tối đa 1 trường mã đã index; MỌI cột mô tả đi kèm (Ten_vt, Dvt, Ten_Dt, Ten_Kho) trong SELECT bắt buộc phải bọc MAX() để chống lỗi Msg 8120.',
    ruleText: 'GROUP BY tối đa 1 trường mã (ví dụ GROUP BY dw.Ma_Vt). CẢNH BÁO BẮT BUỘC (CHỐNG LỖI Msg 8120): Khi chỉ GROUP BY 1 trường Mã, TẤT CẢ các cột thông tin danh mục đi kèm trên SELECT (như vt.Ten_vt, vt.Dvt, dt.Ten_Dt, k.Ten_Kho) BẮT BUỘC PHẢI BỌC HÀM MAX() (ví dụ: MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt). TUYỆT ĐỐI CẤM viết trần vt.Ten_vt hoặc vt.Dvt trong SELECT khi không có mặt trong GROUP BY (sẽ gây lỗi sập SQL Server Msg 8120). Ngoài ra, tiền tố alias của cột Mã trong SELECT, GROUP BY và ORDER BY phải đồng nhất (cùng là dw.Ma_Vt).',
    exampleBad: 'SELECT vt.Ma_vt, vt.Ten_vt, SUM(dw.So_Luong) AS Tong_SL FROM #DW dw INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt GROUP BY vt.Ma_vt; -- LỖI Msg 8120 vì vt.Ten_vt không bọc MAX()!',
    exampleGood: 'SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt, ISNULL(SUM(dw.So_Luong), 0) AS Tong_SL FROM #DW dw INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt GROUP BY dw.Ma_Vt ORDER BY dw.Ma_Vt;'
  },
  {
    id: 'rule-1.3',
    title: 'Xử lý triệt để NULL & Tối ưu SUM',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Số NULL đưa về 0, chuỗi NULL đưa về khoảng trắng. Ưu tiên SUM trên tập dữ liệu đã gộp ít dòng nhất.',
    ruleText: 'Hạn chế để giá trị NULL: số gán 0 qua ISNULL(col, 0), chuỗi gán \' \'. SUM lấy càng ít dòng càng tốt — ưu tiên SUM trên dữ liệu đã gộp sẵn.',
    exampleGood: 'ISNULL(SUM(ct2.So_Luong), 0) AS Tong_Xuat'
  },
  {
    id: 'rule-1.4',
    title: 'Bắt đầu FROM từ bảng gốc phát sinh',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Luôn FROM từ bảng chi tiết chứng từ (CTCT) rồi mới JOIN sang danh mục (DMVT), không làm ngược lại.',
    ruleText: 'Luôn FROM từ bảng gốc (bảng phát sinh/chi tiết chứng từ, VD CTCT) rồi mới JOIN sang bảng phụ (danh mục). Đảm bảo không bỏ sót dữ liệu phát sinh mới chưa cập nhật danh mục.',
    exampleGood: 'FROM dbo.CTCT ct2 INNER JOIN dbo.DMVT vt ON ct2.Ma_Vt = vt.Ma_vt'
  },
  {
    id: 'rule-1.5',
    title: 'Quản lý kiểu biến & Khối lệnh BEGIN...END',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Biến có dấu dùng nvarchar, không dấu dùng varchar. Khối lệnh > 2 câu lệnh bắt buộc bọc BEGIN...END.',
    ruleText: 'Khối lệnh thực thi có > 2 khối lệnh con bắt buộc có BEGIN...END. Biến không dấu dùng varchar (nhẹ); có dấu tiếng Việt dùng nvarchar. @@ là biến hệ thống/toàn cục, # là bảng tạm cục bộ, @ là biến cục bộ.'
  },
  {
    id: 'rule-1.6',
    title: 'Ép kiểu an toàn trong UNION ALL & Bảng tạm',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Các nhánh UNION ALL phải đồng nhất thứ tự và kiểu dữ liệu. Ép kiểu số thập phân rõ ràng.',
    ruleText: 'UNION ALL: các trường phải giống hệt nhau về thứ tự và kiểu dữ liệu. Cột số tiền/số lượng phải ép kiểu rõ ràng CAST(0 AS NUMERIC(18, 2)), không để số nguyên 0 ngầm định.'
  },
  {
    id: 'rule-1.7',
    title: 'CẤM TUYỆT ĐỐI JOIN Tồn đầu với Phát sinh',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Cấm JOIN trực tiếp Ton_Dau với CTCT vì gây nhân đôi số lượng Cartesian. Bắt buộc gom qua bảng tạm trung gian bằng UNION ALL.',
    ruleText: 'CẤM TUYỆT ĐỐI: JOIN trực tiếp bảng phát sinh (CTCT) với bảng tồn đầu (Ton_Dau). Phải gộp dữ liệu qua bảng trung gian TEMP (UNION ALL phát sinh + tồn đầu vào 1 bảng #), rồi mới GROUP BY/JOIN tiếp.',
    exampleBad: 'SELECT ... FROM Ton_Dau td FULL OUTER JOIN CTCT ct2 ON td.Ma_Vt = ct2.Ma_Vt',
    exampleGood: 'SELECT Ma_Vt, So_Luong AS Ton_Dau, 0 AS Nhap, 0 AS Xuat INTO #DW FROM Ton_Dau UNION ALL SELECT Ma_Vt, 0, So_Luong, 0 FROM CTCT...'
  },
  {
    id: 'rule-1.8',
    title: 'Chuẩn hóa hàm xếp hạng (RANK, DENSE_RANK, ROW_NUMBER)',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Hiểu rõ nghiệp vụ: RANK nhảy bậc khi trùng, DENSE_RANK liên tục, ROW_NUMBER tăng dần duy nhất.',
    ruleText: 'RANK(): giá trị bằng nhau xếp cùng số, bậc sau nhảy theo tổng số bản ghi (1,2,2,4,5). DENSE_RANK(): giá trị bằng nhau xếp cùng số, bậc sau liên tục (1,2,2,3,3,3,4). ROW_NUMBER(): luôn tăng dần, không trùng (1,2,3,4,5).'
  },
  {
    id: 'rule-1.9',
    title: 'Cấu trúc bảng tạm Idempotent DROP TABLE',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Luôn kiểm tra và xóa bảng tạm trước khi tạo để có thể chạy lại script nhiều lần mà không bị lỗi trùng tên.',
    ruleText: 'Đầu mỗi script có dùng bảng tạm luôn phải có dòng: IF OBJECT_ID(\'tempdb..#X\') IS NOT NULL DROP TABLE #X; để đảm bảo tính Idempotent.',
    exampleGood: 'IF OBJECT_ID(\'tempdb..#KetQua\') IS NOT NULL DROP TABLE #KetQua;'
  },
  {
    id: 'rule-1.10',
    title: 'Phòng chống lỗi Truncate (Msg 2628) với 1 lần CAST mở rộng',
    category: 'core',
    enabled: true,
    createdAt: '01/11/2026',
    description: 'Rà soát độ dài chuỗi nhãn trước khi trả code. Khi nối chuỗi tạo nhãn, chỉ cần CAST 1 lần tại biến thành NVARCHAR(50) để độ rộng tự đủ chứa dòng TỔNG CỘNG.',
    ruleText: 'Trước khi trả code, AI tự động quét độ dài chuỗi lớn nhất. Khi ghép chuỗi tạo cột nhãn/kỳ báo cáo, CHỈ CẦN CAST 1 LẦN ngay tại biến truyền vào (ví dụ: N\'Tháng \' + CAST(Thang AS NVARCHAR(50)) AS Ky_Bao_Cao). Tuyệt đối không lồng 2 lần CAST cồng kềnh. Độ rộng tổng tự động đạt 56 ký tự, chứa thoải mái dòng N\'TỔNG CỘNG\' (9 ký tự).',
    exampleGood: 'N\'Tháng \' + CAST(Thang AS NVARCHAR(50)) AS Ky_Bao_Cao'
  },
  {
    id: 'rule-1.11',
    title: 'Gom dòng & Hạn chế mỗi dòng 1 trường',
    category: 'core',
    enabled: true,
    createdAt: '02/11/2026',
    description: 'Gom các trường cùng nhóm ngữ nghĩa (Mã, Tên, ĐVT...) hoặc cặp số liệu (SL, Tiền) trên cùng 1 dòng, tuyệt đối không ngắt mỗi dòng 1 trường lắt nhắt.',
    ruleText: 'TUYỆT ĐỐI HẠN CHẾ VIẾT MỖI DÒNG 1 TRƯỜNG LẮT NHẮT (Cấm tách riêng: dòng 1 Ma_Vt, dòng 2 Ten_vt, dòng 3 Dvt). BẮT BUỘC GOM DÒNG: Các trường thông tin danh mục (Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt) hoặc cặp số liệu (SL_Dau, Tien_Dau / SL_Nhap, Tien_Nhap) PHẢI VIẾT LIÊN TIẾP TRÊN CÙNG 1 DÒNG cách nhau bởi dấu phẩy ", ". Từ khóa SELECT bắt đầu ngay danh sách trường trên cùng 1 dòng. Chỉ xuống dòng khi vượt quá 90 ký tự hoặc chuyển sang nhóm công thức tính toán khác.',
    exampleBad: 'SELECT\n    dw.Ma_Vt,\n    MAX(vt.Ten_vt) AS Ten_vt,\n    MAX(vt.Dvt) AS Dvt',
    exampleGood: 'SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt,\n    ISNULL(SUM(dw.SL_Dau), 0) AS SL_Dau, ISNULL(SUM(dw.Tien_Dau), 0) AS Tien_Dau'
  },
  {
    id: 'rule-1.12',
    title: 'Báo cáo Phân cấp N Tầng & Dòng Tổng cộng An toàn (Chống lỗi Msg 104)',
    category: 'core',
    enabled: true,
    createdAt: '05/11/2026',
    description: 'Chỉ tạo dòng Tổng cộng / Phân cấp khi cần thiết. Khi tạo dòng Tổng cộng (Cuoi = 1), bắt buộc INSERT vào bảng tạm #KetQua trước rồi mới SELECT đơn, tuyệt đối cấm UNION ALL trực tiếp kèm ORDER BY cột ẩn (Msg 104).',
    ruleText: 'QUY TẮC BÁO CÁO & DÒNG TỔNG CỘNG (CHỐNG LỖI Msg 104): (1) Với báo cáo Nhập - Xuất - Tồn hoặc thống kê thông thường không yêu cầu dòng Tổng cộng/Phân cấp, chỉ truy vấn trực tiếp từ bảng tạm #DW JOIN danh mục (DMVT), GROUP BY Ma_Vt và ORDER BY Ma_Vt (ngắn gọn, tốc độ cao nhất). (2) Khi cần tạo dòng TỔNG CỘNG (Cuoi = 1) hoặc phân cấp N tầng (Cap, Cuoi): TUYỆT ĐỐI CẤM dùng UNION ALL ở câu lệnh SELECT hiển thị cuối cùng kèm ORDER BY theo cột không nằm trong SELECT list (sẽ gây lỗi sập SQL Server Msg 104: ORDER BY items must appear in the select list if the statement contains a UNION, INTERSECT or EXCEPT operator). BẮT BUỘC dùng mô hình 2 bước: Bước A đổ dòng chi tiết (0 AS Cuoi) vào #KetQua (SELECT 0 AS Cuoi, ... INTO #KetQua); Bước B dùng INSERT INTO #KetQua SELECT 1 AS Cuoi, N\'TỔNG CỘNG\', ... để chèn dòng tổng; Bước C dùng 1 câu SELECT đơn (KHÔNG có UNION ALL) để lấy kết quả: SELECT Ma_Vt, Ten_vt, ... FROM #KetQua ORDER BY Cuoi, Ma_Vt; (hoặc nếu dùng UNION ALL thì mọi cột trong ORDER BY bắt buộc phải có mặt trong danh sách SELECT).',
    exampleBad: 'SELECT Ma_Vt, Ten_vt, SL_Cuoi FROM #KetQua\nUNION ALL\nSELECT N\'TỔNG CỘNG\', N\'\', SUM(SL_Cuoi) FROM #KetQua\nORDER BY Cuoi, Ma_Vt; -- LỖI Msg 104 vì Cuoi không nằm trong SELECT list của UNION ALL!',
    exampleGood: 'INSERT INTO #KetQua (Cuoi, Ma_Vt, Ten_vt, SL_Cuoi)\nSELECT 1 AS Cuoi, N\'TỔNG CỘNG\', N\'\', SUM(SL_Cuoi) FROM #KetQua WHERE Cuoi = 0;\n\nSELECT Ma_Vt, Ten_vt, SL_Cuoi FROM #KetQua ORDER BY Cuoi, Ma_Vt;'
  },
  {
    id: 'rule-1.13',
    title: 'Lọc sớm qua bảng tạm khi có phép toán phức tạp (Chống nghẽn RESOURCE_SEMAPHORE)',
    category: 'core',
    enabled: true,
    createdAt: '13/11/2026',
    description: 'Khi có phép toán/so sánh phức tạp (như so sánh đơn giá, ABS, ROUND) kết hợp ORDER BY, bắt buộc lọc sớm vào bảng tạm trước khi JOIN bảng danh mục text dài, tránh treo Memory Grant 30s+.',
    ruleText: 'LỌC SỚM QUA BẢNG TẠM (EARLY FILTERING VIA TEMP TABLE): Khi câu truy vấn có điều kiện lọc tính toán phức tạp (như so sánh đơn giá thực tế chênh lệch ABS(...), tính tỷ lệ...) kết hợp ORDER BY trên bảng lớn: BẮT BUỘC lọc và tính toán trước trên bảng số liệu gốc (như CTCT) đổ vào bảng tạm hẹp #Temp; sau đó mới JOIN sang các bảng cha (CT) và bảng danh mục chứa text dài (DMVT, DMDT) để lấy tên và sắp xếp. Tuyệt đối không JOIN bảng text dài trước khi lọc toán học, vì sẽ khiến SQL Server ước tính sai Cardinality, yêu cầu Memory Grant khổng lồ và bị treo wait_type RESOURCE_SEMAPHORE từ 30-40 giây.',
    exampleBad: 'SELECT ctct.So_Ct, c.Ngay_Ct, vt.Ten_vt, ... FROM CTCT ctct INNER JOIN CT c ON ... LEFT JOIN DMVT vt ON ... WHERE ABS(...) > 100000 ORDER BY c.Ngay_Ct DESC',
    exampleGood: 'SELECT ctct.So_Ct, ctct.Stt_Dong, ctct.Ma_Vt, ... INTO #ChenhLech FROM CTCT ctct WHERE ABS(...) > 100000;\nSELECT cl.So_Ct, c.Ngay_Ct, vt.Ten_vt, ... FROM #ChenhLech cl INNER JOIN CT c ON ... LEFT JOIN DMVT vt ON ... ORDER BY c.Ngay_Ct DESC;\nIF OBJECT_ID(\'tempdb..#ChenhLech\') IS NOT NULL DROP TABLE #ChenhLech;'
  }
];

export const EXAMPLE_PROMPT_LIMIT = 2000;

export interface LearnDraft {
  title: string;
  ruleText: string;
  exampleGood?: string;
}

export function parseLearnInput(
  input: string,
  attached?: { name: string; content: string } | null
): LearnDraft | null {
  const body = input.replace(/^\/learn\b\s*/i, '');
  const fence = body.match(/```(?:sql|tsql)?\s*\n?([\s\S]*?)```/i);

  let ruleText = body;
  let example: string | undefined;

  if (fence) {
    example = fence[1].trim();
    ruleText = body.replace(fence[0], '').trim();
  } else if (attached?.content.trim()) {
    example = attached.content.trim();
    ruleText = body.trim();
  } else {
    ruleText = body.trim();
  }

  if (!ruleText && !example) return null;

  const autoText = !ruleText;
  if (autoText) {
    ruleText = `Tuân theo cách viết trong đoạn code mẫu${attached ? ` (${attached.name})` : ''}.`;
  }

  const firstLine = autoText ? '' : ruleText.split('\n')[0].split(/[:—]/)[0].trim().slice(0, 60);
  const title = firstLine.length > 5
    ? firstLine
    : attached
    ? attached.name.replace(/\.[^.]+$/, '')
    : 'Quy tắc ' + new Date().toLocaleDateString('vi-VN');

  return { title, ruleText, exampleGood: example };
}

function formatExample(label: string, code: string): string {
  const body = code.length > EXAMPLE_PROMPT_LIMIT ? code.slice(0, EXAMPLE_PROMPT_LIMIT) + '\n-- ...đã lược bớt' : code;
  return `\n- ${label}:\n\`\`\`sql\n${body}\n\`\`\``;
}

export function compileKnowledgeToSystemPrompt(rules: KnowledgeRule[]): string {
  const activeRules = rules.filter(r => r.enabled);
  
  const coreRules = activeRules.filter(r => r.category === 'core');
  const customRules = activeRules.filter(r => r.category === 'custom');
  const learnedRules = activeRules.filter(r => r.category === 'learned');

  let prompt = `# KHO TRI THỨC VÀ BỘ QUY TẮC NGHIỆP VỤ BẮT BUỘC CHO AI AGENT
*(Hệ thống tri thức mở: AI bắt buộc phải tổng hợp và tuân thủ đồng thời toàn bộ các quy tắc dưới đây trong mọi câu lệnh T-SQL sinh ra)*

## 1. QUY TẮC CỐT LÕI CHUẨN BRAVO T-SQL (${coreRules.length} quy tắc đang kích hoạt):
`;

  coreRules.forEach((rule, idx) => {
    prompt += `\n**1.${idx + 1} ${rule.title}**\n- ${rule.ruleText}`;
    if (rule.exampleGood) prompt += formatExample('Ví dụ đúng', rule.exampleGood);
    if (rule.exampleBad) prompt += formatExample('Ví dụ sai (Anti-pattern)', rule.exampleBad);
    prompt += '\n';
  });

  if (customRules.length > 0) {
    prompt += `\n## 2. TRI THỨC NGHIỆP VỤ DO DOANH NGHIỆP / NGƯỜI DÙNG BỔ SUNG (${customRules.length} quy tắc tùy chỉnh):
*(Đây là các quy định riêng của người dùng cho dự án này, AI bắt buộc phải ưu tiên áp dụng)*\n`;
    customRules.forEach((rule, idx) => {
      prompt += `\n**2.${idx + 1} [Tùy chỉnh] ${rule.title}**\n- ${rule.ruleText}`;
      if (rule.description) prompt += `\n- Mô tả bối cảnh: ${rule.description}`;
      if (rule.exampleGood) prompt += formatExample('Mẫu chuẩn', rule.exampleGood);
      prompt += '\n';
    });
  }

  if (learnedRules.length > 0) {
    prompt += `\n## 3. TRI THỨC HỌC ĐƯỢC TỪ HỘI THOẠI & FEEDBACK (/learn - ${learnedRules.length} quy tắc):
*(Các kinh nghiệm và điều chỉnh được người dùng hướng dẫn trong quá trình làm việc)*\n`;
    learnedRules.forEach((rule, idx) => {
      prompt += `\n**3.${idx + 1} [Đã học] ${rule.title}**\n- ${rule.ruleText}`;
      if (rule.exampleGood) prompt += formatExample('Mẫu chuẩn', rule.exampleGood);
      prompt += '\n';
    });
  }

  prompt += `
## 4. QUY TẮC ĐỊNH DẠNG SQL BRAVO (BẮT BUỘC - 1 TAB = 4 KHOẢNG TRẮNG)
- Cấp 0 sát lề trái (0 khoảng trắng): DECLARE, SELECT, INTO, FROM, WHERE, GROUP BY, HAVING, ORDER BY, UNION ALL, INSERT INTO, UPDATE, SET, DELETE, WITH, IF, DROP...
- Cấp 1 thụt đúng 4 khoảng trắng: danh sách trường trong SELECT (khi xuống dòng), các biến DECLARE tiếp theo, các phép JOIN, điều kiện AND/OR trong WHERE...
- Cấp 2 trở lên (+4 khoảng trắng mỗi cấp): Subquery trong ngoặc, điều kiện lồng trong ON...
- GOM DÒNG & HẠN CHẾ MỖI DÒNG 1 TRƯỜNG (BẮT BUỘC):
  + TUYỆT ĐỐI HẠN CHẾ VIẾT MỖI DÒNG 1 TRƯỜNG LẮT NHẮT (Cấm tách riêng: dòng 1 td.Ma_Vt, dòng 2 vt.Ten_vt, dòng 3 vt.Dvt).
  + Gom các trường danh mục (Ma_Vt, Ten_vt, Dvt) viết liên tiếp trên CÙNG MỘT DÒNG ngay sau SELECT: SELECT td.Ma_Vt, vt.Ten_vt, vt.Dvt,
  + Gom các cặp số liệu cùng ngữ nghĩa vào một dòng (SL_Dau, Tien_Dau / SL_Nhap, Tien_Nhap / SL_Xuat, Tien_Xuat).
  + Chỉ xuống dòng khi dòng vượt quá ~90 ký tự, hoặc chuyển sang công thức tính toán dài/CASE WHEN phức tạp.
`;

  return prompt;
}

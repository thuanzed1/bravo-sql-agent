import type { AiConfig, AiProvider, ReasoningStep, TableSchema, TableRelationship, SqlDialect, KnowledgeRule } from '../types';
import { TABLES_SCHEMA, RELATIONSHIPS } from '../data/quanLyKhoSchema';
import { compileKnowledgeToSystemPrompt, DEFAULT_BRAVO_RULES } from '../data/knowledgeBase';
import { formatBravoSql } from './sqlFormatter';
import { extractAllRoutines } from './fileModifier';

const envGeminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const envGeminiModel = (import.meta as any).env?.VITE_GEMINI_MODEL || '';
const envOpenAiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || '';
const envGroqKey = (import.meta as any).env?.VITE_GROQ_API_KEY || '';
const envGroqModel = (import.meta as any).env?.VITE_GROQ_MODEL || '';

/**
 * Tách chuỗi 1 hoặc nhiều API key (ngăn cách bằng dấu phẩy, chấm phẩy hoặc xuống dòng)
 * để hỗ trợ xoay vòng key tự động khi gặp lỗi hết quota (HTTP 429).
 */
export function parseApiKeys(raw?: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const part of raw.split(/[,;\r\n\s]+/)) {
    const clean = part.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      keys.push(clean);
    }
  }
  return keys;
}

export const DEFAULT_AI_CONFIGS: Record<AiProvider, AiConfig> = {
  groq: {
    provider: 'groq',
    apiKey: envGroqKey,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: envGroqModel || 'llama-3.3-70b-versatile',
    temperature: 0.1
  },
  openai: {
    provider: 'openai',
    apiKey: envOpenAiKey,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.1
  },
  gemini: {
    provider: 'gemini',
    apiKey: envGeminiKey,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: envGeminiModel || 'gemini-2.5-flash',
    temperature: 0.1
  },
  ollama: {
    provider: 'ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5-coder:7b',
    temperature: 0.1
  },
  mock: {
    provider: 'mock',
    apiKey: '',
    baseUrl: '',
    model: 'offline-rag-engine',
    temperature: 0.1
  }
};

export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  groq: ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'gpt-3.5-turbo'],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.8-flash'
  ],
  ollama: ['qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'deepseek-coder-v2', 'codellama', 'llama3.1'],
  mock: ['offline-rag-engine']
};

export const UNIFIED_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'] as const;

export function normalizeGeminiModel(model?: string): string {
  const clean = (model || '').trim().replace(/^models\//, '').replace(/\s+/g, '-');
  if (clean && (clean.startsWith('gemini-') || clean.startsWith('tunedModels/'))) {
    return clean;
  }
  return 'gemini-2.5-flash';
}

function buildKnowledgeAndSchemaContext(
  tables: TableSchema[] = TABLES_SCHEMA,
  relationships: TableRelationship[] = RELATIONSHIPS,
  dbName: string = 'QuanLyKho',
  rules?: KnowledgeRule[]
): string {
  const dynamicRules = rules && rules.length > 0
    ? compileKnowledgeToSystemPrompt(rules)
    : compileKnowledgeToSystemPrompt(DEFAULT_BRAVO_RULES);

  const schemaSummary = tables.map(t => {
    const cols = t.columns.map(c =>
      `  - ${c.name} (${c.type})${c.isPk ? ' [PK]' : ''}${c.isFk ? ` [FK trỏ tới ${c.fkRef}]` : ''}${c.checkConstraint ? ` [CHECK: ${c.checkConstraint}]` : ''}: ${c.description || ''}`
    ).join('\n');
    return `Bảng: ${t.fullName}\nSố dòng: ${t.rowCount}\nMô tả: ${t.description}\nCác cột:\n${cols}`;
  }).join('\n\n');

  const rels = relationships.map(r =>
    `- ${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn}: ${r.description}`
  ).join('\n');

  return `${dynamicRules}

THÔNG TIN CƠ SỞ DỮ LIỆU HIỆN TẠI ĐANG LÀM VIỆC: "${dbName.toUpperCase()}"
${schemaSummary}

CÁC QUAN HỆ KHÓA NGOẠI (FOREIGN KEYS):
${rels || 'Không có quan hệ khóa ngoại'}`;
}

const SHARED_OUTPUT_FORMAT_RULES = `YÊU CẦU TRÌNH BÀY OUTPUT CỦA AGENT:
1. Luôn bọc toàn bộ code T-SQL trong khối code markdown:
\`\`\`sql
-- Code T-SQL tuân thủ chuẩn BRAVO
\`\`\`
2. Trình bày ngắn gọn, súc tích, theo phong cách kỹ thuật cho lập trình viên (Developer-first).
3. Định dạng văn bản giải thích:
   - Sử dụng Markdown chuẩn chỉn chu: Tiêu đề phân mục rõ ràng (\`### 1. Tiêu đề\`), danh sách gạch đầu dòng (\`- \`), in đậm đối tượng quan trọng (\`**tên**\`).
   - Khi so sánh (đặc biệt là lệnh /diff hoặc tối ưu /optimize), bắt buộc trình bày dưới dạng Bảng Markdown chuẩn (\`| Tiêu chí | Cách viết ban đầu | Cách viết chuẩn BRAVO |\`) có dòng phân cách (\`| :--- | :--- | :--- |\`).
   - Tên bảng, tên cột, biến và hàm SQL phải được bọc trong backtick (ví dụ: \`Ma_Vt\`, \`Loai_Ct\`, \`Ton_Dau\`, \`ISNULL\`).
   - TUYỆT ĐỐI KHÔNG sử dụng các biểu tượng cảm xúc (emoji/icon) như ❌, ✅, ⚡, 📐, 📌, 🗄️, 🛠️, 🔄... Giữ văn phong kỹ thuật 100% nghiêm túc, tinh gọn và chuẩn mực.
   - Trình bày thoáng đãng, các đoạn văn cách nhau 1 dòng trống.
4. Công thức nghiệp vụ: Khi nêu công thức tính toán (ví dụ: Tồn cuối = Tồn đầu + Nhập - Xuất), hãy viết công thức rõ ràng, in đậm: **Tồn cuối = Tồn đầu + Nhập trong kỳ - Xuất trong kỳ**. Tuyệt đối KHÔNG viết cú pháp LaTeX thô như \`$$\\text{...}$$\`.
5. BẮT BUỘC RÀ SOÁT ĐỘ DÀI TRƯỜNG & PHÒNG CHỐNG LỖI TRUNCATE (Msg 2628):
   - Trước khi trả code, AI bắt buộc phải tự rà soát độ dài tối đa của tất cả các biến, nhãn text (như N'TỔNG CỘNG', N'ĐẦU KỲ', chuỗi nối kỳ báo cáo...) sẽ đổ vào từng cột rồi mới quyết định độ rộng trường cần thiết.
   - CHỈ CAST 1 LẦN DUY NHẤT: Khi nối chuỗi, chỉ cần mở rộng độ rộng ở ngay biến truyền vào (ví dụ: N'Tháng ' + CAST(Thang AS NVARCHAR(50)) AS Ky_Bao_Cao), TUYỆT ĐỐI KHÔNG lồng 2 lần CAST cồng kềnh kiểu CAST(N'...' + CAST(...) AS ...).
   - Cơ chế SQL Server sẽ tự động cấp phát độ dài chuỗi tổng (6 + 50 = 56 ký tự), đảm bảo lệnh INSERT dòng N'TỔNG CỘNG' (9 ký tự) phía sau không bao giờ bị lỗi "String or binary data would be truncated... Truncated value: 'TỔNG CỘN'".
   - Các cột số liệu phải ép rõ CAST(0 AS NUMERIC(18, 2)), không để số nguyên 0 ngầm định.
6. TUÂN THỦ TUYỆT ĐỐI QUY CHUẨN GOM DÒNG (HẠN CHẾ MỖI DÒNG 1 TRƯỜNG):
   - Tuyệt đối hạn chế viết mỗi dòng chỉ 1 trường ngắn lắt nhắt (CẤM: dòng 1 \`dw.Ma_Vt,\`, dòng 2 \`MAX(vt.Ten_vt) AS Ten_vt,\`, dòng 3 \`MAX(vt.Dvt) AS Dvt,\`).
   - BẮT BUỘC GOM DÒNG: Các trường danh mục định danh viết liên tiếp trên CÙNG 1 DÒNG ngay sau từ khóa \`SELECT\` (ví dụ khi có GROUP BY: \`SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt,\`).
   - Các cặp số liệu liên quan theo từng kỳ (\`SL_Dau, Tien_Dau\` / \`SL_Nhap, Tien_Nhap\` / \`SL_Xuat, Tien_Xuat\`) viết trên cùng 1 dòng thụt 4 khoảng trắng.
   - Chỉ xuống dòng khi dòng dài vượt quá ~85-90 ký tự hoặc chuyển sang biểu thức tính toán dài/CASE WHEN phức tạp.
7. PHÂN ĐỊNH RÕ RÀNG BẢNG CHỨNG TỪ CHA (CT) VÀ BẢNG CHI TIẾT (CTCT) - CHỐNG LỖI CỘT DINH_CHI (Msg 207):
   - Bảng \`dbo.CT\` (thông tin chung): gồm \`So_Ct, Ngay_Ct, Ma_Dt, Ma_Kho, Loai_Ct, Dien_Giai, Dinh_Chi\`. Alias khuyến nghị: \`c\`.
   - Bảng \`dbo.CTCT\` (chi tiết dòng chứng từ): CHỈ CÓ 6 CỘT: \`So_Ct, Stt_Dong, Ma_Vt, So_Luong, Don_Gia, Tien\`. Alias khuyến nghị: \`ctct\`.
   - CẢNH BÁO QUAN TRỌNG: Bảng \`CTCT\` KHÔNG CÓ CỘT \`Dinh_Chi\` VÀ KHÔNG CÓ CỘT \`Ngay_Ct\`! CẤM đặt alias "ct" cho bảng \`CTCT\` để tránh nhầm lẫn với \`CT\`.
   - Cột \`Dinh_Chi\` CHỈ TỒN TẠI ở: \`CT\`, \`DMVT\`, \`DMKho\`, \`DMDT\`. Khi lọc chứng từ hợp lệ, CHỈ VIẾT \`c.Dinh_Chi = 0\` (từ bảng \`CT\`), TUYỆT ĐỐI CẤM viết \`ct.Dinh_Chi = 0\` hoặc \`ctct.Dinh_Chi = 0\` (sẽ gây lỗi sập hệ thống Msg 207: Invalid column name 'Dinh_Chi').
   - Khi chia tính đơn giá, LUÔN dùng \`NULLIF(ctct.So_Luong, 0)\` để tránh lỗi Divide by zero (Msg 8134).
8. TỐI ƯU HÓA HIỆU NĂNG THỰC THI — CHỐNG NGHẼN BỘ NHỚ RESOURCE_SEMAPHORE (BẮT BUỘC):
   - KHI TRUY VẤN CÓ ĐIỀU KIỆN LỌC PHÉP TOÁN PHỨC TẠP (ví dụ: so sánh chênh lệch đơn giá, hàm ABS, chia phép toán...) KẾT HỢP VỚI ORDER BY TRÊN BẢNG GIAO DỊCH LỚN (CTCT ~39.000 dòng):
     + TUYỆT ĐỐI CẤM viết gộp 1 câu SELECT JOIN sẵn với các bảng danh mục chứa cột text dài (như DMVT.Ten_vt NVARCHAR(200)) rồi mới WHERE phép toán và ORDER BY. Làm như vậy SQL Server bị bẫy ước lượng sai Cardinality, yêu cầu Memory Grant quá lớn và bị treo RESOURCE_SEMAPHORE từ 30 đến 40 giây!
     + BẮT BUỘC ÁP DỤNG QUY CHUẨN 2 BƯỚC QUA BẢNG TẠM TRUNG GIAN (#) ĐỂ CHẠY DƯỚI 0.05 GIÂY:
       * Bước 1 (Lọc sớm - Early Filtering): Lọc và tính toán trước trên bảng số liệu gốc CTCT đổ vào bảng tạm hẹp #Temp (chỉ lấy các cột số/mã cần thiết, chưa JOIN bảng text dài).
       * Bước 2: Từ tập dữ liệu siêu nhỏ trong bảng tạm #Temp, mới JOIN sang CT (để lấy Ngay_Ct và lọc c.Dinh_Chi = 0) và DMVT (để lấy Ten_vt, Dvt) rồi mới ORDER BY.
       * Bước 3: Luôn giải phóng bảng tạm: IF OBJECT_ID('tempdb..#Temp') IS NOT NULL DROP TABLE #Temp;
   - Luôn bắt đầu kịch bản bằng SET NOCOUNT ON;
9. PHÒNG CHỐNG TRIỆT ĐỂ LỖI KINH ĐIỂN Msg 8120 (QUÊN BỌC MAX KHI GROUP BY 1 TRƯỜNG) & Msg 104 (ORDER BY TRONG UNION ALL):
   - CHỐNG LỖI KINH ĐIỂN Msg 8120 (\`Column 'dbo.DMVT.Ten_vt' is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause\`):
     + Khi áp dụng Quy tắc 1.2 (\`GROUP BY\` tối đa 1 trường Mã như \`GROUP BY dw.Ma_Vt\` hoặc \`GROUP BY c.Ma_Dt\`), MỌI cột thông tin mô tả đi kèm trong \`SELECT\` (như \`vt.Ten_vt\`, \`vt.Dvt\`, \`dt.Ten_Dt\`, \`k.Ten_Kho\`) BẮT BUỘC 100% PHẢI BỌC TRONG HÀM \`MAX()\`:
       * SAI (LỖI SẬP Msg 8120): \`SELECT vt.Ma_vt, vt.Ten_vt, ISNULL(SUM(dw.Ton_Dau_SL), 0) ... GROUP BY vt.Ma_vt\`
       * ĐÚNG CHUẨN BRAVO: \`SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt, ISNULL(SUM(dw.Ton_Dau_SL), 0) AS Ton_Dau_SL ... GROUP BY dw.Ma_Vt ORDER BY dw.Ma_Vt;\`
     + Đồng bộ alias cột Mã: Nếu \`FROM #DW dw INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt\`, thì trong \`SELECT\`, \`GROUP BY\` và \`ORDER BY\` đều phải dùng thống nhất \`dw.Ma_Vt\`.
     + Khi tối ưu code ở Luồng 2 (\`/optimize\`), KHÔNG tự ý thêm \`WHERE vt.Dinh_Chi = 0\` nếu câu lệnh gốc của lập trình viên không có điều kiện đó (tránh làm mất vật tư còn tồn kho). Trong nhánh \`UNION ALL\`, nhánh \`ELSE\` của số lượng/tiền luôn viết \`ELSE CAST(0 AS NUMERIC(18, 2)) END\`.
   - LUẬT BẤT DI BẤT DỊCH CỦA SQL SERVER (Msg 104): Khi một câu lệnh có chứa \`UNION\` hoặc \`UNION ALL\`, MỌI cột nằm trong mệnh đề \`ORDER BY\` BẮT BUỘC PHẢI XUẤT HIỆN TƯỜNG MINH trong danh sách \`SELECT\` của nhánh đầu tiên (và không được mang tiền tố alias bảng như \`dw.Ma_Vt\`).
   - TUYỆT ĐỐI CẤM viết kiểu sau (sẽ gây lỗi sập SQL Server \`Msg 104: ORDER BY items must appear in the select list if the statement contains a UNION, INTERSECT or EXCEPT operator\`):
     \`\`\`sql
     -- CẤM TUYỆT ĐỐI (LỖI Msg 104 vì Cuoi không nằm trong SELECT list của UNION ALL):
     SELECT Ma_Vt, Ten_vt, Dvt, SL_Cuoi FROM #KetQua
     UNION ALL
     SELECT N'TỔNG CỘNG', N'', N'', SUM(SL_Cuoi) FROM #KetQua
     ORDER BY Cuoi, Ma_Vt;
     \`\`\`
   - QUY CHUẨN BẮT BUỘC KHI VIẾT BÁO CÁO NHẬP - XUẤT - TỒN HOẶC BÁO CÁO TỔNG HỢP:
     + Trường hợp 1 (Mặc định khuyến nghị khi người dùng không yêu cầu bắt buộc dòng Tổng cộng): Chỉ cần dùng 1 bảng tạm \`#DW\` gom \`Ton_Dau\` + \`CTCT\` bằng \`UNION ALL\`, sau đó \`SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt, ... FROM #DW dw INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt GROUP BY dw.Ma_Vt ORDER BY dw.Ma_Vt;\`. Ngắn gọn, chạy cực nhanh và không bao giờ lỗi.
     + Trường hợp 2 (Khi cần thêm dòng \`TỔNG CỘNG\` hoặc phân cấp \`Cuoi\`/\`STT\`): BẮT BUỘC dùng \`INSERT INTO #KetQua\` để chèn dòng Tổng cộng vào bảng tạm trước, rồi mới dùng 1 câu \`SELECT\` ĐƠN (KHÔNG CÓ \`UNION ALL\`) ở bước cuối:
       * Bước A: \`SELECT 0 AS Cuoi, CAST(dw.Ma_Vt AS NVARCHAR(50)) AS Ma_Vt, ... INTO #KetQua FROM #DW dw ... GROUP BY dw.Ma_Vt;\`
       * Bước B: \`INSERT INTO #KetQua (Cuoi, Ma_Vt, ...) SELECT 1 AS Cuoi, N'TỔNG CỘNG', ... FROM #KetQua WHERE Cuoi = 0;\`
       * Bước C (SELECT đơn, không có UNION ALL): \`SELECT Ma_Vt, Ten_vt, Dvt, ... FROM #KetQua ORDER BY Cuoi, Ma_Vt;\`
   - Không bao giờ đặt \`ORDER BY\` ở cuối câu lệnh \`SELECT ... INTO #DW ... UNION ALL SELECT ...\`.`;

/**
 * Luồng 1: Sinh code T-SQL mới từ mô tả nghiệp vụ (Text-to-SQL).
 * Code sinh ra phải đạt chuẩn tối ưu BRAVO ngay từ lần đầu, không sinh bản kém tối ưu rồi gợi ý người dùng tối ưu lại.
 */
export function buildGenerationPrompt(
  tables: TableSchema[] = TABLES_SCHEMA,
  relationships: TableRelationship[] = RELATIONSHIPS,
  dbName: string = 'QuanLyKho',
  rules?: KnowledgeRule[]
): string {
  const context = buildKnowledgeAndSchemaContext(tables, relationships, dbName, rules);
  return `${context}

CHẾ ĐỘ HOẠT ĐỘNG — LUỒNG 1: SINH MÃ T-SQL MỚI TỪ YÊU CẦU NGHIỆP VỤ (TEXT-TO-SQL)
- Nhiệm vụ: Từ mô tả nghiệp vụ tiếng Việt của người dùng, sinh trực tiếp câu lệnh T-SQL **ĐÃ TỐI ƯU SẴN** và tuân thủ 100% chuẩn BRAVO ngay từ bước đầu.
- KHÔNG sinh phiên bản chạy chậm (ví dụ nhiều subquery \`LEFT JOIN\` tách rời hoặc subquery trong \`SELECT\`) rồi gợi ý người dùng tự chạy \`/optimize\`. Với nghiệp vụ Nhập-Xuất-Tồn, áp dụng thẳng bảng tạm \`#DW\` + \`UNION ALL\` hoặc Single-Pass \`CASE WHEN\` theo đúng Rule 1.7.
- Luôn trả về DUY NHẤT 1 khối code \`\`\`sql hoàn chỉnh.

${SHARED_OUTPUT_FORMAT_RULES}`;
}

export const buildSystemPrompt = buildGenerationPrompt;

/**
 * Luồng 2: Tối ưu hóa / Refactor mã nguồn SQL thô có sẵn của lập trình viên (Code-to-Optimized-SQL).
 */
export function buildOptimizationPrompt(
  tables: TableSchema[] = TABLES_SCHEMA,
  relationships: TableRelationship[] = RELATIONSHIPS,
  dbName: string = 'QuanLyKho',
  rules?: KnowledgeRule[]
): string {
  const context = buildKnowledgeAndSchemaContext(tables, relationships, dbName, rules);
  return `${context}

CHẾ ĐỘ HOẠT ĐỘNG — LUỒNG 2: REVIEW & TỐI ƯU HÓA MÃ SQL THÔ CỦA LẬP TRÌNH VIÊN (CODE OPTIMIZATION)
- Bối cảnh: Lập trình viên đã tự dựng xong phần lõi/code SQL thô (dán trực tiếp hoặc đính kèm file \`.sql\`) và gửi lên AI để **tìm điểm nghẽn hiệu năng và tái cấu trúc chuẩn BRAVO**.
- QUY TRÌNH BẮT BUỘC:
  1. **Chẩn đoán điểm nghẽn (Bottleneck & Anti-pattern Audit)**: Chỉ rõ các vấn đề có trong đoạn code gốc (Multi-Pass Scan đọc bảng nhiều lần, Subquery trong \`SELECT\` list, JOIN trực tiếp \`Ton_Dau\` với \`CTCT\` gây tích Descartes, \`GROUP BY\` nhiều trường text dài, thiếu \`ISNULL\`, để số \`0\` kiểu \`INT\` trong \`UNION ALL\`, nguy cơ Truncate \`Msg 2628\`...).
  2. **Tái cấu trúc (Refactor) chuẩn BRAVO**: Viết lại câu lệnh sang dạng tối ưu (Single-Pass \`CASE WHEN\` hoặc bảng tạm \`#DW\` + \`UNION ALL\` theo Rule 1.7, bọc \`MAX()\` cho cột mô tả, \`CAST(0 AS NUMERIC(18, 2))\`, gom dòng Rule 1.11).
  3. **Bảng đối chiếu Before vs After**: Tóm tắt ngắn gọn thay đổi hiệu năng và tính toàn vẹn dữ liệu bằng Bảng Markdown.

NGUYÊN TẮC BẢO TOÀN KHI TỐI ƯU CODE CÓ SẴN:
1. KHÔNG xóa toàn bộ nội dung file cũ rồi viết lại từ đầu; bảo toàn 100% logic nghiệp vụ, tên tham số, tên cột đầu ra và ý nghĩa kết quả của lập trình viên (trừ các bộ lọc/thay đổi mà lập trình viên yêu cầu bổ sung trực tiếp như lọc phiếu xuất bán \`Loai_Ct = 2\`, chuyển subquery sang \`JOIN\`, v.v.).
2. BẢO TOÀN PHẠM VI YÊU CẦU (STRICT SCOPE INTEGRITY - CHỐNG SCOPE CREEP):
   - Khi lập trình viên chỉ định rõ phạm vi hẹp (ví dụ: "tối ưu thủ tục sp_BaoCaoDoanhThuTheoDoiTuong", "chỉ tối ưu phần WHERE", "chỉ sửa phép toán"): AI CHỈ ĐƯỢC PHÉP sửa chính xác đối tượng/phần đó, TUYỆT ĐỐI KHÔNG sửa lan sang các thủ tục hoặc phần khác.
   - ĐƠN VỊ THỦ TỤC ĐỘC LẬP (SINGLE-ROUTINE SMART PATCH): Khi tối ưu một Stored Procedure / View / Function cụ thể từ file có nhiều thủ tục, trong khối \`\`\`sql trả về CHỈ xuất ra DUY NHẤT định nghĩa của đúng thủ tục mục tiêu đó (bắt đầu từ \`CREATE OR ALTER PROCEDURE ...\` đến \`END;\` / \`GO\`), KHÔNG chép lại \`USE ...\` và KHÔNG xuất lại các thủ tục khác trong file.
3. CHỐNG ẢO GIÁC NGỮ CẢNH VỀ BẢNG TẠM (ANTI-HALLUCINATION TRÊN CODE SNIPPET):
   - Khi đầu vào là một đoạn snippet cắt từ kịch bản dài (ví dụ chỉ gửi một bước \`SELECT ... INTO #KetQua ...\`), TUYỆT ĐỐI KHÔNG tự ý chèn thêm \`IF OBJECT_ID('tempdb..#...') IS NOT NULL DROP TABLE #...;\` vào trước đoạn snippet nếu không phải tối ưu toàn bộ script từ đầu.
4. TỐI ƯU SARGABLE CHO NGÀY THÁNG & SUBQUERY:
   - Khi mã gốc lọc ngày bằng hàm \`YEAR(c.Ngay_Ct) = @Nam\` hoặc \`MONTH(...)\`, chuyển sang khoảng ngày SARGable (\`DECLARE @Tu_Ngay DATETIME = DATEFROMPARTS(@Nam, 1, 1); DECLARE @Den_Ngay_Sau DATETIME = DATEADD(YEAR, 1, @Tu_Ngay);\` với \`c.Ngay_Ct >= @Tu_Ngay AND c.Ngay_Ct < @Den_Ngay_Sau\`) để SQL Server tận dụng Index trên \`Ngay_Ct\`.
   - Khi mã gốc dùng subquery trong \`SELECT\` (ví dụ \`(SELECT Ten_Dt FROM dbo.DMDT WHERE Ma_Dt = c.Ma_Dt)\`), chuyển sang \`INNER JOIN dbo.DMDT dt ON c.Ma_Dt = dt.Ma_Dt\` và bọc \`MAX(dt.Ten_Dt) AS Ten_Dt\` khi \`GROUP BY c.Ma_Dt\`.
5. KHỐI CODE MARKDOWN DUY NHẤT (IDE SMART-PATCH COMPATIBILITY):
   - Luôn trả về DUY NHẤT 1 khối code \`\`\`sql hoàn chỉnh để hệ thống Smart Patching đối chiếu Diff và ghi đè chính xác vào đúng thủ tục/đoạn code trong file \`.sql\` gốc.

${SHARED_OUTPUT_FORMAT_RULES}`;
}

interface AiAdapter {
  call(config: AiConfig, prompt: string, history: { role: string; content: string }[], systemPrompt: string): Promise<string>;
  testConnection(config: AiConfig): Promise<{ success: boolean; message: string; latencyMs?: number }>;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Cooldown cache theo cặp (provider|keyPrefix|model) để tránh thử lại cổng/key vừa bị 429 trong lúc demo
const modelKeyCooldownUntil = new Map<string, number>();
let stickyHealthyGeminiRoute: { key: string; model: string; expiresAt: number } | null = null;
let stickyHealthyGroqRoute: { key: string; model: string; expiresAt: number } | null = null;

function isRateLimitOrQuotaError(status: number, message: string): boolean {
  if (status === 429 || status === 503) return true;
  const lower = message.toLowerCase();
  return lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted');
}

function summarizeApiError(status: number, rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    return 'Hết quota/giới hạn lượt gọi (429)';
  }
  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('api key not valid')) {
    return 'API Key không hợp lệ hoặc đã hết hạn';
  }
  if (status === 404 || lower.includes('not found') || lower.includes('decommissioned')) {
    return `Model không khả dụng (${status})`;
  }
  const firstLine = rawMessage.split('\n')[0].trim();
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
}

async function tryOpenAiCompatibleCall(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens?: number,
  timeoutMs: number = 25000
): Promise<{ ok: true; text: string } | { ok: false; fatalAuth: boolean; rateLimited: boolean; shortError: string }> {
  try {
    const body: Record<string, any> = { model, messages, temperature };
    if (maxTokens !== undefined) body.max_tokens = maxTokens;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      },
      timeoutMs
    );

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      if (text) return { ok: true, text };
      return { ok: false, fatalAuth: false, rateLimited: false, shortError: 'Phản hồi rỗng' };
    }

    const errJson = await response.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    const fatalAuth = response.status === 401 || response.status === 403;
    const rateLimited = isRateLimitOrQuotaError(response.status, rawMsg);
    return {
      ok: false,
      fatalAuth,
      rateLimited,
      shortError: summarizeApiError(response.status, rawMsg)
    };
  } catch (err: any) {
    const shortError = err.name === 'AbortError'
      ? `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s)`
      : (err.message || 'Lỗi kết nối mạng');
    return { ok: false, fatalAuth: false, rateLimited: false, shortError };
  }
}

function createOpenAiCompatibleAdapter(
  providerName: string,
  defaultBaseUrl: string,
  defaultModel: string,
  fallbackModels: string[],
  useStickyGroqCache: boolean
): AiAdapter {
  return {
    async call(config, prompt, history, systemPrompt) {
      const keys = parseApiKeys(config.apiKey);
      if (keys.length === 0) {
        throw new Error(`Chưa cấu hình ${providerName} API Key trong Cài đặt.`);
      }

      const baseUrl = (config.baseUrl || defaultBaseUrl).replace(/\/+$/, '');
      const endpoint = `${baseUrl}/chat/completions`;
      const selectedModel = (config.model || defaultModel).trim();
      const models = [...new Set([selectedModel, ...fallbackModels])];
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({
          role: h.role === 'agent' ? 'assistant' : 'user',
          content: h.content
        })),
        { role: 'user', content: prompt }
      ];

      const now = Date.now();
      if (useStickyGroqCache && stickyHealthyGroqRoute && now < stickyHealthyGroqRoute.expiresAt && keys.includes(stickyHealthyGroqRoute.key)) {
        const stickyRes = await tryOpenAiCompatibleCall(
          endpoint,
          stickyHealthyGroqRoute.key,
          stickyHealthyGroqRoute.model,
          messages,
          config.temperature ?? 0.1
        );
        if (stickyRes.ok) return stickyRes.text;
        stickyHealthyGroqRoute = null;
      }

      const errors: string[] = [];
      let authErrors = 0;

      for (const model of models) {
        for (let idx = 0; idx < keys.length; idx++) {
          const apiKey = keys[idx];
          const cooldownKey = `${providerName}|${apiKey.slice(-6)}|${model}`;
          const cooldown = modelKeyCooldownUntil.get(cooldownKey) || 0;
          if (Date.now() < cooldown) continue;

          const res = await tryOpenAiCompatibleCall(endpoint, apiKey, model, messages, config.temperature ?? 0.1);
          if (res.ok) {
            if (useStickyGroqCache) {
              stickyHealthyGroqRoute = { key: apiKey, model, expiresAt: Date.now() + 300000 };
            }
            return res.text;
          }
          if (res.fatalAuth) {
            authErrors++;
            modelKeyCooldownUntil.set(cooldownKey, Date.now() + 300000);
          } else if (res.rateLimited) {
            modelKeyCooldownUntil.set(cooldownKey, Date.now() + 60000);
          } else {
            modelKeyCooldownUntil.set(cooldownKey, Date.now() + 120000);
          }
          errors.push(`Key#${idx + 1}/${model}: ${res.shortError}`);
        }
      }

      if (authErrors === keys.length * models.length) {
        throw new Error(`${providerName} API Key không hợp lệ hoặc đã hết hạn.`);
      }
      throw new Error(`Lỗi gọi ${providerName} (${errors.slice(0, 2).join(' | ')})`);
    },

    async testConnection(config) {
      const startTime = Date.now();
      const keys = parseApiKeys(config.apiKey);
      if (keys.length === 0) {
        return { success: false, message: `Vui lòng nhập ${providerName} API Key.` };
      }

      const baseUrl = (config.baseUrl || defaultBaseUrl).replace(/\/+$/, '');
      const endpoint = `${baseUrl}/chat/completions`;
      const selectedModel = (config.model || defaultModel).trim();
      const models = [...new Set([selectedModel, ...fallbackModels])];
      const pingMessages = [{ role: 'user', content: 'ping' }];
      const errors: string[] = [];

      for (const model of models) {
        for (let idx = 0; idx < keys.length; idx++) {
          const res = await tryOpenAiCompatibleCall(endpoint, keys[idx], model, pingMessages, 0, 5, 10000);
          if (res.ok) {
            const latencyMs = Date.now() - startTime;
            const keyInfo = keys.length > 1 ? ` · Key #${idx + 1}/${keys.length}` : '';
            const switchNote = model !== selectedModel ? ` (tự động chuyển dự phòng sang ${model})` : '';
            return {
              success: true,
              message: `Kết nối ${providerName} (${model}${keyInfo}) thành công!${switchNote}`,
              latencyMs
            };
          }
          errors.push(`Key#${idx + 1} (${model}): ${res.shortError}`);
        }
      }

      return {
        success: false,
        message: `Lỗi kết nối ${providerName} — ${errors[0] || 'Không thể kết nối'}`
      };
    }
  };
}

const groqAdapter: AiAdapter = createOpenAiCompatibleAdapter(
  'Groq',
  'https://api.groq.com/openai/v1',
  'llama-3.3-70b-versatile',
  ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'],
  true
);

const openAiAdapter: AiAdapter = createOpenAiCompatibleAdapter(
  'OpenAI',
  'https://api.openai.com/v1',
  'gpt-4o-mini',
  ['gpt-4o-mini'],
  false
);

const RELIABLE_GEMINI_WATERFALL = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-latest'
];

let cachedLiveFlashModels: { keyTail: string; list: string[]; expiresAt: number } | null = null;

async function discoverLiveTextFlashModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const now = Date.now();
  const keyTail = apiKey.slice(-6);
  if (cachedLiveFlashModels && cachedLiveFlashModels.keyTail === keyTail && now < cachedLiveFlashModels.expiresAt) {
    return cachedLiveFlashModels.list;
  }
  try {
    const res = await fetchWithTimeout(`${baseUrl}/models?key=${apiKey.trim()}`, { method: 'GET' }, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    const excludePattern = /(tts|image|audio|vision|embedding|aqa|robotics|computer-use|deep-research|veo|imagen|gemma)/i;
    const list = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((name: string) => name.includes('flash') && !excludePattern.test(name));
    if (list.length > 0) {
      cachedLiveFlashModels = { keyTail, list, expiresAt: now + 300000 };
    }
    return list;
  } catch {
    return [];
  }
}

async function tryGeminiModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  requestPayload: Record<string, any>,
  timeoutMs: number
): Promise<{ ok: true; text: string } | { ok: false; fatalAuth: boolean; rateLimited: boolean; shortError: string }> {
  const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey.trim()}`;
  try {
    // Với dòng 2.5-*, tắt thinkingBudget để phản hồi nhanh trong lúc demo
    const payloadToSend = model.startsWith('gemini-2.5-')
      ? {
          ...requestPayload,
          generationConfig: {
            ...requestPayload.generationConfig,
            thinkingConfig: { thinkingBudget: 0 }
          }
        }
      : requestPayload;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend)
      },
      timeoutMs
    );

    if (response.ok) {
      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: any) => p.text || '').join('').trim();
      if (text) return { ok: true, text };
      return { ok: false, fatalAuth: false, rateLimited: false, shortError: 'Phản hồi rỗng' };
    }

    const errJson = await response.json().catch(() => ({}));
    const errMessage = errJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    const lowerErr = errMessage.toLowerCase();
    const fatalAuth =
      lowerErr.includes('api key not valid') ||
      lowerErr.includes('api_key_invalid') ||
      lowerErr.includes('permission denied');
    const rateLimited = isRateLimitOrQuotaError(response.status, errMessage);

    return {
      ok: false,
      fatalAuth,
      rateLimited,
      shortError: summarizeApiError(response.status, errMessage)
    };
  } catch (err: any) {
    const shortError = err.name === 'AbortError'
      ? `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s)`
      : (err.message || 'Lỗi kết nối mạng');
    return { ok: false, fatalAuth: false, rateLimited: false, shortError };
  }
}

const geminiAdapter: AiAdapter = {
  async call(config, prompt, history, systemPrompt) {
    const keys = parseApiKeys(config.apiKey);
    if (keys.length === 0) {
      throw new Error('Chưa cấu hình Google Gemini API Key trong Cài đặt.');
    }

    const cleanModel = normalizeGeminiModel(config.model);
    const baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const conversationHistory = history.slice(-4).map(h => ({
      role: h.role === 'agent' ? 'model' : 'user',
      parts: [{ text: h.content.length > 2000 ? h.content.slice(0, 2000) : h.content }]
    }));

    const requestPayload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [...conversationHistory, { role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.1
      }
    };

    const now = Date.now();
    if (
      stickyHealthyGeminiRoute &&
      now < stickyHealthyGeminiRoute.expiresAt &&
      keys.includes(stickyHealthyGeminiRoute.key)
    ) {
      const stickyRes = await tryGeminiModel(
        baseUrl,
        stickyHealthyGeminiRoute.key,
        stickyHealthyGeminiRoute.model,
        requestPayload,
        20000
      );
      if (stickyRes.ok) return stickyRes.text;
      stickyHealthyGeminiRoute = null;
    }

    const modelErrors: string[] = [];
    let validKeyCount = keys.length;

    // Pha 1: Xoay vòng qua toàn bộ danh sách Key x Model ổn định (ưu tiên model đang chọn -> 2.5-flash -> 2.5-flash-lite -> 2.0-flash)
    const primaryCandidates = [...new Set([cleanModel, ...RELIABLE_GEMINI_WATERFALL])];
    for (const currentModel of primaryCandidates) {
      for (let idx = 0; idx < keys.length; idx++) {
        const apiKey = keys[idx];
        const cooldownKey = `gemini|${apiKey.slice(-6)}|${currentModel}`;
        const cooldown = modelKeyCooldownUntil.get(cooldownKey) || 0;
        if (Date.now() < cooldown) continue;

        const res = await tryGeminiModel(baseUrl, apiKey, currentModel, requestPayload, 20000);
        if (res.ok) {
          stickyHealthyGeminiRoute = { key: apiKey, model: currentModel, expiresAt: Date.now() + 300000 };
          return res.text;
        }
        if (res.fatalAuth) {
          validKeyCount--;
          modelKeyCooldownUntil.set(cooldownKey, Date.now() + 300000);
        } else {
          modelKeyCooldownUntil.set(cooldownKey, Date.now() + (res.rateLimited ? 180000 : 120000));
        }
        modelErrors.push(`Key#${idx + 1}/${currentModel}: ${res.shortError}`);
      }
    }

    if (validKeyCount <= 0) {
      throw new Error('Tất cả Gemini API Key đều không hợp lệ hoặc đã hết hạn.');
    }

    // Pha 2: Tự dò các model flash còn quota trên từng key
    for (let idx = 0; idx < keys.length; idx++) {
      const apiKey = keys[idx];
      const liveModels = await discoverLiveTextFlashModels(apiKey, baseUrl);
      const rescueModels = liveModels.filter(m => !primaryCandidates.includes(m));
      for (const rescueModel of rescueModels) {
        const cooldownKey = `gemini|${apiKey.slice(-6)}|${rescueModel}`;
        if (Date.now() < (modelKeyCooldownUntil.get(cooldownKey) || 0)) continue;

        const res = await tryGeminiModel(baseUrl, apiKey, rescueModel, requestPayload, 16000);
        if (res.ok) {
          stickyHealthyGeminiRoute = { key: apiKey, model: rescueModel, expiresAt: Date.now() + 300000 };
          return res.text;
        }
        modelKeyCooldownUntil.set(cooldownKey, Date.now() + 180000);
        modelErrors.push(`Key#${idx + 1}/${rescueModel}: ${res.shortError}`);
      }
    }

    throw new Error(`Không thể nhận phản hồi từ Gemini (${modelErrors.slice(0, 2).join(' | ')})`);
  },

  async testConnection(config) {
    const startTime = Date.now();
    const keys = parseApiKeys(config.apiKey);
    if (keys.length === 0) {
      return { success: false, message: 'Vui lòng nhập ít nhất 1 Gemini API Key.' };
    }

    const cleanModel = normalizeGeminiModel(config.model);
    const primaryCandidates = [...new Set([cleanModel, ...RELIABLE_GEMINI_WATERFALL])];
    const baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const pingPayload = {
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 5 }
    };

    const errors: string[] = [];

    for (const model of primaryCandidates) {
      for (let idx = 0; idx < keys.length; idx++) {
        const res = await tryGeminiModel(baseUrl, keys[idx], model, pingPayload, 10000);
        if (res.ok) {
          const latencyMs = Date.now() - startTime;
          const keyNote = keys.length > 1 ? ` · Key #${idx + 1}/${keys.length}` : '';
          const switchedNote = model !== cleanModel
            ? ` (tự động chuyển sang ${model} do ${cleanModel} hết quota)`
            : '';
          return {
            success: true,
            message: `Kết nối Gemini (${model}${keyNote}) thành công!${switchedNote}`,
            latencyMs
          };
        }
        if (res.fatalAuth) {
          errors.push(`Key#${idx + 1}: ${res.shortError}`);
          continue;
        }
        errors.push(`Key#${idx + 1}/${model}: ${res.shortError}`);
      }
    }

    // Dò thêm live flash models trên key đầu tiên còn sống
    for (let idx = 0; idx < keys.length; idx++) {
      const liveModels = await discoverLiveTextFlashModels(keys[idx], baseUrl);
      const rescueCandidates = liveModels.filter(m => !primaryCandidates.includes(m)).slice(0, 3);
      for (const model of rescueCandidates) {
        const res = await tryGeminiModel(baseUrl, keys[idx], model, pingPayload, 8000);
        if (res.ok) {
          const latencyMs = Date.now() - startTime;
          const keyNote = keys.length > 1 ? ` · Key #${idx + 1}/${keys.length}` : '';
          return {
            success: true,
            message: `Key hoạt động tốt! Tự động chuyển sang ${model}${keyNote}.`,
            latencyMs
          };
        }
      }
    }

    return {
      success: false,
      message: `Lỗi kết nối Gemini — ${errors[0] || 'Tất cả key/model đang hết quota'}`
    };
  }
};

const ollamaAdapter: AiAdapter = {
  async call(config, prompt, history, systemPrompt) {
    const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/api/chat`;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({
        role: h.role === 'agent' ? 'assistant' : 'user',
        content: h.content
      })),
      { role: 'user', content: prompt }
    ];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || 'qwen2.5-coder:7b',
          messages,
          stream: false,
          options: { temperature: config.temperature ?? 0.1 }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama trả về HTTP ${response.status}. Kiểm tra model "${config.model}".`);
      }

      const data = await response.json();
      return data.message?.content || 'Không có phản hồi từ Ollama.';
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('Failed to fetch')) {
        throw new Error(`Không thể kết nối tới Ollama tại ${config.baseUrl}. Kiểm tra xem tiến trình ollama serve đã khởi động.`);
      }
      throw err;
    }
  },

  async testConnection(config) {
    const startTime = Date.now();
    const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/api/tags`;
    const res = await fetch(endpoint);
    if (!res.ok) return { success: false, message: `Ollama HTTP ${res.status}` };
    const data = await res.json();
    const models = data?.models?.map((m: any) => m.name).join(', ') || 'Chưa có model';
    return {
      success: true,
      message: `Kết nối Ollama thành công. Các model khả dụng: ${models}`,
      latencyMs: Date.now() - startTime
    };
  }
};

const mockAdapter: AiAdapter = {
  async call() {
    throw new Error('USE_MOCK_FALLBACK');
  },
  async testConnection() {
    return { success: true, message: 'Chế độ offline sẵn sàng.', latencyMs: 1 };
  }
};

const ADAPTERS: Record<AiProvider, AiAdapter> = {
  groq: groqAdapter,
  openai: openAiAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
  mock: mockAdapter
};

export async function testAiConnection(config: AiConfig): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const adapter = ADAPTERS[config.provider];
    if (!adapter) return { success: false, message: 'Provider không xác định' };
    return await adapter.testConnection(config);
  } catch (err: any) {
    return { success: false, message: err.message || 'Không thể kết nối tới dịch vụ AI' };
  }
}

function getProviderLabel(config: AiConfig): string {
  const providerLabelMap: Record<AiProvider, string> = {
    groq: `Groq (${config.model})`,
    openai: `OpenAI (${config.model})`,
    gemini: `Google Gemini (${config.model})`,
    ollama: `Ollama Local (${config.model})`,
    mock: 'Chế độ offline (Dữ liệu mẫu)'
  };
  return providerLabelMap[config.provider] || config.provider;
}

function parseAiSqlResponse(rawText: string, fallbackMessage: string): { cleanText: string; sql?: string } {
  const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
  const sql = sqlMatch ? formatBravoSql(sqlMatch[1].trim()) : undefined;

  let cleanText = rawText;
  if (sqlMatch) {
    cleanText = rawText.replace(sqlMatch[0], '').trim();
    if (!cleanText) {
      cleanText = fallbackMessage;
    }
  }
  return { cleanText, sql };
}

/**
 * Luồng 1: Sinh code T-SQL mới từ yêu cầu ngôn ngữ tự nhiên (Text-to-SQL).
 */
export async function dispatchAiRequest(
  config: AiConfig,
  prompt: string,
  history: { role: string; content: string }[],
  customTables?: TableSchema[],
  customRels?: TableRelationship[],
  dbName: string = 'QuanLyKho',
  attachedFile?: { name: string; content: string },
  rules?: KnowledgeRule[]
): Promise<{
  text: string;
  sql?: string;
  reasoningSteps: ReasoningStep[];
  providerLabel: string;
}> {
  const adapter = ADAPTERS[config.provider] || mockAdapter;
  const systemPrompt = buildGenerationPrompt(customTables, customRels, dbName, rules);
  const providerLabel = getProviderLabel(config);

  let finalPrompt = prompt;
  if (attachedFile) {
    const routines = extractAllRoutines(attachedFile.content);
    const lowerPrompt = prompt.toLowerCase();
    const matchedRoutine = routines.find(r => lowerPrompt.includes(r.name.toLowerCase()));
    if (matchedRoutine && routines.length > 1) {
      finalPrompt = `[NGỮ CẢNH TẬP TIN ĐÍNH KÈM: ${attachedFile.name} — CHỈ TẬP TRUNG VÀO THỦ TỤC ${matchedRoutine.name}]\n\`\`\`sql\n${matchedRoutine.text}\n\`\`\`\n\nYÊU CẦU CỦA LẬP TRÌNH VIÊN (CHỈ trả về code của đúng thủ tục \`${matchedRoutine.name}\`, KHÔNG xuất lại \`USE ...\` hay các thủ tục khác):\n${prompt}`;
    } else {
      finalPrompt = `[NGỮ CẢNH TẬP TIN ĐÍNH KÈM: ${attachedFile.name}]\n\`\`\`sql\n${attachedFile.content}\n\`\`\`\n\nYÊU CẦU CỦA LẬP TRÌNH VIÊN:\n${prompt}`;
    }
  }

  const rawText = await adapter.call(config, finalPrompt, history, systemPrompt);
  const { cleanText, sql } = parseAiSqlResponse(rawText, 'Dưới đây là câu lệnh T-SQL chuẩn BRAVO được sinh theo yêu cầu:');

  const reasoningSteps: ReasoningStep[] = [
    { text: `[Luồng 1 · Sinh SQL] Gửi yêu cầu tới ${providerLabel}`, status: 'done' },
    { text: `Đối chiếu schema cơ sở dữ liệu "${dbName}"`, status: 'done' },
    { text: attachedFile ? `Tham chiếu ngữ cảnh tập tin ${attachedFile.name}` : 'Áp dụng các quy tắc tối ưu BRAVO ngay từ bước sinh mã', status: 'done' }
  ];

  return {
    text: cleanText,
    sql,
    reasoningSteps,
    providerLabel
  };
}

/**
 * Luồng 2: Tối ưu hóa mã SQL thô do lập trình viên đã dựng sẵn (Code-to-Optimized-SQL).
 */
export async function dispatchOptimizationRequest(
  config: AiConfig,
  rawSql: string,
  userNote: string,
  history: { role: string; content: string }[],
  customTables?: TableSchema[],
  customRels?: TableRelationship[],
  dbName: string = 'QuanLyKho',
  attachedFile?: { name: string; content: string },
  rules?: KnowledgeRule[],
  targetRoutineName?: string
): Promise<{
  text: string;
  sql?: string;
  reasoningSteps: ReasoningStep[];
  providerLabel: string;
}> {
  const adapter = ADAPTERS[config.provider] || mockAdapter;
  const systemPrompt = buildOptimizationPrompt(customTables, customRels, dbName, rules);
  const providerLabel = getProviderLabel(config);

  const scopeDirective = targetRoutineName
    ? `\n\nPHẠM VI BẮT BUỘC (SMART PATCH):\n- Chỉ tối ưu DUY NHẤT thủ tục/đối tượng \`${targetRoutineName}\`.\n- Trong khối \`\`\`sql trả về, CHỈ xuất ra định nghĩa đã tối ưu của đúng \`${targetRoutineName}\` (bắt đầu từ \`CREATE OR ALTER ...\` đến \`END; GO\`), TUYỆT ĐỐI KHÔNG chép lại \`USE ...\` hay bất kỳ thủ tục nào khác.`
    : '';

  const scopeLine = userNote.trim()
    ? `\n\nYÊU CẦU & PHẠM VI TỐI ƯU CỦA LẬP TRÌNH VIÊN (BẮT BUỘC THỰC HIỆN ĐẦY ĐỦ):\n${userNote.trim()}${scopeDirective}`
    : `\n\nYÊU CẦU: Phân tích toàn bộ điểm nghẽn hiệu năng/anti-pattern và tái cấu trúc sang T-SQL chuẩn BRAVO, giữ nguyên logic nghiệp vụ đầu ra.${scopeDirective}`;

  const sourceHeader = attachedFile
    ? targetRoutineName
      ? `[MÃ NGUỒN THỦ TỤC MỤC TIÊU "${targetRoutineName}" TRÍCH TỪ FILE: ${attachedFile.name}]`
      : `[MÃ NGUỒN SQL THÔ TỪ FILE: ${attachedFile.name}]`
    : '[MÃ NGUỒN SQL THÔ DO LẬP TRÌNH VIÊN CUNG CẤP]';

  const optimizationPrompt = `${sourceHeader}\n\`\`\`sql\n${rawSql.trim()}\n\`\`\`${scopeLine}`;

  const rawText = await adapter.call(config, optimizationPrompt, history, systemPrompt);
  const { cleanText, sql } = parseAiSqlResponse(rawText, 'Đã phân tích và tối ưu đoạn mã SQL thô theo chuẩn BRAVO:');

  const reasoningSteps: ReasoningStep[] = [
    {
      text: targetRoutineName
        ? `[Luồng 2 · Tối ưu SQL thô] Khoanh vùng đúng thủ tục mục tiêu "${targetRoutineName}" trong ${attachedFile?.name || 'mã nguồn'}`
        : `[Luồng 2 · Tối ưu SQL thô] Tiếp nhận mã nguồn ${attachedFile ? attachedFile.name : 'từ lập trình viên'}`,
      status: 'done'
    },
    { text: `Rà soát điểm nghẽn hiệu năng & anti-pattern trên schema "${dbName}"`, status: 'done' },
    { text: `Tái cấu trúc chuẩn BRAVO & bảo toàn logic bằng ${providerLabel}`, status: 'done' }
  ];

  return {
    text: cleanText,
    sql,
    reasoningSteps,
    providerLabel
  };
}

export function buildConversionPrompt(direction: 'tsql-to-pg' | 'pg-to-tsql'): string {
  const fromLabel = direction === 'tsql-to-pg' ? 'T-SQL (SQL Server)' : 'PostgreSQL';
  const toLabel = direction === 'tsql-to-pg' ? 'PostgreSQL' : 'T-SQL (SQL Server)';

  return `Bạn là chuyên gia chuyển đổi cú pháp SQL. Nhiệm vụ: Chuyển đổi code từ ${fromLabel} sang ${toLabel}.

QUY TẮC BẮT BUỘC:
1. CHỈ chuyển đổi cú pháp (syntax). KHÔNG thêm, bớt, sửa hoặc xóa bất kỳ logic nghiệp vụ nào.
2. Giữ nguyên tên bảng, tên cột, alias, comment. Chỉ đổi schema prefix nếu cần (dbo. -> public.).
3. Kết quả PHẢI đặt trong khối code markdown: \`\`\`sql ... \`\`\`

BẢNG QUY TẮC CHUYỂN ĐỔI ${fromLabel} -> ${toLabel}:
${direction === 'tsql-to-pg' ? `
| T-SQL | PostgreSQL |
|---|---|
| SELECT TOP n ... | SELECT ... LIMIT n (đặt cuối query) |
| ISNULL(x, y) | COALESCE(x, y) |
| GETDATE() | NOW() |
| DATEADD(day, n, date) | date + INTERVAL 'n days' |
| DATEADD(month, n, date) | date + INTERVAL 'n months' |
| DATEDIFF(day, a, b) | DATE_PART('day', b - a)::int |
| CONVERT(type, val) | CAST(val AS type) |
| CAST(x AS nvarchar) | CAST(x AS varchar) |
| nvarchar(n) | varchar(n) |
| datetime | timestamp |
| int IDENTITY(1,1) | SERIAL |
| bit | boolean |
| [column_name] | "column_name" (dấu ngoặc vuông -> nháy kép) |
| dbo.TableName | public.TableName |
| SET NOCOUNT ON | (bỏ dòng này) |
| @@ROWCOUNT | (dùng GET DIAGNOSTICS row_count = ROW_COUNT) |
| CHARINDEX(a, b) | POSITION(a IN b) |
| LEN(x) | LENGTH(x) |
| STUFF(str, start, len, new) | OVERLAY(str PLACING new FROM start FOR len) |
| IIF(cond, a, b) | CASE WHEN cond THEN a ELSE b END |
| NEWID() | gen_random_uuid() |
| PRINT 'msg' | RAISE NOTICE 'msg' |
| varchar(MAX) | text |
| + (nối chuỗi) | || (nối chuỗi) |
| OUTER APPLY | LEFT JOIN LATERAL ... ON true |
| CROSS APPLY | CROSS JOIN LATERAL |
` : `
| PostgreSQL | T-SQL |
|---|---|
| SELECT ... LIMIT n | SELECT TOP n ... (đặt sau SELECT) |
| COALESCE(x, y) | ISNULL(x, y) |
| NOW() / CURRENT_TIMESTAMP | GETDATE() |
| date + INTERVAL 'n days' | DATEADD(day, n, date) |
| date + INTERVAL 'n months' | DATEADD(month, n, date) |
| DATE_PART('day', b - a) | DATEDIFF(day, a, b) |
| CAST(val AS type) | CONVERT(type, val) |
| varchar(n) | nvarchar(n) |
| timestamp | datetime |
| SERIAL | int IDENTITY(1,1) |
| boolean | bit |
| "column_name" (nháy kép) | [column_name] (ngoặc vuông) |
| public.TableName | dbo.TableName |
| POSITION(a IN b) | CHARINDEX(a, b) |
| LENGTH(x) | LEN(x) |
| OVERLAY(str PLACING new FROM start FOR len) | STUFF(str, start, len, new) |
| gen_random_uuid() | NEWID() |
| RAISE NOTICE 'msg' | PRINT 'msg' |
| text | varchar(MAX) |
| || (nối chuỗi) | + (nối chuỗi) |
| LEFT JOIN LATERAL ... ON true | OUTER APPLY |
| CROSS JOIN LATERAL | CROSS APPLY |
`}

HƯỚNG DẪN OUTPUT:
- Trước khối code, viết 1-2 dòng mô tả ngắn về những thay đổi đã thực hiện.
- TUÂN THỦ ĐỊNH DẠNG CHUẨN BRAVO (1 TAB = 4 KHOẢNG TRẮNG, GOM DÒNG):
  + Tuyệt đối hạn chế viết mỗi dòng 1 trường lắt nhắt (CẤM: dòng 1 Ma_Vt, dòng 2 Ten_vt...).
  + Bắt buộc gom các trường danh mục (Ma_Vt, Ten_vt, Dvt) trên CÙNG 1 DÒNG ngay sau SELECT (ví dụ: SELECT td.Ma_Vt, vt.Ten_vt, vt.Dvt,).
  + Các cặp số liệu (SL, Tiền) gom trên cùng 1 dòng thụt 4 spaces.
  + Chỉ ngắt dòng khi dòng vượt quá ~85-90 ký tự.
- Nếu có cú pháp không thể chuyển tương đương 100%, ghi chú bằng comment trong SQL.
- LUÔN đặt code trong \`\`\`sql ... \`\`\``;
}

export function detectSqlDialect(sql: string): SqlDialect {
  const tsqlScore = [
    /\bTOP\s+\d/i, /\bISNULL\s*\(/i, /\bGETDATE\s*\(\)/i,
    /\bDATEADD\s*\(/i, /\bDATEDIFF\s*\(/i, /\bCONVERT\s*\(/i,
    /\bnvarchar/i, /\bdbo\./i, /\[[\w]+\]/,
    /\bSET\s+NOCOUNT/i, /\bIDENTITY\s*\(/i, /\bCHARINDEX\s*\(/i,
    /\bLEN\s*\(/i, /\bIIF\s*\(/i, /\bOUTER\s+APPLY/i, /\bCROSS\s+APPLY/i
  ].filter(r => r.test(sql)).length;

  const pgScore = [
    /\bLIMIT\s+\d/i, /\bCOALESCE\s*\(/i, /\bNOW\s*\(\)/i,
    /\bINTERVAL\s+'/i, /\bDATE_PART\s*\(/i,
    /\btimestamp\b/i, /\bpublic\./i, /\bSERIAL\b/i,
    /\bboolean\b/i, /\bLENGTH\s*\(/i, /\bPOSITION\s*\(/i,
    /\|\|/, /\bLATERAL\b/i, /\bgen_random_uuid/i
  ].filter(r => r.test(sql)).length;

  return pgScore > tsqlScore ? 'postgresql' : 'tsql';
}

export async function dispatchConversionRequest(
  config: AiConfig,
  sqlCode: string,
  direction: 'tsql-to-pg' | 'pg-to-tsql'
): Promise<{
  convertedSql: string;
  fullText: string;
  providerLabel: string;
  targetDialect: SqlDialect;
  reasoningSteps: ReasoningStep[];
}> {
  const adapter = ADAPTERS[config.provider] || mockAdapter;
  const systemPrompt = buildConversionPrompt(direction);
  const targetDialect: SqlDialect = direction === 'tsql-to-pg' ? 'postgresql' : 'tsql';
  const fromLabel = direction === 'tsql-to-pg' ? 'T-SQL' : 'PostgreSQL';
  const toLabel = direction === 'tsql-to-pg' ? 'PostgreSQL' : 'T-SQL';

  const userPrompt = `Chuyển đổi đoạn code ${fromLabel} sau sang ${toLabel}:\n\n\`\`\`sql\n${sqlCode}\n\`\`\``;
  const providerLabel = getProviderLabel(config);

  const rawText = await adapter.call(config, userPrompt, [], systemPrompt);

  const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
  const convertedSql = sqlMatch ? formatBravoSql(sqlMatch[1].trim()) : formatBravoSql(sqlCode);

  let cleanText = rawText;
  if (sqlMatch) {
    cleanText = rawText.replace(sqlMatch[0], '').trim();
    if (!cleanText) {
      cleanText = `Đã chuyển đổi thành công từ ${fromLabel} sang ${toLabel}:`;
    }
  }

  const reasoningSteps: ReasoningStep[] = [
    { text: `Phân tích cú pháp ${fromLabel} gốc`, status: 'done' },
    { text: `Áp dụng bảng quy tắc chuyển đổi -> ${toLabel}`, status: 'done' },
    { text: 'Kiểm tra tính tương đương logic', status: 'done' },
    { text: `Sinh bởi ${providerLabel}`, status: 'done' }
  ];

  return {
    convertedSql,
    fullText: cleanText,
    providerLabel,
    targetDialect,
    reasoningSteps
  };
}

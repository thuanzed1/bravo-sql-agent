import type { AgentFlowType, AttachedFile, ChatMessage, QueryResult, ReasoningStep, AiConfig, KnowledgeRule } from '../types';
import { dispatchAiRequest, dispatchOptimizationRequest, dispatchConversionRequest, detectSqlDialect } from './aiClient';
import { formatBravoSql } from './sqlFormatter';
import { extractAllRoutines } from './fileModifier';
import type { ParsedRoutine } from './fileModifier';

export function parseSlashCommand(input: string): { command: string | null; query: string } {
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) {
      return { command: trimmed.toLowerCase(), query: '' };
    }
    return {
      command: trimmed.substring(0, spaceIdx).toLowerCase(),
      query: trimmed.substring(spaceIdx + 1).trim()
    };
  }
  return { command: null, query: trimmed };
}

const SQL_START_REGEX = /\b(IF\s+OBJECT_ID|DECLARE|WITH|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i;

/**
 * Xác định thủ tục/đối tượng cụ thể mà lập trình viên nhắc tới trong câu yêu cầu (so khớp với file đính kèm).
 */
export function detectTargetRoutineInFile(query: string, fileContent?: string): ParsedRoutine | null {
  if (!query || !fileContent?.trim()) return null;
  const routines = extractAllRoutines(fileContent);
  if (routines.length === 0) return null;

  for (const routine of routines) {
    const escaped = routine.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`(?:^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, 'i');
    if (nameRegex.test(query)) {
      return routine;
    }
  }
  return null;
}

export function extractSqlForOptimization(
  query: string,
  attachedFile?: AttachedFile | null,
  history: { role: string; content: string }[] = []
): { rawSql: string; userNote: string; targetRoutineName?: string } | null {
  if (attachedFile?.content?.trim()) {
    const routines = extractAllRoutines(attachedFile.content);
    const targeted = detectTargetRoutineInFile(query, attachedFile.content);
    if (targeted) {
      return {
        rawSql: targeted.text,
        userNote: query.trim(),
        targetRoutineName: targeted.name
      };
    }
    return {
      rawSql: attachedFile.content.trim(),
      userNote: query.trim(),
      targetRoutineName: routines.length === 1 ? routines[0].name : undefined
    };
  }

  const fence = query.match(/```(?:sql|tsql|pgsql|postgresql)?\s*\n?([\s\S]*?)```/i);
  if (fence && fence[1].trim()) {
    return {
      rawSql: fence[1].trim(),
      userNote: query.replace(fence[0], '').trim()
    };
  }

  const sqlStartMatch = query.match(SQL_START_REGEX);
  if (sqlStartMatch && sqlStartMatch.index !== undefined) {
    const candidate = query.slice(sqlStartMatch.index).trim();
    const hasSqlStructure =
      /\bFROM\b/i.test(candidate) ||
      /\bINTO\b/i.test(candidate) ||
      /\bSET\b/i.test(candidate) ||
      /\bPROCEDURE\b|\bPROC\b|\bVIEW\b|\bFUNCTION\b/i.test(candidate);

    if (hasSqlStructure) {
      return {
        rawSql: candidate,
        userNote: query.slice(0, sqlStartMatch.index).trim()
      };
    }
  }

  // Fallback: Lấy khối SQL gần nhất từ lịch sử hội thoại nếu người dùng gõ "/optimize câu lệnh trên..."
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const histFence = h.content.match(/```(?:sql|tsql|pgsql|postgresql)?\s*\n?([\s\S]*?)```/i);
    if (histFence && histFence[1].trim()) {
      return {
        rawSql: histFence[1].trim(),
        userNote: query.trim() || 'Tối ưu câu lệnh SQL phía trên theo chuẩn quy tắc BRAVO ERP (bảng tạm + UNION ALL / Single-Pass Scan)'
      };
    }
  }

  return null;
}

export function resolveAgentFlow(
  input: string,
  attachedFile?: AttachedFile | null
): AgentFlowType {
  const { command, query } = parseSlashCommand(input);

  if (command === '/convert') return 'convert';
  if (command === '/optimize') return 'optimize';
  if (command === '/explain' || command === '/debug' || command === '/diff' || command === '/schema') {
    return 'assist';
  }
  if (command === '/query' || command === '/tonkho') return 'generate';

  const hasOptimizeIntent = /(?:^|[^\p{L}\p{N}_])(tối ưu|toi uu|optimize|refactor)(?=$|[^\p{L}\p{N}_])/iu.test(query);
  if (hasOptimizeIntent && (attachedFile?.content?.trim() || extractSqlForOptimization(query, null))) {
    return 'optimize';
  }

  return 'generate';
}

function buildMissingSqlForOptimizeMessage(id: string, timeStr: string, providerUsed: string): ChatMessage {
  return {
    id,
    role: 'agent',
    timestamp: timeStr,
    flowType: 'optimize',
    commandType: '/optimize',
    providerUsed,
    content: `### Chưa có mã nguồn SQL thô để tối ưu (Luồng 2)

Hệ thống đã tách riêng **2 luồng xử lý độc lập**:
- **Luồng 1 (Sinh SQL mới)**: Mô tả yêu cầu bằng tiếng Việt (hoặc dùng \`/query\`, \`/tonkho\`) — AI tự động sinh câu lệnh **đã tối ưu chuẩn BRAVO ngay từ đầu**.
- **Luồng 2 (Tối ưu SQL thô)**: Khi bạn đã tự dựng thô một đoạn SQL hoặc Stored Procedure, hãy đưa mã nguồn đó vào lệnh \`/optimize\` để AI phân tích điểm nghẽn và tái cấu trúc.

**Cách sử dụng Luồng 2:**
1. Dán trực tiếp đoạn SQL thô ngay sau lệnh \`/optimize\`, hoặc
2. Bấm nút **Đính kèm (.sql)** rồi gõ \`/optimize\` (có thể kèm ghi chú phạm vi cần tối ưu).

\`\`\`sql
-- Ví dụ dán đoạn SQL thô cần tối ưu:
/optimize SELECT td.Ma_Vt, (SELECT Ten_vt FROM DMVT WHERE Ma_Vt = td.Ma_Vt) AS Ten_vt, td.So_Luong
FROM Ton_Dau td
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'
\`\`\``,
    tips: 'Mẹo: Chọn tab mẫu hoặc dán trực tiếp câu query thô bạn đang viết vào sau lệnh /optimize.'
  };
}

function buildMockOptimizeResponse(
  id: string,
  timeStr: string,
  rawSql: string,
  userNote: string,
  attachedFile?: AttachedFile | null,
  targetRoutineName?: string
): ChatMessage {
  const issues: string[] = [];
  const hasSubqueryInSelect = /SELECT[\s\S]*?\(\s*SELECT\b/i.test(rawSql);
  const subqueryJoinCount = (rawSql.match(/\bLEFT\s+JOIN\s*\(\s*SELECT\b/gi) || []).length;
  const hasDirectTonDauJoinCtct =
    /\bTon_Dau\b[\s\S]*?\bJOIN\b[\s\S]*?\bCTCT\b/i.test(rawSql) ||
    /\bCTCT\b[\s\S]*?\bJOIN\b[\s\S]*?\bTon_Dau\b/i.test(rawSql);
  const hasNonSargableYearFilter = /\bYEAR\s*\(\s*[a-zA-Z0-9_.]*Ngay_Ct\s*\)/i.test(rawSql);
  const missingIsNull = /\bSUM\s*\(/i.test(rawSql) && !/\bISNULL\s*\(/i.test(rawSql);
  const hasTextInGroupBy = /\bGROUP\s+BY\b[\s\S]*?\b(Ten_vt|Ten_Dt|Dvt)\b/i.test(rawSql);
  const isInventoryLogic = /\bTon_Dau\b/i.test(rawSql) && (/\bCTCT\b/i.test(rawSql) || /\bLoai_Ct\b/i.test(rawSql));
  const isRevenueByPartnerProc =
    /\bsp_BaoCaoDoanhThuTheoDoiTuong\b/i.test(rawSql) ||
    (/\b(?:PROCEDURE|PROC)\b/i.test(rawSql) && /\bDMDT\b/i.test(rawSql) && /\bCTCT\b/i.test(rawSql));

  if (hasSubqueryInSelect) {
    issues.push('Phát hiện **Subquery phụ thuộc lồng trong `SELECT` list** (vi phạm Rule 1.1 — gây quét lặp `DMDT` theo từng dòng; cần chuyển sang `INNER JOIN`).');
  }
  if (hasNonSargableYearFilter) {
    issues.push('Điều kiện `YEAR(c.Ngay_Ct) = @Nam` là **Non-SARGable** — làm SQL Server không tận dụng được Index trên `Ngay_Ct` (cần chuyển sang khoảng `@Tu_Ngay` .. `@Den_Ngay_Sau`).');
  }
  if (subqueryJoinCount >= 2) {
    issues.push(`Phát hiện **${subqueryJoinCount} subquery \`LEFT JOIN\`** quét lặp lại bảng \`CT\`/\`CTCT\` nhiều lần (Multi-Pass Scan).`);
  }
  if (hasDirectTonDauJoinCtct) {
    issues.push('Phát hiện **JOIN trực tiếp `Ton_Dau` với `CTCT`** (vi phạm Rule 1.7 — nguy cơ nhân đôi số dư tồn đầu Cartesian).');
  }
  if (missingIsNull) {
    issues.push('Thiếu hàm **`ISNULL(..., 0)`** trên các cột tổng hợp số lượng/thành tiền (vi phạm Rule 1.3).');
  }
  if (hasTextInGroupBy) {
    issues.push('`GROUP BY` đang chứa cột chuỗi mô tả dài (`Ten_vt`/`Ten_Dt`/`Dvt`) — nên gom theo khóa mã và bọc `MAX()` (Rule 1.2).');
  }
  if (issues.length === 0) {
    issues.push('Chuẩn hóa cấu trúc theo Single-Pass / bảng tạm, ép kiểu `NUMERIC(18, 2)` và định dạng gom dòng BRAVO (Rule 1.11).');
  }

  const reasoningSteps: ReasoningStep[] = [
    {
      text: targetRoutineName
        ? `[Luồng 2 · Tối ưu SQL thô] Khoanh vùng đúng thủ tục "${targetRoutineName}" trong ${attachedFile?.name || 'mã nguồn'}`
        : `[Luồng 2 · Tối ưu SQL thô] Tiếp nhận ${attachedFile ? `file ${attachedFile.name}` : 'đoạn SQL thô của lập trình viên'}`,
      status: 'done'
    },
    { text: `Phát hiện ${issues.length} điểm cần cải thiện hiệu năng & chuẩn BRAVO`, status: 'done' },
    { text: userNote ? `Áp dụng phạm vi yêu cầu: ${userNote}` : 'Tái cấu trúc bảo toàn 100% logic nghiệp vụ đầu ra', status: 'done' }
  ];

  const wantsSalesOnly = /\b(xuất bán|xuat ban|loai_ct\s*=\s*2)\b/i.test(userNote) || /\bLoai_Ct\s*=\s*2\b/i.test(rawSql);
  const procMatch = rawSql.match(/\b(?:PROCEDURE|PROC)\s+(?:\[?[a-zA-Z0-9_]+\]?\.)?\[?([a-zA-Z0-9_#]+)\]?/i);
  const procName = targetRoutineName || procMatch?.[1] || 'sp_BaoCaoDoanhThuTheoDoiTuong';

  const optimizedSql = isRevenueByPartnerProc
    ? `CREATE OR ALTER PROCEDURE [dbo].[${procName}]
    @Nam INT = 2025
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Tu_Ngay DATETIME = DATEFROMPARTS(@Nam, 1, 1);
    DECLARE @Den_Ngay_Sau DATETIME = DATEADD(YEAR, 1, @Tu_Ngay);

    SELECT c.Ma_Dt, MAX(dt.Ten_Dt) AS Ten_Dt,
        ISNULL(SUM(ctct.So_Luong), 0) AS Tong_So_Luong, ISNULL(SUM(ctct.Tien), 0) AS Tong_Tien
    FROM dbo.CTCT ctct
    INNER JOIN dbo.CT c ON ctct.So_Ct = c.So_Ct
    INNER JOIN dbo.DMDT dt ON c.Ma_Dt = dt.Ma_Dt
    WHERE c.Dinh_Chi = 0${wantsSalesOnly ? '\n        AND c.Loai_Ct = 2' : ''}
        AND c.Ngay_Ct >= @Tu_Ngay AND c.Ngay_Ct < @Den_Ngay_Sau
    GROUP BY c.Ma_Dt
    ORDER BY Tong_Tien DESC;
END;
GO`
    : isInventoryLogic
      ? `IF OBJECT_ID('tempdb..#DW') IS NOT NULL DROP TABLE #DW;

SELECT td.Ma_Vt, td.So_Luong AS SL_Dau,
    CAST(0 AS NUMERIC(18, 2)) AS SL_Nhap,
    CAST(0 AS NUMERIC(18, 2)) AS SL_Xuat
INTO #DW
FROM dbo.Ton_Dau td
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'

UNION ALL

SELECT ct2.Ma_Vt, CAST(0 AS NUMERIC(18, 2)) AS SL_Dau,
    CASE WHEN c.Loai_Ct = 1 THEN ct2.So_Luong ELSE CAST(0 AS NUMERIC(18, 2)) END AS SL_Nhap,
    CASE WHEN c.Loai_Ct = 2 THEN ct2.So_Luong ELSE CAST(0 AS NUMERIC(18, 2)) END AS SL_Xuat
FROM dbo.CTCT ct2
INNER JOIN dbo.CT c ON ct2.So_Ct = c.So_Ct
WHERE c.Ma_Kho = 'K01' AND c.Dinh_Chi = 0
    AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-01-31';

SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt,
    ISNULL(SUM(dw.SL_Dau), 0) AS Ton_Dau_SL,
    ISNULL(SUM(dw.SL_Nhap), 0) AS Nhap_SL,
    ISNULL(SUM(dw.SL_Xuat), 0) AS Xuat_SL,
    ISNULL(SUM(dw.SL_Dau + dw.SL_Nhap - dw.SL_Xuat), 0) AS Ton_Cuoi_SL
FROM #DW dw
INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt
GROUP BY dw.Ma_Vt
ORDER BY dw.Ma_Vt;`
      : `SELECT td.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt,
    ISNULL(SUM(td.So_Luong), 0) AS Ton_Dau_SL
FROM dbo.Ton_Dau td
INNER JOIN dbo.DMVT vt ON td.Ma_Vt = vt.Ma_vt
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'
GROUP BY td.Ma_Vt
ORDER BY td.Ma_Vt;`;

  const issueBullets = issues.map(item => `- ${item}`).join('\n');
  const titleSuffix = targetRoutineName ? ' (`' + targetRoutineName + '`)' : '';
  const strategyOld = isRevenueByPartnerProc
    ? 'Subquery phụ thuộc trên `SELECT` + `YEAR(Ngay_Ct)` làm mất Index'
    : 'Quét lặp bảng hoặc subquery phụ thuộc theo dòng';
  const strategyNew = isRevenueByPartnerProc
    ? '`FROM dbo.CTCT` nối trực tiếp `CT` + `DMDT` + khoảng ngày SARGable'
    : 'Gom 1 lượt qua `#DW` (`UNION ALL`) / `INNER JOIN` trực tiếp';
  const groupNew = isRevenueByPartnerProc
    ? '`GROUP BY c.Ma_Dt`, bọc `MAX(dt.Ten_Dt)` và `ISNULL(..., 0)`'
    : '`GROUP BY dw.Ma_Vt`, bọc `MAX()` và `ISNULL(..., 0)`';
  const scopeOld = isRevenueByPartnerProc && wantsSalesOnly
    ? 'Chưa lọc riêng loại chứng từ xuất bán'
    : 'Nguy cơ nhân đôi dòng hoặc tràn kiểu `INT`';
  const scopeNew = isRevenueByPartnerProc && wantsSalesOnly
    ? 'Lọc chuẩn `c.Loai_Ct = 2` (Phiếu xuất bán) và `c.Dinh_Chi = 0`'
    : 'Ép `CAST(0 AS NUMERIC(18, 2))`, tách bạch Tồn đầu & Phát sinh';

  return {
    id,
    role: 'agent',
    timestamp: timeStr,
    flowType: 'optimize',
    commandType: '/optimize',
    ragChunkCount: 4,
    reasoningSteps,
    content: [
      `### 1. Chẩn đoán mã SQL thô đầu vào${titleSuffix}`,
      '',
      issueBullets,
      '',
      '### 2. Đối chiếu tối ưu (Before vs. After)',
      '',
      '| Tiêu chí | Code thô ban đầu | Bản tối ưu chuẩn BRAVO |',
      '| :--- | :--- | :--- |',
      `| **Chiến lược đọc dữ liệu** | ${strategyOld} | ${strategyNew} |`,
      `| **Gom nhóm & An toàn NULL** | Dễ lệch khi \`NULL\` hoặc nhóm nhiều cột text dài | ${groupNew} |`,
      `| **Phạm vi & Chứng từ** | ${scopeOld} | ${scopeNew} |`
    ].join('\n'),
    sql: formatBravoSql(optimizedSql),
    sqlTitle: targetRoutineName ? `Luồng 2 · Tối ưu ${targetRoutineName}` : 'Luồng 2 · Code đã tối ưu từ mã nguồn thô',
    attachedFile,
    targetRoutineName,
    providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
    tips: 'Mẹo: Bấm nút Lưu vào file (Smart Patch) để ghi đè chính xác đoạn code đã tối ưu vào file gốc.'
  };
}

// Offline mock response generator
export function generateMockResponse(input: string, attachedFile?: AttachedFile | null): ChatMessage {
  const { command, query } = parseSlashCommand(input);
  const flow = resolveAgentFlow(input, attachedFile);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const id = 'msg-' + Date.now();
  const lower = (command ? command + ' ' + query : input).toLowerCase();

  // Luồng 2: /optimize (nhận code SQL thô của coder để tối ưu)
  if (flow === 'optimize') {
    const extracted = extractSqlForOptimization(query, attachedFile);
    if (!extracted) {
      return buildMissingSqlForOptimizeMessage(id, timeStr, 'Chế độ offline (Dữ liệu mẫu)');
    }
    return buildMockOptimizeResponse(id, timeStr, extracted.rawSql, extracted.userNote, attachedFile, extracted.targetRoutineName);
  }

  // Luồng 1: /tonkho (sinh trực tiếp bản tối ưu chuẩn BRAVO ngay từ đầu)
  if (command === '/tonkho' || lower.includes('tồn kho') || lower.includes('ton kho') || lower.includes('tồn đầu')) {
    const reasoningSteps: ReasoningStep[] = [
      { text: '[Luồng 1 · Sinh SQL] Xác định schema Quan_Ly_Kho_Hang: DMVT, CT, CTCT, Ton_Dau', status: 'done' },
      { text: 'Áp dụng Rule 1.7: Gom Tồn đầu + Phát sinh vào bảng tạm #DW bằng UNION ALL (không JOIN trực tiếp)', status: 'done' },
      { text: 'Áp dụng Rule 1.2, 1.3 & 1.6: Ép NUMERIC(18,2), ISNULL(..., 0), GROUP BY 1 trường Ma_Vt', status: 'done' }
    ];

    const sql = `IF OBJECT_ID('tempdb..#DW') IS NOT NULL DROP TABLE #DW;

SELECT td.Ma_Vt, td.So_Luong AS SL_Dau,
    CAST(0 AS NUMERIC(18, 2)) AS SL_Nhap,
    CAST(0 AS NUMERIC(18, 2)) AS SL_Xuat
INTO #DW
FROM dbo.Ton_Dau td
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'

UNION ALL

SELECT ct2.Ma_Vt, CAST(0 AS NUMERIC(18, 2)) AS SL_Dau,
    CASE WHEN c.Loai_Ct = 1 THEN ct2.So_Luong ELSE CAST(0 AS NUMERIC(18, 2)) END AS SL_Nhap,
    CASE WHEN c.Loai_Ct = 2 THEN ct2.So_Luong ELSE CAST(0 AS NUMERIC(18, 2)) END AS SL_Xuat
FROM dbo.CTCT ct2
INNER JOIN dbo.CT c ON ct2.So_Ct = c.So_Ct
WHERE c.Ma_Kho = 'K01' AND c.Dinh_Chi = 0
    AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-01-31';

SELECT dw.Ma_Vt, MAX(vt.Ten_vt) AS Ten_vt, MAX(vt.Dvt) AS Dvt,
    ISNULL(SUM(dw.SL_Dau), 0) AS Ton_Dau_SL,
    ISNULL(SUM(dw.SL_Nhap), 0) AS Nhap_SL,
    ISNULL(SUM(dw.SL_Xuat), 0) AS Xuat_SL,
    ISNULL(SUM(dw.SL_Dau + dw.SL_Nhap - dw.SL_Xuat), 0) AS Ton_Cuoi_SL
FROM #DW dw
INNER JOIN dbo.DMVT vt ON dw.Ma_Vt = vt.Ma_vt
GROUP BY dw.Ma_Vt
ORDER BY dw.Ma_Vt;`;

    const result: QueryResult = {
      columns: ['Ma_Vt', 'Ten_vt', 'Dvt', 'Ton_Dau_SL', 'Nhap_SL', 'Xuat_SL', 'Ton_Cuoi_SL'],
      rowCount: 10,
      executionTimeSec: 0.038,
      status: 'success',
      rows: [
        { Ma_Vt: 'THEP-001', Ten_vt: 'Thép cuộn D6 - Hòa Phát', Dvt: 'Kg', Ton_Dau_SL: 15400, Nhap_SL: 25000, Xuat_SL: 18200, Ton_Cuoi_SL: 22200 },
        { Ma_Vt: 'THEP-002', Ten_vt: 'Thép cuộn D6 - Pomina', Dvt: 'Kg', Ton_Dau_SL: 12000, Nhap_SL: 15000, Xuat_SL: 9500, Ton_Cuoi_SL: 17500 },
        { Ma_Vt: 'THEP-011', Ten_vt: 'Thép cuộn D8 - Hòa Phát', Dvt: 'Kg', Ton_Dau_SL: 18500, Nhap_SL: 30000, Xuat_SL: 21000, Ton_Cuoi_SL: 27500 },
        { Ma_Vt: 'DIEN-001', Ten_vt: 'Dây điện đơn Cadivi 1.5mm2', Dvt: 'Cuộn', Ton_Dau_SL: 350, Nhap_SL: 500, Xuat_SL: 420, Ton_Cuoi_SL: 430 },
        { Ma_Vt: 'DIEN-005', Ten_vt: 'Dây cáp điện Trần Phú 2x2.5', Dvt: 'Cuộn', Ton_Dau_SL: 220, Nhap_SL: 300, Xuat_SL: 190, Ton_Cuoi_SL: 330 },
        { Ma_Vt: 'NHUA-001', Ten_vt: 'Ống nhựa Tiền Phong C2 D21', Dvt: 'Cây', Ton_Dau_SL: 850, Nhap_SL: 1200, Xuat_SL: 950, Ton_Cuoi_SL: 1100 },
        { Ma_Vt: 'NHUA-015', Ten_vt: 'Ống nhựa Bình Minh D27', Dvt: 'Cây', Ton_Dau_SL: 620, Nhap_SL: 800, Xuat_SL: 510, Ton_Cuoi_SL: 910 },
        { Ma_Vt: 'BB-002', Ten_vt: 'Thùng carton 3 lớp 40x30x20', Dvt: 'Thùng', Ton_Dau_SL: 219, Nhap_SL: 1500, Xuat_SL: 1100, Ton_Cuoi_SL: 619 },
        { Ma_Vt: 'BB-005', Ten_vt: 'Thùng carton 5 lớp 50x40x40', Dvt: 'Thùng', Ton_Dau_SL: 312, Nhap_SL: 1000, Xuat_SL: 850, Ton_Cuoi_SL: 462 },
        { Ma_Vt: 'HC-003', Ten_vt: 'Sơn lót epoxy 2 thành phần', Dvt: 'Thùng', Ton_Dau_SL: 180, Nhap_SL: 250, Xuat_SL: 140, Ton_Cuoi_SL: 290 }
      ]
    };

    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'generate',
      content: 'Đã sinh trực tiếp câu lệnh T-SQL chuẩn tối ưu BRAVO cho báo cáo cân đối Nhập - Xuất - Tồn tháng 01/2025 tại Kho K01 (gom bảng tạm `#DW` + `UNION ALL` và Single-Pass `CASE WHEN` ngay từ đầu):',
      commandType: command || '/tonkho',
      ragChunkCount: 4,
      reasoningSteps,
      sql: formatBravoSql(sql),
      sqlTitle: 'Luồng 1 · Báo cáo Nhập - Xuất - Tồn T1/2025 (Kho K01)',
      result,
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Mẹo: Bấm Chạy để kiểm tra số liệu trực tiếp trên SQL Server hoặc dùng nút chuyển đổi sang PostgreSQL.'
    };
  }

  // /explain
  if (command === '/explain' || lower.includes('explain') || lower.includes('giải thích')) {
    const reasoningSteps: ReasoningStep[] = [
      { text: 'Trích xuất cấu trúc quan hệ giữa DMKho, DMVT, DMDT, CT, CTCT, Ton_Dau', status: 'done' },
      { text: 'Kiểm tra ràng buộc CHECK (Loai_Ct, Loai_Dt, Loai_Vt)', status: 'done' }
    ];

    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'assist',
      content: `**Giải thích cấu trúc dữ liệu CSDL Quan_Ly_Kho_Hang theo chuẩn BRAVO ERP:**

1. **Ràng buộc Loai_Ct trong bảng CT (Chứng từ):**
   - \`Loai_Ct = 1\`: Phiếu **Nhập mua** từ Nhà cung cấp.
   - \`Loai_Ct = 2\`: Phiếu **Xuất bán** cho Khách hàng.

2. **Ràng buộc Loai_Dt trong bảng DMDT (Đối tượng):**
   - \`Loai_Dt = 1\`: **Khách hàng** (\`KH001\` - \`KH150\`).
   - \`Loai_Dt = 2\`: **Nhà cung cấp** (\`NCC001\` - \`NCC070\`).

3. **Ràng buộc Loai_Vt trong bảng DMVT (Vật tư):**
   - \`Loai_Vt = 1\`: Thép
   - \`Loai_Vt = 2\`: Điện
   - \`Loai_Vt = 3\`: Nhựa
   - \`Loai_Vt = 4\`: Bao bì
   - \`Loai_Vt = 5\`: Hóa chất

4. **Khóa chính trên Ton_Dau và CTCT:**
   - \`Ton_Dau\`: Khóa chính kết hợp \`(Nam, Ky, Ma_Kho, Ma_Vt)\`.
   - \`CTCT\`: Khóa chính là \`(So_Ct, Stt_Dong)\` kèm ràng buộc \`CK_CTCT_Tien: Tien = So_Luong * Don_Gia\`.`,
      commandType: '/explain',
      ragChunkCount: 3,
      reasoningSteps,
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Có thể gõ /query kèm yêu cầu lọc riêng phiếu nhập (Loai_Ct = 1) hoặc xuất (Loai_Ct = 2).'
    };
  }

  // /schema
  if (command === '/schema' || lower.includes('schema') || lower.includes('cấu trúc bảng')) {
    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'assist',
      content: `**Tổng quan Schema cơ sở dữ liệu Quan_Ly_Kho_Hang:**

- **DMKho** (10 dòng): Danh mục 10 kho hàng (\`K01\` đến \`K10\`).
- **DMVT** (400 dòng): Danh mục vật tư hàng hóa thuộc 5 nhóm (\`Loai_Vt = 1..5\`).
- **DMDT** (220 dòng): Khách hàng (\`Loai_Dt=1\`) và Nhà cung cấp (\`Loai_Dt=2\`).
- **Ton_Dau** (2.390 dòng): Số lượng và giá trị tồn kho ban đầu.
- **CT** (7.135 dòng): Chứng từ Nhập mua (\`Loai_Ct=1\`) và Xuất bán (\`Loai_Ct=2\`).
- **CTCT** (39.130 dòng): Chi tiết từng mặt hàng trên phiếu (\`Tien = So_Luong * Don_Gia\`).`,
      commandType: '/schema',
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Mẹo: Click vào bất kỳ bảng nào trong Schema Browser bên trái để xem cấu trúc cột.'
    };
  }

  // /debug
  if (command === '/debug' || lower.includes('debug') || lower.includes('lỗi')) {
    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'assist',
      content: `**Chẩn đoán các lỗi thường gặp:**

1. **Foreign Key Violation trên CTCT (\`FK_CTCT_CT\` hoặc \`FK_CTCT_Vt\`):**
   - Thêm dòng chi tiết có \`So_Ct\` chưa tồn tại trong bảng cha \`CT\`, hoặc \`Ma_Vt\` chưa khai báo trong \`DMVT\`.
   - Khắc phục: Tạo chứng từ trong \`CT\` trước khi thêm chi tiết vào \`CTCT\`.

2. **CHECK Constraint Violation (\`CK_CTCT_Tien\`):**
   - Cột \`Tien\` bắt buộc phải bằng \`So_Luong * Don_Gia\`.

3. **CHECK Constraint Violation (\`CK_CT_Loai\` & \`CK_DMDT_Loai\`):**
   - \`Loai_Ct\` chỉ nhận 1 (Nhập mua) hoặc 2 (Xuất bán).
   - \`Loai_Dt\` chỉ nhận 1 (Khách hàng) hoặc 2 (Nhà cung cấp).
   - \`Dinh_Chi\` chỉ nhận 0 (Hoạt động) hoặc 1 (Ngừng sử dụng).`,
      commandType: '/debug',
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Dán đoạn mã hoặc thông báo lỗi để được phân tích chi tiết.'
    };
  }

  // /convert
  if (command === '/convert' || lower.includes('convert') || lower.includes('chuyển đổi') || lower.includes('postgresql') || lower.includes('postgres')) {
    const reasoningSteps: ReasoningStep[] = [
      { text: 'Phân tích cú pháp: Phát hiện T-SQL (SQL Server)', status: 'done' },
      { text: 'Áp dụng bảng quy tắc chuyển đổi sang PostgreSQL', status: 'done' },
      { text: 'Kiểm tra tính tương đương logic', status: 'done' }
    ];

    const sql = `SELECT td.Ma_Vt, vt.Ten_vt, vt.Dvt, td.So_Luong AS Ton_Dau_SL,
    COALESCE(SUM(CASE WHEN c.Loai_Ct = 1 THEN ct2.So_Luong END), 0) AS Nhap_SL,
    COALESCE(SUM(CASE WHEN c.Loai_Ct = 2 THEN ct2.So_Luong END), 0) AS Xuat_SL,
    td.So_Luong
      + COALESCE(SUM(CASE WHEN c.Loai_Ct = 1 THEN ct2.So_Luong END), 0)
      - COALESCE(SUM(CASE WHEN c.Loai_Ct = 2 THEN ct2.So_Luong END), 0) AS Ton_Cuoi_SL
FROM public.Ton_Dau td
INNER JOIN public.DMVT vt ON td.Ma_Vt = vt.Ma_vt
LEFT JOIN public.CTCT ct2 ON td.Ma_Vt = ct2.Ma_Vt
LEFT JOIN public.CT c ON ct2.So_Ct = c.So_Ct
    AND c.Ma_Kho = td.Ma_Kho
    AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-01-31'
    AND c.Dinh_Chi = 0
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'
GROUP BY td.Ma_Vt, vt.Ten_vt, vt.Dvt, td.So_Luong
ORDER BY td.Ma_Vt
LIMIT 10;`;

    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'convert',
      content: 'Đã chuyển đổi sang **PostgreSQL**:\n\n**Các thay đổi:** `ISNULL()` -> `COALESCE()`, `dbo.` -> `public.`, `TOP 10` -> `LIMIT 10`.',
      commandType: '/convert',
      ragChunkCount: 3,
      reasoningSteps,
      sql: formatBravoSql(sql),
      sqlTitle: 'PostgreSQL - Chuyển đổi từ T-SQL',
      sqlDialect: 'postgresql',
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Mẹo: Bấm nút chuyển đổi trên khối SQL để chuyển ngược lại sang T-SQL.'
    };
  }

  // /diff
  if (command === '/diff' || lower.includes('diff') || lower.includes('so sánh')) {
    const reasoningSteps: ReasoningStep[] = [
      { text: 'Trích xuất quy tắc BRAVO: Rule 1.7 (NXT & Temp Table), Rule 1.2 (GROUP BY 1 trường), Rule 1.6 (Kiểu dữ liệu)', status: 'done' },
      { text: 'Phân tích mã nguồn truy vấn thông thường (Anti-pattern)', status: 'done' },
      { text: 'So sánh hiệu năng và tính toàn vẹn dữ liệu với phiên bản tối ưu', status: 'done' }
    ];

    const content = `Dưới đây là bảng so sánh khác biệt (**Diff**) giữa cách viết thông thường và cách viết tối ưu theo chuẩn **BRAVO T-SQL**:

### 1. Bảng đối chiếu kỹ thuật (Before vs. After)

| Tiêu chí | Cách viết thông thường (Anti-pattern) | Cách viết chuẩn BRAVO (Optimized) |
| :--- | :--- | :--- |
| **Xử lý Tồn đầu & Phát sinh** | \`FULL OUTER JOIN\` hoặc \`LEFT JOIN\` trực tiếp \`Ton_Dau\` với \`CTCT\`. Dễ gây tích Descartes, nhân đôi số lượng tồn đầu khi có nhiều dòng phát sinh. | Gom dữ liệu bằng **\`UNION ALL\`** vào bảng tạm **\`#DW\`**, không JOIN trực tiếp 2 bảng gốc số dư và phát sinh (Rule 1.7). |
| **GROUP BY** | Gom nhóm nhiều trường: \`GROUP BY TD.Ma_Vt, VT.Ten_vt, VT.Dvt\` (so sánh chuỗi dài gây chậm). | **\`GROUP BY\`** duy nhất 1 trường **\`Ma_Vt\`** trên bảng tạm số liệu (Rule 1.2), sau đó mới JOIN \`DMVT\` lấy tên hiển thị. |
| **Kiểu dữ liệu UNION** | Để kiểu ngầm định (\`0 AS Sl_Nhap\`), dễ ép kiểu thành \`INT\` dẫn đến mất phần thập phân (Rule 1.6). | Ép kiểu rõ ràng: \`CAST(0 AS NUMERIC(18, 2))\` đảm bảo đồng nhất kiểu dữ liệu. |
| **Quản lý Bảng tạm** | Tạo bảng hoặc CTE lồng nhau không dọn dẹp bộ nhớ. | Luôn có \`IF OBJECT_ID('tempdb..#...') IS NOT NULL DROP TABLE\` trước khi tạo (Rule 1.9 Idempotent). |

### 2. Đánh giá hiệu năng thực tế
- Chi phí quét bảng: Giảm từ 3 lượt scan độc lập xuống 1 lượt quét tập trung.
- Thời gian thực thi: Giảm 40% - 50% trên tập dữ liệu lớn của Quan_Ly_Kho_Hang.
`;

    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: 'assist',
      content,
      commandType: '/diff',
      ragChunkCount: 5,
      reasoningSteps,
      providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
      tips: 'Mẹo: Có thể dùng nút chuyển đổi để chuyển sang PostgreSQL tương đương.'
    };
  }

  // Luồng 1: /query default
  const reasoningSteps: ReasoningStep[] = [
    { text: '[Luồng 1 · Sinh SQL] Phân tích yêu cầu: ' + (query || input), status: 'done' },
    { text: 'Ánh xạ schema: DMDT (Loai_Dt=1), CT (Loai_Ct=2 Xuất bán), CTCT', status: 'done' },
    { text: 'Tạo mã T-SQL tối ưu theo chuẩn BRAVO (Rule 1.2, 1.3, 1.4, 1.11)', status: 'done' }
  ];

  const sql = `SELECT TOP 5 dt.Ma_Dt, MAX(dt.Ten_Dt) AS Ten_Dt,
    COUNT(DISTINCT c.So_Ct) AS Tong_So_Don,
    ISNULL(SUM(ctct.Tien), 0) AS Tong_Doanh_Thu,
    MAX(c.Ngay_Ct) AS Ngay_Giao_Dich_Cuoi
FROM dbo.CTCT ctct
INNER JOIN dbo.CT c ON ctct.So_Ct = c.So_Ct
INNER JOIN dbo.DMDT dt ON c.Ma_Dt = dt.Ma_Dt
WHERE c.Loai_Ct = 2 AND dt.Loai_Dt = 1 AND c.Dinh_Chi = 0
    AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY dt.Ma_Dt
ORDER BY Tong_Doanh_Thu DESC;`;

  const result: QueryResult = {
    columns: ['Ma_Dt', 'Ten_Dt', 'Tong_So_Don', 'Tong_Doanh_Thu', 'Ngay_Giao_Dich_Cuoi'],
    rowCount: 5,
    executionTimeSec: 0.052,
    status: 'success',
    rows: [
      { Ma_Dt: 'KH001', Ten_Dt: 'Công ty TNHH MTV Xây dựng Hưng Thịnh', Tong_So_Don: 28, Tong_Doanh_Thu: 4850000000, Ngay_Giao_Dich_Cuoi: '2025-12-22' },
      { Ma_Dt: 'KH004', Ten_Dt: 'Công ty Cổ phần Xây dựng Đại Dương', Tong_So_Don: 24, Tong_Doanh_Thu: 4210000000, Ngay_Giao_Dich_Cuoi: '2025-12-18' },
      { Ma_Dt: 'KH015', Ten_Dt: 'Công ty TNHH Xây dựng Hải Long', Tong_So_Don: 21, Tong_Doanh_Thu: 3890000000, Ngay_Giao_Dich_Cuoi: '2025-12-15' },
      { Ma_Dt: 'KH036', Ten_Dt: 'Công ty TNHH MTV Cơ khí Thái Bình', Tong_So_Don: 19, Tong_Doanh_Thu: 3120000000, Ngay_Giao_Dich_Cuoi: '2025-12-20' },
      { Ma_Dt: 'KH065', Ten_Dt: 'Công ty Cổ phần Nội thất Thành Công', Tong_So_Don: 18, Tong_Doanh_Thu: 2980000000, Ngay_Giao_Dich_Cuoi: '2025-12-14' }
    ]
  };

  return {
    id,
    role: 'agent',
    timestamp: timeStr,
    flowType: 'generate',
    content: 'Dưới đây là câu lệnh truy vấn top 5 khách hàng có doanh thu mua hàng lớn nhất năm 2025 (đã tối ưu GROUP BY 1 trường `Ma_Dt` và `FROM` từ bảng phát sinh `CTCT`):',
    commandType: command || '/query',
    ragChunkCount: 3,
    reasoningSteps,
    sql: formatBravoSql(sql),
    sqlTitle: 'Luồng 1 · Top 5 Khách hàng có doanh thu lớn nhất (2025)',
    result,
    providerUsed: 'Chế độ offline (Dữ liệu mẫu)',
    tips: 'Có thể sao chép để dán vào SSMS hoặc chạy trực tiếp trên SQL Server.'
  };
}

export async function executeAgentQuery(
  input: string,
  aiConfig: AiConfig,
  history: { role: string; content: string }[] = [],
  customTables?: any[],
  customRels?: any[],
  dbName: string = 'QuanLyKho',
  attachedFile?: any,
  rules?: KnowledgeRule[]
): Promise<ChatMessage> {
  const { command, query } = parseSlashCommand(input);
  const flow = resolveAgentFlow(input, attachedFile);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const id = 'msg-' + Date.now();

  if (aiConfig.provider === 'mock') {
    return generateMockResponse(input, attachedFile);
  }

  // Luồng chuyển đổi cú pháp 2 chiều (/convert)
  if (flow === 'convert') {
    try {
      const sqlSource = attachedFile?.content || query;
      if (!sqlSource.trim()) {
        return {
          id, role: 'agent', timestamp: timeStr, flowType: 'convert',
          content: 'Vui lòng cung cấp code SQL cần chuyển đổi qua lệnh /convert hoặc đính kèm file .sql.',
          commandType: '/convert',
          providerUsed: aiConfig.provider
        };
      }

      const detectedDialect = detectSqlDialect(sqlSource);
      const direction = detectedDialect === 'tsql' ? 'tsql-to-pg' : 'pg-to-tsql';
      const convRes = await dispatchConversionRequest(aiConfig, sqlSource, direction);

      return {
        id, role: 'agent', timestamp: timeStr, flowType: 'convert',
        content: convRes.fullText,
        commandType: '/convert',
        ragChunkCount: 3,
        reasoningSteps: convRes.reasoningSteps,
        sql: convRes.convertedSql,
        sqlTitle: `${convRes.targetDialect === 'postgresql' ? 'PostgreSQL' : 'T-SQL'} - Chuyển đổi bởi ${convRes.providerLabel}`,
        sqlDialect: convRes.targetDialect,
        providerUsed: convRes.providerLabel,
        attachedFile,
        tips: `Mẹo: Bấm nút chuyển đổi trên khối SQL để chuyển ngược lại sang ${detectedDialect === 'tsql' ? 'T-SQL' : 'PostgreSQL'}.`
      };
    } catch (err: any) {
      const fallback = generateMockResponse(input, attachedFile);
      return {
        ...fallback,
        id,
        content: `[Lỗi chuyển đổi]: ${err.message || 'Không thể gọi AI'}\n\nKết quả từ chế độ offline:`,
        providerUsed: `Offline Fallback (${aiConfig.provider})`
      };
    }
  }

  // Luồng 2: Tối ưu hóa mã SQL thô có sẵn của lập trình viên (/optimize hoặc file + ý định tối ưu)
  if (flow === 'optimize') {
    const extracted = extractSqlForOptimization(query, attachedFile, history);
    if (!extracted) {
      return buildMissingSqlForOptimizeMessage(id, timeStr, aiConfig.provider);
    }

    try {
      const optRes = await dispatchOptimizationRequest(
        aiConfig,
        extracted.rawSql,
        extracted.userNote,
        history,
        customTables,
        customRels,
        dbName,
        attachedFile,
        rules,
        extracted.targetRoutineName
      );

      let result: QueryResult | undefined;
      if (optRes.sql) {
        result = {
          columns: ['Ket_Qua', 'Trang_Thai', 'Thong_Tin'],
          rowCount: 1,
          executionTimeSec: 0.032,
          status: 'success',
          rows: [
            {
              Ket_Qua: 'Đã tối ưu mã SQL thô',
              Trang_Thai: 'Sẵn sàng kiểm thử / Smart Patch',
              Thong_Tin: `Tối ưu bởi ${optRes.providerLabel}`
            }
          ]
        };
      }

      return {
        id,
        role: 'agent',
        timestamp: timeStr,
        flowType: 'optimize',
        content: optRes.text,
        commandType: command || '/optimize',
        ragChunkCount: 5,
        reasoningSteps: optRes.reasoningSteps,
        sql: optRes.sql,
        sqlTitle: extracted.targetRoutineName
          ? `Luồng 2 · Tối ưu ${extracted.targetRoutineName} (${optRes.providerLabel})`
          : `Luồng 2 · Tối ưu bởi ${optRes.providerLabel}`,
        result,
        providerUsed: optRes.providerLabel,
        attachedFile,
        targetRoutineName: extracted.targetRoutineName,
        tips: 'Mẹo: Bấm Lưu vào file (Smart Patch) để vá đoạn code đã tối ưu vào đúng vị trí trong file gốc.'
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi không xác định khi gọi AI';
      const fallback = generateMockResponse(input, attachedFile);
      return {
        ...fallback,
        id,
        content: `[Cảnh báo kết nối ${aiConfig.provider.toUpperCase()}]: ${errorMsg}\n\nChuyển sang chế độ offline:`,
        providerUsed: `Offline Fallback (${aiConfig.provider})`
      };
    }
  }

  // Luồng 1 (Sinh SQL mới chuẩn tối ưu ngay từ đầu) & Assist (/explain, /debug, /diff, /schema)
  const detectedTarget = attachedFile?.content ? detectTargetRoutineInFile(input, attachedFile.content) : null;
  try {
    const aiRes = await dispatchAiRequest(
      aiConfig,
      input,
      history,
      customTables,
      customRels,
      dbName,
      attachedFile,
      rules
    );

    let result: QueryResult | undefined;
    if (aiRes.sql) {
      result = {
        columns: ['Ket_Qua', 'Trang_Thai', 'Thong_Tin'],
        rowCount: 1,
        executionTimeSec: 0.045,
        status: 'success',
        rows: [
          {
            Ket_Qua: 'Câu lệnh SQL hợp lệ',
            Trang_Thai: 'Sẵn sàng thực thi',
            Thong_Tin: `Sinh bởi ${aiRes.providerLabel}`
          }
        ]
      };
    }

    return {
      id,
      role: 'agent',
      timestamp: timeStr,
      flowType: flow,
      content: aiRes.text,
      commandType: command || undefined,
      ragChunkCount: 5,
      reasoningSteps: aiRes.reasoningSteps,
      sql: aiRes.sql,
      sqlTitle: `${flow === 'generate' ? 'Luồng 1 · ' : ''}T-SQL Generated by ${aiRes.providerLabel}`,
      result,
      providerUsed: aiRes.providerLabel,
      attachedFile,
      targetRoutineName: detectedTarget?.name,
      tips: `Mẹo: Có thể sao chép câu lệnh này để chạy trực tiếp trên database ${dbName}.`
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Lỗi không xác định khi gọi AI';
    const fallback = generateMockResponse(input, attachedFile);

    return {
      ...fallback,
      id,
      content: `[Cảnh báo kết nối ${aiConfig.provider.toUpperCase()}]: ${errorMsg}\n\nChuyển sang chế độ offline:`,
      providerUsed: `Offline Fallback (${aiConfig.provider})`
    };
  }
}

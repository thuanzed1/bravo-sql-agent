/**
 * BRAVO SQL Agent — Bộ Hậu Xử Lý Định Dạng SQL (Post-processor Formatter)
 * Chuẩn hóa 100% theo QUY TẮC THỤT LỀ & GOM DÒNG BRAVO (1 tab = 4 khoảng trắng)
 * 
 * - GOM DÒNG (BẮT BUỘC): Hạn chế mỗi dòng chỉ có 1 trường lắt nhắt.
 *   + Danh mục (Ma_Vt, Ten_vt, Dvt...) viết liên tiếp trên CÙNG 1 DÒNG ngay sau SELECT.
 *   + Cặp số liệu (SL, Tiền) theo từng kỳ viết trên cùng 1 dòng.
 *   + Dòng tiếp theo chỉ ngắt khi vượt quá ~85-90 ký tự.
 * - CẤP 0 (Sát lề): DECLARE, SELECT, INTO, FROM, WHERE, GROUP BY, HAVING, ORDER BY,
 *                  UNION ALL, INSERT INTO, UPDATE, SET, DELETE, WITH, IF, DROP, comment "--"
 * - CẤP 1 (Thụt 4 spaces): Cột SELECT (khi xuống dòng), biến DECLARE, JOIN, AND/OR trong WHERE
 * - CẤP 2+ (Mỗi cấp con +4 spaces): Subquery trong ngoặc, điều kiện lồng ON...
 */

const LEVEL_0_KEYWORDS = [
  'SELECT', 'INTO', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY',
  'UNION ALL', 'UNION', 'INSERT INTO', 'INSERT', 'UPDATE', 'SET', 'DELETE',
  'DECLARE', 'WITH', 'IF', 'DROP', 'GO', 'BEGIN', 'END',
  'CREATE', 'ALTER', 'AS', 'USE', 'EXEC', 'EXECUTE'
];

/**
 * Rút gọn khoảng trắng thừa liên tiếp ngoài chuỗi ký tự '...'
 */
function normalizeSpaces(line: string): string {
  if (!line.includes("'")) {
    return line.replace(/[ \t]{2,}/g, ' ');
  }
  let result = '';
  let inString = false;
  let prevSpace = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'") {
      inString = !inString;
      result += ch;
      prevSpace = false;
    } else if (inString) {
      result += ch;
    } else {
      if (ch === ' ' || ch === '\t') {
        if (!prevSpace) {
          result += ' ';
          prevSpace = true;
        }
      } else {
        result += ch;
        prevSpace = false;
      }
    }
  }
  return result;
}

/**
 * Gom dòng thông minh các trường trong SELECT list và GROUP BY / ORDER BY:
 * Loại bỏ triệt để anti-pattern ngắt mỗi dòng 1 trường (Ma_Vt xuống dòng Ten_vt...).
 */
function packBravoColumns(rawSql: string): string {
  const lines = rawSql.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      result.push(rawLine);
      continue;
    }

    const upper = trimmed.toUpperCase();

    // 1. Kéo trường đầu tiên lên cùng dòng với SELECT / SELECT DISTINCT nếu SELECT đứng đơn độc
    if (upper === 'SELECT' || upper === 'SELECT DISTINCT') {
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        const nextUpper = nextTrimmed.toUpperCase();
        if (
          nextTrimmed &&
          !nextTrimmed.startsWith('--') &&
          !nextTrimmed.startsWith('/*') &&
          !nextTrimmed.startsWith('(') &&
          !nextUpper.startsWith('CASE')
        ) {
          result.push(trimmed + ' ' + normalizeSpaces(nextTrimmed));
          i++;
          continue;
        }
      }
      result.push(trimmed);
      continue;
    }

    // 2. Kéo trường đầu tiên lên cùng dòng với GROUP BY / ORDER BY nếu đứng đơn độc
    if (upper === 'GROUP BY' || upper === 'ORDER BY') {
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        if (nextTrimmed && !nextTrimmed.startsWith('--') && !nextTrimmed.startsWith('/*')) {
          result.push(trimmed + ' ' + normalizeSpaces(nextTrimmed));
          i++;
          continue;
        }
      }
      result.push(trimmed);
      continue;
    }

    // 3. Gom dòng các trường kế tiếp nếu cùng nhóm ngữ nghĩa
    if (result.length > 0) {
      const prevIdx = result.length - 1;
      const prevLine = result[prevIdx];
      const prevTrimmed = prevLine.trim();

      const isClauseBoundary = (s: string) =>
        /^(FROM|INTO|WHERE|GROUP BY|HAVING|ORDER BY|UNION|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|OUTER APPLY|CROSS APPLY)\b/i.test(s);

      const isComplex = (s: string) =>
        /\bCASE\b/i.test(s) || (s.includes('(') && !s.includes(')')) || s.startsWith('--') || s.startsWith('/*');

      if (
        prevTrimmed.endsWith(',') &&
        !isClauseBoundary(trimmed) &&
        !isComplex(prevTrimmed) &&
        !isComplex(trimmed) &&
        !trimmed.startsWith('@') &&
        !/^(DECLARE|SET|BEGIN|END|IF|WHILE|RETURN|AS)\b/i.test(trimmed)
      ) {
        const cleanTrimmed = normalizeSpaces(trimmed);
        const isDim = (s: string) => /(Ma_|Ten_|Dvt|Loai_|Nam|Ky|Ngay_|So_Ct|STT)/i.test(s);
        const isMeasure = (s: string) => /(SL_|Tien_|So_Luong|Tien|Tong_)/i.test(s);

        const prevIsDim = isDim(prevTrimmed);
        const curIsDim = isDim(cleanTrimmed);
        const prevIsMeasure = isMeasure(prevTrimmed);
        const curIsMeasure = isMeasure(cleanTrimmed);

        // Không gộp lẫn giữa trường danh mục và trường số liệu (giữ tách dòng rõ ràng giữa Dimension và Measure)
        const crossesDimMeasureBoundary = (prevIsDim && curIsMeasure) || (prevIsMeasure && curIsDim);

        // Không gộp lẫn các kỳ khác nhau (Tồn đầu không gom chung dòng với Nhập/Xuất)
        const crossesPeriodBoundary =
          (/_Dau\b/i.test(prevTrimmed) && !/_Dau\b/i.test(cleanTrimmed)) ||
          (/_Nhap\b/i.test(prevTrimmed) && !/_Nhap\b/i.test(cleanTrimmed)) ||
          (/_Xuat\b/i.test(prevTrimmed) && !/_Xuat\b/i.test(cleanTrimmed));

        const combinedCandidate = prevTrimmed + ' ' + cleanTrimmed;
        const isShortItem = prevTrimmed.length < 35 && cleanTrimmed.length < 35;
        const prevIsSelect = /^SELECT\b/i.test(prevTrimmed);

        const shouldMerge =
          combinedCandidate.length <= 85 &&
          !crossesDimMeasureBoundary &&
          !crossesPeriodBoundary &&
          (isShortItem || (prevIsSelect && curIsDim));

        if (shouldMerge) {
          const leadingSpaces = prevLine.match(/^\s*/)?.[0] ?? '';
          result[prevIdx] = leadingSpaces + combinedCandidate;
          continue;
        }
      }
    }

    result.push(normalizeSpaces(rawLine));
  }

  return result.join('\n');
}

/**
 * Tự động phát hiện và sửa các lỗi cú pháp / runtime T-SQL kinh điển do LLM sinh ra:
 * 1. Msg 104: ORDER BY items must appear in the select list if the statement contains a UNION, INTERSECT or EXCEPT operator.
 * 2. Msg 207: Gọi nhầm cột của bảng chứng từ cha (CT: Dinh_Chi, Ngay_Ct, Loai_Ct, Ma_Kho) trên alias của bảng chi tiết (CTCT).
 */
export function sanitizeTsqlSyntax(rawSql: string): string {
  if (!rawSql || !rawSql.trim()) return rawSql;
  let sql = rawSql;

  // 1. Chống lỗi Msg 207: Sửa nhầm alias bảng CTCT gọi cột chỉ có trên bảng CT (Dinh_Chi, Ngay_Ct, Loai_Ct, Ma_Kho, Ma_Dt)
  const ctctAliases = new Set<string>();
  const ctAliases = new Set<string>();

  const ctctRegex = /\b(?:FROM|JOIN)\s+(?:dbo\.)?CTCT\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
  const ctRegex = /\b(?:FROM|JOIN)\s+(?:dbo\.)?CT\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
  const reservedWords = new Set(['ON', 'WHERE', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'GROUP', 'ORDER', 'UNION', 'SET', 'VALUES']);

  let m: RegExpExecArray | null;
  while ((m = ctctRegex.exec(sql)) !== null) {
    const alias = m[1];
    if (!reservedWords.has(alias.toUpperCase())) ctctAliases.add(alias);
  }
  while ((m = ctRegex.exec(sql)) !== null) {
    const alias = m[1];
    if (!reservedWords.has(alias.toUpperCase())) ctAliases.add(alias);
  }

  const primaryCtAlias = ctAliases.values().next().value;
  if (primaryCtAlias && ctctAliases.size > 0) {
    for (const ctctAlias of ctctAliases) {
      if (ctctAlias.toLowerCase() !== primaryCtAlias.toLowerCase()) {
        const headerOnlyCols = ['Dinh_Chi', 'Ngay_Ct', 'Loai_Ct', 'Ma_Kho', 'Ma_Dt', 'Dien_Giai'];
        for (const col of headerOnlyCols) {
          const wrongRefRegex = new RegExp(`\\b${ctctAlias}\\.${col}\\b`, 'gi');
          sql = sql.replace(wrongRefRegex, `${primaryCtAlias}.${col}`);
        }
      }
    }
  }

  // 2. Chống lỗi Msg 8120: Tự động bọc MAX() cho các cột danh mục (Ten_vt, Dvt, Ten_Dt, Ten_Kho...)
  // trong SELECT khi câu lệnh có GROUP BY 1 trường Mã mà AI quên bọc MAX(), đồng thời đồng bộ alias cột GROUP BY
  sql = fixGroupByMsg8120(sql);

  // 3. Chống lỗi Msg 104: Xử lý các khối câu lệnh có UNION / UNION ALL đi kèm ORDER BY
  sql = fixUnionOrderByMsg104(sql);

  // 4. Chống lỗi Msg 207 trên ORDER BY: Nếu ORDER BY gọi cột cờ (Cuoi, STT, Cap) nhưng cột đó chưa từng được khai báo/SELECT ở bất kỳ đâu trước đó
  for (const flagCol of ['Cuoi', 'STT', 'Cap']) {
    const orderByFlagRegex = new RegExp(`(\\bORDER\\s+BY\\s+)${flagCol}\\s*,\\s*`, 'gi');
    if (orderByFlagRegex.test(sql)) {
      const sqlWithoutOrderBy = sql.replace(/\bORDER\s+BY\s+[^\r\n;]+/gi, '');
      const colDefinedRegex = new RegExp(`\\b${flagCol}\\b`, 'i');
      if (!colDefinedRegex.test(sqlWithoutOrderBy)) {
        sql = sql.replace(orderByFlagRegex, '$1');
      }
    }
  }

  return sql;
}

/**
 * Tách danh sách biểu thức phân cách bởi dấu phẩy ở cấp ngoặc ngoài cùng (depth = 0)
 */
function splitTopLevelCommaList(listStr: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < listStr.length; i++) {
    const ch = listStr[i];
    if (ch === "'") {
      inString = !inString;
      current += ch;
    } else if (!inString) {
      if (ch === '(') {
        depth++;
        current += ch;
      } else if (ch === ')') {
        depth = Math.max(0, depth - 1);
        current += ch;
      } else if (ch === ',' && depth === 0) {
        items.push(current);
        current = '';
      } else {
        current += ch;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    items.push(current);
  }
  return items;
}

/**
 * Tự động sửa lỗi kinh điển Msg 8120:
 * "Column 'dbo.DMVT.Ten_vt' is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause."
 * Khi câu lệnh có GROUP BY (theo Quy tắc 1.2 chỉ GROUP BY 1 trường Mã như Ma_Vt, Ma_Dt, Ma_Kho),
 * mọi cột mô tả đi kèm trong SELECT (Ten_vt, Dvt, Ten_Dt, Ten_Kho...) nếu chưa bọc hàm tổng hợp sẽ được tự động bọc MAX(...) AS <Tên_Cột>.
 */
function fixGroupByMsg8120(sql: string): string {
  const statements = splitIntoTopLevelStatements(sql);
  return statements.map(stmt => {
    if (!/\bGROUP\s+BY\b/i.test(stmt) || /\bUNION\b/i.test(stmt)) {
      return stmt;
    }
    return fixSingleSelectGroupBy(stmt);
  }).join('\n');
}

function fixSingleSelectGroupBy(stmt: string): string {
  // Khớp cấu trúc: [Tiền tố] SELECT [DISTINCT | TOP n] <selectList> [INTO #Table] FROM <fromAndWhere> GROUP BY <groupByList> [Phần đuôi]
  const match = stmt.match(/^([\s\S]*?\bSELECT\s+(?:DISTINCT\s+|TOP\s+\d+\s+)?)([\s\S]*?)(\s*\bINTO\s+#[a-zA-Z0-9_]+\s+|\s+)(\bFROM\b[\s\S]*?\bGROUP\s+BY\s+)([^\r\n;]+?)((?:\s*\bHAVING\b[\s\S]*?|\s*\bORDER\s+BY\b[\s\S]*?|;?\s*|--.*)?)$/i);
  if (!match) return stmt;

  const selectPrefix = match[1];
  const selectListRaw = match[2];
  const intoOrSpace = match[3];
  const fromToGroupBy = match[4];
  const groupByListRaw = match[5].trim();
  const tailPart = match[6] || '';

  // Nếu trong phần FROM có chứa subquery cũng có GROUP BY thì tránh can thiệp nhầm cấp
  if (/\bSELECT\b/i.test(selectListRaw)) {
    return stmt;
  }

  // Phân tích danh sách cột trong GROUP BY
  const groupByItems = splitTopLevelCommaList(groupByListRaw).map(s => s.trim()).filter(Boolean);
  const groupedColsMap = new Map<string, string>(); // bareColLower -> fullGroupByExpr (VD: 'ma_vt' -> 'vt.Ma_vt')

  for (const gItem of groupByItems) {
    const cleanG = gItem.replace(/--.*$/, '').trim();
    const gMatch = cleanG.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?)$/);
    if (gMatch) {
      const bare = gMatch[2].replace(/^\[|\]$/g, '').toLowerCase();
      groupedColsMap.set(bare, cleanG);
    }
  }

  if (groupedColsMap.size === 0) return stmt;

  const selectItems = splitTopLevelCommaList(selectListRaw);
  let hasModified = false;

  const fixedSelectItems = selectItems.map(rawItem => {
    const trimmed = rawItem.replace(/--.*$/, '').trim();
    if (!trimmed) return rawItem;

    // 1. Nếu đã có hàm tổng hợp hoặc hàm cửa sổ -> giữ nguyên
    if (/\b(SUM|MAX|MIN|COUNT|AVG|STRING_AGG|CHECKSUM_AGG|STDEV|VAR|GROUPING|ROW_NUMBER|RANK|DENSE_RANK|NTILE)\s*\(/i.test(trimmed)) {
      return rawItem;
    }

    // 2. Nếu là hằng số, chuỗi, biến @ hoặc biểu thức CAST(0...) -> giữ nguyên
    if (/^(\d+|N?'|@|NULL\b)/i.test(trimmed) || /^CAST\s*\(\s*(\d+|N?'|@|NULL\b)/i.test(trimmed)) {
      return rawItem;
    }

    // 3. Nếu là ISNULL(col, default) [AS alias] hoặc COALESCE(col, default) [AS alias] mà col chưa bọc MAX()
    const isnullMatch = trimmed.match(/^(ISNULL|COALESCE)\s*\(\s*(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?)\s*,\s*([^)]+)\)(?:\s+AS\s+(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?))?$/i);
    if (isnullMatch) {
      const fnName = isnullMatch[1];
      const prefix = isnullMatch[2];
      const col = isnullMatch[3];
      const defVal = isnullMatch[4];
      const alias = isnullMatch[5] || col;
      const bareLower = col.replace(/^\[|\]$/g, '').toLowerCase();

      if (!groupedColsMap.has(bareLower)) {
        hasModified = true;
        const fullCol = prefix ? `${prefix}.${col}` : col;
        return `\n    ${fnName}(MAX(${fullCol}), ${defVal}) AS ${alias}`;
      }
      return rawItem;
    }

    // 4. Nếu là cột đơn giản: [alias.]ColName [AS OutputAlias]
    const simpleColMatch = trimmed.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?)(?:\s+AS\s+(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?))?$/i);
    if (simpleColMatch) {
      const prefix = simpleColMatch[1];
      const col = simpleColMatch[2];
      const alias = simpleColMatch[3];
      const bareLower = col.replace(/^\[|\]$/g, '').toLowerCase();

      if (groupedColsMap.has(bareLower)) {
        // Cột có trong GROUP BY: đồng bộ tiền tố bảng giữa SELECT và GROUP BY (tránh lỗi SELECT dw.Ma_Vt nhưng GROUP BY vt.Ma_vt)
        const groupByFullExpr = groupedColsMap.get(bareLower)!;
        const currentFullExpr = prefix ? `${prefix}.${col}` : col;
        if (currentFullExpr.toLowerCase() !== groupByFullExpr.toLowerCase()) {
          hasModified = true;
          return alias ? `${groupByFullExpr} AS ${alias}` : groupByFullExpr;
        }
        return rawItem;
      } else {
        // Cột KHÔNG nằm trong GROUP BY và chưa bọc hàm tổng hợp (VD: vt.Ten_vt, vt.Dvt) -> Bọc MAX() tự động!
        hasModified = true;
        const fullCol = prefix ? `${prefix}.${col}` : col;
        const outAlias = alias || col;
        return `MAX(${fullCol}) AS ${outAlias}`;
      }
    }

    return rawItem;
  });

  if (!hasModified) return stmt;

  const intoFormatted = /^\s*\bINTO\b/i.test(intoOrSpace) ? `\n${intoOrSpace.trim()}\n` : '\n';
  return `${selectPrefix}${fixedSelectItems.join(', ')}${intoFormatted}${fromToGroupBy}${groupByListRaw}${tailPart}`;
}

/**
 * Kiểm tra xem tên cột colName có xuất hiện trong danh sách SELECT đầu tiên của khối UNION hay không
 */
function isColumnInSelectList(selectListRaw: string, colName: string): boolean {
  const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Khớp `AS colName`, `.colName`, hoặc `colName` độc lập trong SELECT list
  const regex = new RegExp(`(?:\\bAS\\s+\\[?${escaped}\\]?|\\.\\[?${escaped}\\]?|\\b\\[?${escaped}\\]?)\\s*(?:,|$)`, 'im');
  if (regex.test(selectListRaw)) return true;
  // Kiểm tra thêm toàn bộ selectListRaw xem có token trùng tên cột không
  const tokenRegex = new RegExp(`\\b${escaped}\\b`, 'i');
  return tokenRegex.test(selectListRaw);
}

/**
 * Tách kịch bản SQL thành các câu lệnh độc lập ở cấp ngoài cùng (depth = 0)
 * để xử lý chính xác từng câu lệnh mà không bị nối nhầm qua nhiều khối SELECT.
 */
function splitIntoTopLevelStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/);
  const statements: string[] = [];
  let currentLines: string[] = [];
  let depth = 0;
  let lastMeaningfulLine = '';

  const startsNewStatementRegex = /^(?:IF\s+OBJECT_ID|IF\b|DROP\s+TABLE|DECLARE\b|SET\b|INSERT\s+INTO|UPDATE\b|DELETE\b|CREATE\b|ALTER\b|EXEC\b|WITH\b|END\b|GO\b)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (depth === 0 && currentLines.length > 0 && trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('/*')) {
      const prevEndedWithSemicolon = /;\s*$/.test(lastMeaningfulLine);
      const prevIsSetOperatorOrInsert = /\b(?:UNION|UNION\s+ALL|INTERSECT|EXCEPT)\s*$/i.test(lastMeaningfulLine) ||
        /\bINSERT\s+INTO\b[^;]*$/i.test(lastMeaningfulLine);

      const isNewStmtKeyword = startsNewStatementRegex.test(trimmed);
      const isStandaloneSelect = /^SELECT\b/i.test(trimmed) && !prevIsSetOperatorOrInsert;

      if (prevEndedWithSemicolon || isNewStmtKeyword || isStandaloneSelect) {
        statements.push(currentLines.join('\n'));
        currentLines = [];
      }
    }

    currentLines.push(line);

    if (trimmed && !trimmed.startsWith('--')) {
      lastMeaningfulLine = trimmed.replace(/--.*$/, '').trim();
      let inStr = false;
      for (let c = 0; c < trimmed.length; c++) {
        const ch = trimmed[c];
        if (ch === "'") inStr = !inStr;
        else if (!inStr) {
          if (ch === '(') depth++;
          else if (ch === ')') depth = Math.max(0, depth - 1);
        }
      }
    }
  }

  if (currentLines.length > 0) {
    statements.push(currentLines.join('\n'));
  }

  return statements;
}

/**
 * Tự động sửa lỗi Msg 104 trên SQL Server khi câu lệnh có UNION / UNION ALL kèm ORDER BY:
 * - Nếu là câu lệnh `SELECT ... INTO #Temp ... UNION ALL ... ORDER BY ...`: loại bỏ ORDER BY thừa trong SELECT INTO.
 * - Nếu là câu lệnh hiển thị `SELECT ... UNION ALL SELECT ... ORDER BY ...`:
 *   + Gỡ bỏ tiền tố alias bảng trong ORDER BY (VD: `dw.Ma_Vt` -> `Ma_Vt`).
 *   + Nếu cột trong ORDER BY (như `Cuoi`, `STT`, `Cap`) không có trong SELECT list của nhánh đầu:
 *     tự động bổ sung `0 AS Cuoi` vào nhánh 1 và `1 AS Cuoi` vào nhánh 2 (hoặc lược bỏ cột ẩn khỏi ORDER BY).
 */
function fixUnionOrderByMsg104(sql: string): string {
  const statements = splitIntoTopLevelStatements(sql);
  const fixedStatements = statements.map(stmt => {
    if (/\bUNION\b/i.test(stmt) && /\bORDER\s+BY\b/i.test(stmt)) {
      return fixSingleUnionStatement(stmt);
    }
    return stmt;
  });
  return fixedStatements.join('\n');
}

function fixSingleUnionStatement(stmt: string): string {
  // Khớp phần thân UNION [ALL] và mệnh đề ORDER BY ở cuối câu lệnh (giữ lại dấu ; hoặc comment phía sau nếu có)
  const match = stmt.match(/^([\s\S]*?\bUNION\s+(?:ALL\s+)?[\s\S]*?)\bORDER\s+BY\s+([^\r\n;]+)(;?\s*(?:--.*)?)$/i);
  if (!match) return stmt;

  let unionBody = match[1];
  const orderByItemsRaw = match[2].trim();
  const trailingSuffix = match[3] || '';

  // Trường hợp 1: Câu lệnh `SELECT ... INTO #Temp ... UNION ALL ... ORDER BY ...`
  // Trong T-SQL, tạo bảng tạm bằng SELECT INTO kèm UNION ALL không cần ORDER BY (và sẽ lỗi Msg 104 nếu cột không khớp)
  const firstBranch = unionBody.split(/\bUNION\s+(?:ALL\s+)?/i)[0] || '';
  if (/\bINTO\s+#[a-zA-Z0-9_]+/i.test(firstBranch)) {
    return unionBody.replace(/\s+$/, '') + trailingSuffix;
  }

  // Tách danh sách cột SELECT của nhánh đầu tiên (từ SELECT đến FROM đầu tiên)
  const firstSelectMatch = firstBranch.match(/\bSELECT\s+(?:DISTINCT\s+|TOP\s+\d+\s+)?([\s\S]*?)\bFROM\b/i);
  if (!firstSelectMatch) return stmt;
  const firstSelectList = firstSelectMatch[1];

  // Phân tích các mục trong ORDER BY
  const rawItems = orderByItemsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const cleanedOrderItems: string[] = [];
  const missingFlagCols: string[] = [];

  for (const item of rawItems) {
    // Bỏ tiền tố alias bảng trong ORDER BY của câu lệnh UNION (VD: dw.Ma_Vt ASC -> Ma_Vt ASC)
    const strippedAliasItem = item.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\./, '');
    const colIdentifierMatch = strippedAliasItem.match(/^\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?(?:\s+(?:ASC|DESC))?$/i);

    if (!colIdentifierMatch) {
      // Nếu là biểu thức phức tạp (CASE WHEN...) trong ORDER BY của UNION -> SQL Server cấm (Msg 104), nên bỏ qua
      continue;
    }

    const colName = colIdentifierMatch[1];
    if (isColumnInSelectList(firstSelectList, colName)) {
      cleanedOrderItems.push(strippedAliasItem);
    } else {
      missingFlagCols.push(colName);
    }
  }

  // Nếu có cột cờ sắp xếp (như Cuoi, STT, Cap) nằm trong ORDER BY nhưng thiếu trong SELECT list của 2 nhánh UNION ALL:
  const branches = unionBody.split(/\b(UNION\s+ALL\b|UNION\b)/i);
  // branches có dạng: [branch1, 'UNION ALL', branch2, ...]
  if (missingFlagCols.length === 1 && branches.length === 3) {
    const flagCol = missingFlagCols[0];
    // Chèn `0 AS Cuoi, ` vào nhánh 1 và `1 AS Cuoi, ` vào nhánh 2 để câu lệnh chạy 100% hợp lệ trên SQL Server
    const updatedBranch1 = branches[0].replace(/\b(SELECT(?:\s+DISTINCT|\s+TOP\s+\d+)?)\s+/i, `$1 0 AS ${flagCol}, `);
    const updatedBranch2 = branches[2].replace(/\b(SELECT(?:\s+DISTINCT|\s+TOP\s+\d+)?)\s+/i, `$1 1 AS ${flagCol}, `);
    unionBody = updatedBranch1 + branches[1] + updatedBranch2;
    const allOrderCols = rawItems.map(it => it.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\./, ''));
    return `${unionBody}ORDER BY ${allOrderCols.join(', ')}${trailingSuffix}`;
  }

  // Nếu có các cột ORDER BY không tồn tại trong SELECT list:
  if (missingFlagCols.length > 0) {
    // Nếu nhánh 2 là dòng TỔNG CỘNG mà ta chỉ giữ lại ORDER BY Ma_Vt thì dòng TỔNG CỘNG sẽ bị xếp lộn xộn vào giữa chữ T.
    // Do đó nếu có dòng TỔNG CỘNG trong UNION ALL, bỏ ORDER BY ở ngoài cùng để dòng TỔNG CỘNG luôn nằm cuối!
    if (/TỔNG\s+CỘNG|TONG\s+CONG/i.test(unionBody)) {
      return unionBody.replace(/\s+$/, '') + trailingSuffix;
    }
    if (cleanedOrderItems.length > 0) {
      return `${unionBody}ORDER BY ${cleanedOrderItems.join(', ')}${trailingSuffix}`;
    }
    return unionBody.replace(/\s+$/, '') + trailingSuffix;
  }

  return `${unionBody}ORDER BY ${cleanedOrderItems.join(', ')}${trailingSuffix}`;
}

export function formatBravoSql(rawSql: string): string {
  if (!rawSql || !rawSql.trim()) return rawSql;

  // Bước 0: Tự động rà soát và sửa các lỗi cú pháp T-SQL (Msg 104 UNION + ORDER BY, Msg 207 CTCT.Dinh_Chi)
  const sanitizedSql = sanitizeTsqlSyntax(rawSql);

  // Bước 1: Tự động gom dòng các trường theo chuẩn BRAVO ERP
  const packedSql = packBravoColumns(sanitizedSql);

  // Bước 2: Căn chỉnh thụt lề 1 tab (4 khoảng trắng) cho Cấp 0, Cấp 1, Cấp 2+
  const lines = packedSql.split(/\r?\n/);
  const resultLines: string[] = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Giữ nguyên dòng trống, tránh liên tiếp nhiều dòng trống
    if (!trimmed) {
      if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== '') {
        resultLines.push('');
      }
      continue;
    }

    // Đếm số dấu ngoặc đóng ở đầu dòng để giảm depth trước khi căn
    let leadingCloseCount = 0;
    while (leadingCloseCount < trimmed.length && trimmed[leadingCloseCount] === ')') {
      leadingCloseCount++;
    }
    const currentDepth = Math.max(0, depth - (trimmed.startsWith(')') ? 1 : 0));

    // Kiểm tra comment dòng "--"
    if (trimmed.startsWith('--')) {
      const indent = ' '.repeat(currentDepth * 4);
      resultLines.push(indent + trimmed);
      continue;
    }

    const upper = trimmed.toUpperCase();

    // Kiểm tra từ khóa Cấp 0
    let isLevel0 = false;
    for (const kw of LEVEL_0_KEYWORDS) {
      if (
        upper === kw ||
        upper.startsWith(kw + ' ') ||
        upper.startsWith(kw + '\t') ||
        upper.startsWith(kw + '(') ||
        upper.startsWith(kw + ';')
      ) {
        isLevel0 = true;
        break;
      }
    }

    let indentSpaces = 0;

    if (trimmed.startsWith(')')) {
      // Dấu đóng ngoặc subquery: cùng cấp với từ khóa mở (cấp cha)
      indentSpaces = currentDepth * 4;
    } else if (isLevel0) {
      // Cấp 0: sát lề của độ sâu hiện tại (depth * 4)
      indentSpaces = currentDepth * 4;
    } else {
      // Cấp 1+: thụt thêm 1 tab (4 khoảng trắng) so với cấp cha
      indentSpaces = (currentDepth + 1) * 4;
    }

    resultLines.push(' '.repeat(indentSpaces) + trimmed);

    // Cập nhật độ sâu depth cho các dòng tiếp theo
    // Bỏ qua ngoặc trong chuỗi '...'
    let openCount = 0;
    let closeCount = 0;
    let inString = false;

    for (let c = 0; c < trimmed.length; c++) {
      const char = trimmed[c];
      if (char === "'") {
        inString = !inString;
      } else if (!inString) {
        if (char === '(') openCount++;
        else if (char === ')') closeCount++;
      }
    }

    depth = Math.max(0, depth + openCount - closeCount);
  }

  return resultLines.join('\n');
}

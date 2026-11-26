export type FileWriteMode = 'smart-patch' | 'append' | 'replace-all';

export interface PatchAnalysisResult {
  mode: FileWriteMode;
  foundMatch: boolean;
  matchType: 'routine' | 'query' | 'exact' | 'append' | 'replace-all' | 'none';
  startLine: number;
  endLine: number;
  totalOriginalLines: number;
  changedLinesCount: number;
  routineName?: string;
  originalBlockPreview?: string;
  newBlockPreview: string;
  originalBlockFull?: string;
  newBlockFull: string;
  description: string;
  updatedContent: string;
}

export interface ParsedRoutine {
  type: string;
  schema?: string;
  name: string;
  headerStart: number;
  endIndex: number;
  startLine: number;
  endLine: number;
  text: string;
}

function tokenize(sql: string): Set<string> {
  const words = sql
    .toLowerCase()
    .replace(/[()[\]\\,;=+\-*/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !['select', 'from', 'where', 'and', 'or', 'as', 'is', 'null', 'in', 'on', 'join', 'inner', 'left', 'group', 'by', 'order', 'top', 'set', 'into', 'go', 'begin', 'end'].includes(w));
  return new Set(words);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizeRoutineType(type: string): string {
  const upper = type.toUpperCase();
  return upper === 'PROC' ? 'PROCEDURE' : upper;
}

function getLineRange(text: string, startIndex: number, endIndex: number): { startLine: number; endLine: number } {
  const beforeStart = text.substring(0, startIndex);
  const startLine = (beforeStart.match(/\n/g) || []).length + 1;
  const chunk = text.substring(startIndex, endIndex);
  const lineCount = (chunk.match(/\n/g) || []).length;
  const endLine = startLine + lineCount;
  return { startLine, endLine };
}

/**
 * Trích xuất toàn bộ các đối tượng (PROCEDURE/PROC/VIEW/FUNCTION/TRIGGER/TABLE)
 * cùng phạm vi vị trí ký tự & số dòng chính xác trong script SQL.
 */
export function extractAllRoutines(sql: string): ParsedRoutine[] {
  if (!sql || !sql.trim()) return [];

  const headerRegex = /^[ \t]*(?:CREATE\s+OR\s+ALTER|CREATE|ALTER)\s+(PROCEDURE|PROC|VIEW|FUNCTION|TRIGGER|TABLE)\s+(?:\[?([a-zA-Z0-9_]+)\]?\.)?\[?([a-zA-Z0-9_#]+)\]?\b/gim;
  const headers: { type: string; schema?: string; name: string; headerStart: number; matchEnd: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(sql)) !== null) {
    const leadingSpaces = m[0].match(/^[ \t]*/)?.[0].length ?? 0;
    headers.push({
      type: m[1].toUpperCase(),
      schema: m[2] || undefined,
      name: m[3],
      headerStart: m.index + leadingSpaces,
      matchEnd: m.index + m[0].length
    });
  }

  const routines: ParsedRoutine[] = [];
  for (let i = 0; i < headers.length; i++) {
    const cur = headers[i];
    const nextLimit = i + 1 < headers.length ? headers[i + 1].headerStart : sql.length;
    const slice = sql.substring(cur.matchEnd, nextLimit);

    // Tìm dòng GO độc lập gần nhất kết thúc batch của thủ tục
    const goMatch = slice.match(/(?:^|\r?\n)[ \t]*GO\b[^\r\n]*/i);
    let endIndex: number;
    if (goMatch && goMatch.index !== undefined) {
      endIndex = cur.matchEnd + goMatch.index + goMatch[0].length;
    } else {
      const trimmedSliceEnd = slice.replace(/\s+$/, '').length;
      endIndex = cur.matchEnd + trimmedSliceEnd;
    }

    const { startLine, endLine } = getLineRange(sql, cur.headerStart, endIndex);
    routines.push({
      type: cur.type,
      schema: cur.schema,
      name: cur.name,
      headerStart: cur.headerStart,
      endIndex,
      startLine,
      endLine,
      text: sql.substring(cur.headerStart, endIndex).trim()
    });
  }

  return routines;
}

/**
 * Loại bỏ tiền tố `USE <Database>; GO` nếu AI lỡ chèn vào đầu đoạn code chỉ dành cho 1 thủ tục.
 */
function stripLeadingUseGo(sql: string): string {
  return sql.replace(/^\s*USE\s+\[?[a-zA-Z0-9_]+\]?\s*;?\s*(?:\r?\n\s*GO\b[^\r\n]*)?\s*/i, '').trim();
}

/**
 * Nếu dòng ngay phía trên `headerStart` là một dòng comment `-- ...` đơn lẻ
 * và đoạn code mới cũng bắt đầu bằng `-- ...`, gộp dòng comment đó vào phạm vi thay thế để tránh lặp comment.
 */
function includeSinglePrecedingCommentIfNeeded(original: string, headerStart: number, newBlock: string): number {
  if (!newBlock.trimStart().startsWith('--')) return headerStart;
  const before = original.substring(0, headerStart);
  const match = before.match(/(?:^|\r?\n)([ \t]*--[^\r\n]*\r?\n[ \t]*)$/);
  if (!match) return headerStart;
  const commentOffset = before.length - match[1].length;
  return commentOffset;
}

function splitSqlIntoBlocks(sql: string): { index: number; length: number; text: string }[] {
  const blocks: { index: number; length: number; text: string }[] = [];
  const separatorRegex = /(?:\r?\n\s*GO\b[^\r\n]*)|(?:\r?\n\s*\r?\n\s*\r?\n+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = separatorRegex.exec(sql)) !== null) {
    const chunkText = sql.substring(lastIndex, match.index).trim();
    if (chunkText) {
      blocks.push({
        index: lastIndex,
        length: match.index - lastIndex,
        text: chunkText
      });
    }
    lastIndex = match.index + match[0].length;
  }

  const tail = sql.substring(lastIndex).trim();
  if (tail) {
    blocks.push({
      index: lastIndex,
      length: sql.length - lastIndex,
      text: tail
    });
  }

  if (blocks.length === 0 && sql.trim()) {
    blocks.push({ index: 0, length: sql.length, text: sql.trim() });
  }

  return blocks;
}

function buildRoutinePatchResult(
  trimmedOriginal: string,
  replaceStart: number,
  replaceEnd: number,
  replacementBlock: string,
  totalOriginalLines: number,
  routineLabel: string,
  routineName: string
): PatchAnalysisResult {
  const { startLine, endLine } = getLineRange(trimmedOriginal, replaceStart, replaceEnd);
  const originalBlock = trimmedOriginal.substring(replaceStart, replaceEnd).trim();
  const updatedContent =
    trimmedOriginal.substring(0, replaceStart) +
    replacementBlock +
    trimmedOriginal.substring(replaceEnd);
  const changedLinesCount = (replacementBlock.match(/\n/g) || []).length + 1;

  return {
    mode: 'smart-patch',
    foundMatch: true,
    matchType: 'routine',
    routineName,
    startLine,
    endLine,
    totalOriginalLines,
    changedLinesCount,
    originalBlockPreview: originalBlock.substring(0, 120) + (originalBlock.length > 120 ? '...' : ''),
    newBlockPreview: replacementBlock.substring(0, 120) + (replacementBlock.length > 120 ? '...' : ''),
    originalBlockFull: originalBlock,
    newBlockFull: replacementBlock,
    description: `Tìm thấy ${routineLabel} "${routineName}" (dòng ${startLine} - ${endLine}). Chỉ thay thế khối này, giữ nguyên các phần còn lại.`,
    updatedContent
  };
}

export function analyzeAndModifySqlFile(
  originalContent: string,
  newSql: string,
  preferredMode: FileWriteMode = 'smart-patch',
  targetRoutineHint?: string
): PatchAnalysisResult {
  const trimmedOriginal = originalContent || '';
  const trimmedNew = newSql.trim();
  const totalOriginalLines = (trimmedOriginal.match(/\n/g) || []).length + 1;

  // Append mode
  if (preferredMode === 'append' || !trimmedOriginal.trim()) {
    const separator = trimmedOriginal.trim()
      ? '\n\n-- Bổ sung bởi BRAVO SQL Agent\n'
      : '';
    const updatedContent = trimmedOriginal.trim()
      ? trimmedOriginal.trimEnd() + separator + trimmedNew + '\n'
      : trimmedNew + '\n';

    const addedLines = (trimmedNew.match(/\n/g) || []).length + 1;
    return {
      mode: 'append',
      foundMatch: true,
      matchType: 'append',
      startLine: totalOriginalLines + (trimmedOriginal.trim() ? 2 : 0),
      endLine: totalOriginalLines + (trimmedOriginal.trim() ? 2 : 0) + addedLines - 1,
      totalOriginalLines,
      changedLinesCount: addedLines,
      originalBlockPreview: '',
      newBlockPreview: trimmedNew.substring(0, 150) + (trimmedNew.length > 150 ? '...' : ''),
      originalBlockFull: '',
      newBlockFull: trimmedNew,
      description: `Ghi nối tiếp ${addedLines} dòng vào cuối file, giữ nguyên nội dung hiện tại.`,
      updatedContent
    };
  }

  // Replace all mode
  if (preferredMode === 'replace-all') {
    const newLines = (trimmedNew.match(/\n/g) || []).length + 1;
    return {
      mode: 'replace-all',
      foundMatch: true,
      matchType: 'replace-all',
      startLine: 1,
      endLine: newLines,
      totalOriginalLines,
      changedLinesCount: newLines,
      originalBlockPreview: trimmedOriginal.substring(0, 150) + (trimmedOriginal.length > 150 ? '...' : ''),
      newBlockPreview: trimmedNew.substring(0, 150) + (trimmedNew.length > 150 ? '...' : ''),
      originalBlockFull: trimmedOriginal,
      newBlockFull: trimmedNew,
      description: `Ghi đè toàn bộ file (${totalOriginalLines} dòng cũ -> ${newLines} dòng mới).`,
      updatedContent: trimmedNew + '\n'
    };
  }

  // Smart patch mode (AST Routine Matcher)
  const origRoutines = extractAllRoutines(trimmedOriginal);
  const newRoutines = extractAllRoutines(trimmedNew);

  if (newRoutines.length > 0 && origRoutines.length > 0) {
    // 1. Nếu có targetRoutineHint rõ ràng (VD: sp_BaoCaoDoanhThuTheoDoiTuong) và tồn tại ở cả file gốc & kết quả AI:
    //    tự động trích xuất riêng khối thủ tục mục tiêu đó để vá chính xác, kể cả khi AI trả về thừa thủ tục khác.
    if (targetRoutineHint) {
      const hintLower = targetRoutineHint.toLowerCase();
      const hintedNew = newRoutines.find(r => r.name.toLowerCase() === hintLower);
      const hintedOrig = origRoutines.find(r => r.name.toLowerCase() === hintLower);
      if (hintedNew && hintedOrig) {
        const replaceStart = includeSinglePrecedingCommentIfNeeded(trimmedOriginal, hintedOrig.headerStart, hintedNew.text);
        return buildRoutinePatchResult(
          trimmedOriginal,
          replaceStart,
          hintedOrig.endIndex,
          hintedNew.text,
          totalOriginalLines,
          hintedOrig.type,
          hintedOrig.name
        );
      }
    }

    // 2. Nếu AI trả về đúng 1 thủ tục (trường hợp chuẩn)
    if (newRoutines.length === 1) {
      const targetNew = newRoutines[0];
      const matchedOrig =
        origRoutines.find(
          r => r.name.toLowerCase() === targetNew.name.toLowerCase() &&
            normalizeRoutineType(r.type) === normalizeRoutineType(targetNew.type)
        ) ||
        origRoutines.find(r => r.name.toLowerCase() === targetNew.name.toLowerCase());

      if (matchedOrig) {
        const cleanedNewBlock = stripLeadingUseGo(trimmedNew);
        const replaceStart = includeSinglePrecedingCommentIfNeeded(trimmedOriginal, matchedOrig.headerStart, cleanedNewBlock);
        return buildRoutinePatchResult(
          trimmedOriginal,
          replaceStart,
          matchedOrig.endIndex,
          cleanedNewBlock,
          totalOriginalLines,
          matchedOrig.type,
          matchedOrig.name
        );
      }
    }

    // 3. Nếu AI trả về nhiều thủ tục cùng khớp trong file gốc (không có hint đơn lẻ):
    //    thay thế toàn bộ dải thủ tục khớp nhau thay vì nhồi tất cả vào thủ tục đầu tiên.
    const matchedOrigPairs = newRoutines
      .map(nr => origRoutines.find(or => or.name.toLowerCase() === nr.name.toLowerCase()))
      .filter((r): r is ParsedRoutine => Boolean(r));

    if (matchedOrigPairs.length >= 2) {
      const firstOrig = matchedOrigPairs.reduce((a, b) => (a.headerStart < b.headerStart ? a : b));
      const lastOrig = matchedOrigPairs.reduce((a, b) => (a.endIndex > b.endIndex ? a : b));
      const hasUseHeader = /^\s*USE\s+\[?[a-zA-Z0-9_]+\]?/i.test(trimmedNew);
      const replaceStart = hasUseHeader && /^\s*USE\s+/i.test(trimmedOriginal)
        ? 0
        : includeSinglePrecedingCommentIfNeeded(trimmedOriginal, firstOrig.headerStart, trimmedNew);
      const namesLabel = matchedOrigPairs.map(r => r.name).join(', ');
      return buildRoutinePatchResult(
        trimmedOriginal,
        replaceStart,
        lastOrig.endIndex,
        trimmedNew,
        totalOriginalLines,
        'nhiều thủ tục',
        namesLabel
      );
    }
  }

  // Fallback: So khớp khối truy vấn theo độ tương đồng token (Jaccard)
  const blocks = splitSqlIntoBlocks(trimmedOriginal);
  const newTokens = tokenize(trimmedNew);
  let bestMatch: { index: number; length: number; score: number; text: string } | null = null;

  for (const block of blocks) {
    const blockTokens = tokenize(block.text);
    const score = jaccardSimilarity(newTokens, blockTokens);

    if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        index: block.index,
        length: block.length,
        score,
        text: block.text
      };
    }
  }

  if (bestMatch && bestMatch.score >= 0.45) {
    const { startLine, endLine } = getLineRange(trimmedOriginal, bestMatch.index, bestMatch.index + bestMatch.length);
    const updatedContent = trimmedOriginal.substring(0, bestMatch.index) + trimmedNew + trimmedOriginal.substring(bestMatch.index + bestMatch.length);
    const changedLinesCount = (trimmedNew.match(/\n/g) || []).length + 1;

    return {
      mode: 'smart-patch',
      foundMatch: true,
      matchType: 'query',
      startLine,
      endLine,
      totalOriginalLines,
      changedLinesCount,
      originalBlockPreview: bestMatch.text.substring(0, 120) + (bestMatch.text.length > 120 ? '...' : ''),
      newBlockPreview: trimmedNew.substring(0, 120) + (trimmedNew.length > 120 ? '...' : ''),
      originalBlockFull: bestMatch.text,
      newBlockFull: trimmedNew,
      description: `Khớp khối truy vấn tại dòng ${startLine} - ${endLine} (tương đồng ${Math.round(bestMatch.score * 100)}%). Chỉ thay thế đoạn này.`,
      updatedContent
    };
  }

  const separator = trimmedOriginal.trim()
    ? '\n\n-- Bổ sung bởi BRAVO SQL Agent\n'
    : '';
  const updatedContent = trimmedOriginal.trimEnd() + separator + trimmedNew + '\n';
  const addedLines = (trimmedNew.match(/\n/g) || []).length + 1;

  return {
    mode: 'smart-patch',
    foundMatch: false,
    matchType: 'none',
    startLine: totalOriginalLines + 2,
    endLine: totalOriginalLines + 2 + addedLines - 1,
    totalOriginalLines,
    changedLinesCount: addedLines,
    originalBlockPreview: '',
    newBlockPreview: trimmedNew.substring(0, 120) + (trimmedNew.length > 120 ? '...' : ''),
    originalBlockFull: '',
    newBlockFull: trimmedNew,
    description: 'Không tìm thấy khối tương ứng trong file. Tự động nối vào cuối file.',
    updatedContent
  };
}

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'JOIN',
  'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'AS', 'TOP', 'LIMIT', 'OFFSET', 'BETWEEN', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
  'DESC', 'ASC', 'DISTINCT', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'SET', 'VALUES',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'PROCEDURE', 'PROC', 'FUNCTION', 'VIEW', 'INDEX',
  'DECLARE', 'BEGIN', 'RETURN', 'RETURNS', 'NEXT', 'OPEN', 'FOR', 'WITH', 'UNION', 'ALL',
  'IF', 'EXISTS', 'OVER', 'PARTITION', 'EXEC', 'EXECUTE', 'GO', 'DEFAULT', 'PRIMARY', 'KEY',
  'FOREIGN', 'REFERENCES', 'USE', 'NOCOUNT', 'PRINT', 'TRIGGER'
]);

const SQL_FUNCTIONS = new Set([
  'ISNULL', 'COALESCE', 'SUM', 'COUNT', 'MAX', 'MIN', 'AVG', 'ROUND', 'CAST', 'CONVERT',
  'DATEADD', 'DATEDIFF', 'DATEFROMPARTS', 'DATE_PART', 'GETDATE', 'NOW', 'OBJECT_ID',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'SUBSTRING', 'LEN', 'LENGTH', 'TRIM',
  'LTRIM', 'RTRIM', 'UPPER', 'LOWER', 'REPLACE', 'CHARINDEX', 'CONCAT', 'FORMAT',
  'YEAR', 'MONTH', 'DAY', 'ABS', 'NULLIF', 'IIF', 'STRING_AGG',
  'VARCHAR', 'NVARCHAR', 'INT', 'BIGINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DATETIME',
  'DATE', 'TEXT', 'BIT', 'BOOLEAN', 'SERIAL'
]);

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Tìm vị trí dấu `--` comment đầu tiên nằm ngoài chuỗi ký tự `'...'`.
 */
function findInlineCommentIndex(line: string): number {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "'") {
      inString = !inString;
    } else if (!inString && line[i] === '-' && line[i + 1] === '-') {
      return i;
    }
  }
  return -1;
}

/**
 * Highlight một dòng SQL bằng các CSS class `.sql-token-*` (tương thích cả Dark Mode và Light Mode).
 */
export function highlightSqlLine(rawLine: string): string {
  const cmtIdx = findInlineCommentIndex(rawLine);
  const codeRaw = cmtIdx !== -1 ? rawLine.substring(0, cmtIdx) : rawLine;
  const commentRaw = cmtIdx !== -1 ? rawLine.substring(cmtIdx) : '';

  const safeCode = escapeHtml(codeRaw);
  const commentPart = commentRaw
    ? `<span class="sql-token-cmt">${escapeHtml(commentRaw)}</span>`
    : '';

  const highlightedCode = safeCode.replace(
    /(N?'[^']*')|\b([A-Za-z_][A-Za-z0-9_]*)\b|\b(\d+(?:\.\d+)?)\b/g,
    (match, strLiteral, word, numLiteral) => {
      if (strLiteral !== undefined) {
        return `<span class="sql-token-str">${strLiteral}</span>`;
      }
      if (word !== undefined) {
        const upper = word.toUpperCase();
        if (SQL_KEYWORDS.has(upper)) {
          return `<span class="sql-token-kw">${word}</span>`;
        }
        if (SQL_FUNCTIONS.has(upper)) {
          return `<span class="sql-token-fn">${word}</span>`;
        }
        return word;
      }
      if (numLiteral !== undefined) {
        return `<span class="sql-token-num">${numLiteral}</span>`;
      }
      return match;
    }
  );

  return highlightedCode + commentPart;
}

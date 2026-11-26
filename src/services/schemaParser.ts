import type { TableSchema, TableRelationship, ColumnSchema } from '../types';

export interface ParsedDatabaseResult {
  databaseName: string;
  tables: TableSchema[];
  relationships: TableRelationship[];
}

export function parseSqlDdl(sqlScript: string): ParsedDatabaseResult {
  const cleanSql = sqlScript
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  let databaseName = 'CustomDatabase';
  const dbMatch = cleanSql.match(/CREATE\s+DATABASE\s+([a-zA-Z0-9_#]+)/i) ||
                  cleanSql.match(/USE\s+([a-zA-Z0-9_#]+)/i);
  if (dbMatch) {
    databaseName = dbMatch[1].trim();
  }

  const tables: TableSchema[] = [];
  const relationships: TableRelationship[] = [];

  const tableRegex = /CREATE\s+TABLE\s+(?:(?:dbo|\[dbo\])\.)?\[?([a-zA-Z0-9_#]+)\]?\s*\(([\s\S]*?)\)(?:\s*;|\s*GO|\s*$)/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].trim();
    const tableBody = match[2];

    const columns: ColumnSchema[] = [];
    const tableLevelPks: string[] = [];

    const lines = splitByCommaOutsideParens(tableBody);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const pkMatch = line.match(/^PRIMARY\s+KEY\s*\(([\s\S]*?)\)/i);
      if (pkMatch) {
        const pkCols = pkMatch[1].split(',').map(c => c.trim().replace(/[[\]]/g, ''));
        tableLevelPks.push(...pkCols);
        continue;
      }

      const fkMatch = line.match(/FOREIGN\s+KEY\s*\(?([a-zA-Z0-9_#]+)\)?\s+REFERENCES\s+(?:(?:dbo|\[dbo\])\.)?\[?([a-zA-Z0-9_#]+)\]?\s*\(?([a-zA-Z0-9_#]+)\)?/i);
      if (fkMatch) {
        const fromCol = fkMatch[1].trim().replace(/[[\]]/g, '');
        const toTable = fkMatch[2].trim().replace(/[[\]]/g, '');
        const toCol = fkMatch[3].trim().replace(/[[\]]/g, '');

        relationships.push({
          fromTable: tableName,
          fromColumn: fromCol,
          toTable,
          toColumn: toCol,
          description: `Liên kết khóa ngoại từ ${tableName}.${fromCol} tới ${toTable}.${toCol}`
        });

        const existingCol = columns.find(c => c.name.toLowerCase() === fromCol.toLowerCase());
        if (existingCol) {
          existingCol.isFk = true;
          existingCol.fkRef = `${toTable}(${toCol})`;
        }
        continue;
      }

      const colMatch = line.match(/^\[?([a-zA-Z0-9_#]+)\]?\s+([a-zA-Z0-9_]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)([\s\S]*)$/i);
      if (colMatch) {
        const colName = colMatch[1].trim();
        const colType = colMatch[2].trim();
        const constraints = colMatch[3] ? colMatch[3].trim() : '';

        const isPk = /PRIMARY\s+KEY/i.test(constraints);
        const checkMatch = constraints.match(/CHECK\s*\(([\s\S]*?)\)/i);
        const defaultMatch = constraints.match(/DEFAULT\s+([^\s,]+)/i);
        const isNotNull = /NOT\s+NULL/i.test(constraints);

        columns.push({
          name: colName,
          type: colType,
          isPk,
          nullable: !isPk && !isNotNull,
          defaultValue: defaultMatch ? defaultMatch[1].trim() : undefined,
          checkConstraint: checkMatch ? checkMatch[1].trim() : undefined,
          description: `Cột ${colName} (${colType})`
        });
      }
    }

    if (tableLevelPks.length > 0) {
      for (const pkCol of tableLevelPks) {
        const found = columns.find(c => c.name.toLowerCase() === pkCol.toLowerCase());
        if (found) {
          found.isPk = true;
          found.nullable = false;
        }
      }
    }

    tables.push({
      name: tableName,
      fullName: `dbo.${tableName}`,
      rowCount: estimateRowCount(cleanSql, tableName),
      description: `Bảng ${tableName}`,
      columns
    });
  }

  return {
    databaseName,
    tables,
    relationships
  };
}

function splitByCommaOutsideParens(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;

    if (char === ',' && parenDepth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
}

function estimateRowCount(sql: string, tableName: string): number {
  const regex = new RegExp(`INSERT\\s+INTO\\s+(?:(?:dbo|\\b)\\.)?\\[?${tableName}\\]?\\s*\\([\\s\\S]*?\\)\\s*VALUES([\\s\\S]*?)(?:;|GO|INSERT|CREATE|$)`, 'gi');
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    const valuesPart = match[1];
    const rows = valuesPart.match(/\([^()]*?\)/g);
    if (rows) count += rows.length;
  }

  return count > 0 ? count : 0;
}

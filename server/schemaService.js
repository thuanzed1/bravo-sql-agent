import { executeQuery, getEngineConfig } from './sqlEngine.js';

let cachedSchema = null;
let cachedDb = null;
let cachedTime = 0;
const CACHE_TTL = 30000; // 30s cache

export function invalidateSchemaCache() {
  cachedSchema = null;
  cachedDb = null;
  cachedTime = 0;
}

export async function fetchLiveSchema(config = {}, forceRefresh = false) {
  const cfg = getEngineConfig(config);
  const dbName = cfg.database || 'Quan_Ly_Kho_Hang';

  if (!forceRefresh && cachedSchema && cachedDb === dbName && (Date.now() - cachedTime < CACHE_TTL)) {
    return cachedSchema;
  }

  const tablesSql = `
SELECT 
    t.name AS tableName,
    SCHEMA_NAME(t.schema_id) AS schemaName,
    SUM(p.rows) AS TotalRows
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
GROUP BY t.name, t.schema_id
ORDER BY t.name;
`;

  const columnsSql = `
SELECT 
    t.name AS tableName,
    c.name AS columnName,
    tp.name AS dataType,
    c.is_nullable AS isNullable,
    ISNULL((
        SELECT 1 FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE ic.object_id = t.object_id AND ic.column_id = c.column_id AND i.is_primary_key = 1
    ), 0) AS isPk,
    ISNULL((
        SELECT 1 FROM sys.foreign_key_columns fkc
        WHERE fkc.parent_object_id = t.object_id AND fkc.parent_column_id = c.column_id
    ), 0) AS isFk,
    ISNULL((
        SELECT OBJECT_NAME(fkc.referenced_object_id) + '(' + COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) + ')'
        FROM sys.foreign_key_columns fkc
        WHERE fkc.parent_object_id = t.object_id AND fkc.parent_column_id = c.column_id
    ), '') AS fkRef,
    ISNULL(cc.definition, '') AS checkConstraint,
    ISNULL(dc.definition, '') AS defaultValue
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
INNER JOIN sys.types tp ON c.user_type_id = tp.user_type_id
LEFT JOIN sys.check_constraints cc ON cc.parent_object_id = t.object_id AND cc.parent_column_id = c.column_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = t.object_id AND dc.parent_column_id = c.column_id
ORDER BY t.name, c.column_id;
`;

  const relsSql = `
SELECT 
    OBJECT_NAME(fk.parent_object_id) AS fromTable,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS fromColumn,
    OBJECT_NAME(fk.referenced_object_id) AS toTable,
    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS toColumn,
    fk.name AS fkName
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id;
`;

  try {
    const [tablesRes, colsRes, relsRes] = await Promise.all([
      executeQuery(tablesSql, cfg),
      executeQuery(columnsSql, cfg),
      executeQuery(relsSql, cfg)
    ]);

    const colsByTable = {};
    for (const c of (colsRes.rows || [])) {
      if (!colsByTable[c.tableName]) colsByTable[c.tableName] = [];
      colsByTable[c.tableName].push({
        name: c.columnName,
        type: c.dataType,
        isPk: c.isPk === 1 || c.isPk === '1',
        isFk: c.isFk === 1 || c.isFk === '1',
        fkRef: c.fkRef || undefined,
        nullable: c.isNullable === 1 || c.isNullable === '1',
        defaultValue: c.defaultValue ? c.defaultValue.replace(/[()]/g, '') : undefined,
        checkConstraint: c.checkConstraint ? c.checkConstraint.replace(/[()]/g, '') : undefined,
        description: `Cột ${c.columnName} (${c.dataType})`
      });
    }

    const tables = (tablesRes.rows || []).map(t => ({
      name: t.tableName,
      fullName: `${t.schemaName || 'dbo'}.${t.tableName}`,
      rowCount: Number(t.TotalRows) || 0,
      description: `Bảng ${t.tableName} (Trực tiếp từ CSDL ${dbName})`,
      columns: colsByTable[t.tableName] || []
    }));

    const relationships = (relsRes.rows || []).map(r => ({
      fromTable: r.fromTable,
      fromColumn: r.fromColumn,
      toTable: r.toTable,
      toColumn: r.toColumn,
      description: `Khóa ngoại ${r.fkName || ''}: ${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn}`
    }));

    const result = {
      databaseName: dbName,
      tables,
      relationships,
      source: 'live-sql-server'
    };

    cachedSchema = result;
    cachedDb = dbName;
    cachedTime = Date.now();

    return result;
  } catch (err) {
    throw new Error(`Không thể lấy schema từ SQL Server: ${err.message}`);
  }
}

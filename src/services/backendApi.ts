import type { TableSchema, TableRelationship, QueryResult } from '../types';

export interface DbStatusResponse {
  success: boolean;
  serverName?: string;
  currentDb?: string;
  latencyMs?: number;
  message?: string;
  activeConfig?: {
    server: string;
    database: string;
    authMode: string;
  };
}

export interface LiveSchemaResponse {
  databaseName: string;
  tables: TableSchema[];
  relationships: TableRelationship[];
  source: 'live-sql-server';
}

export async function checkBackendStatus(): Promise<DbStatusResponse> {
  try {
    const res = await fetch('/api/db/status', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return { success: false, message: `Server HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Không thể kết nối tới Backend' };
  }
}

export async function fetchLiveSchemaFromDb(forceRefresh = false): Promise<LiveSchemaResponse | null> {
  try {
    const url = forceRefresh ? '/api/db/schema?refresh=1' : '/api/db/schema';
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('fetchLiveSchemaFromDb error:', err);
    return null;
  }
}

export async function executeSqlOnLiveDb(sql: string, database?: string): Promise<QueryResult> {
  try {
    const res = await fetch('/api/db/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, database }),
      signal: AbortSignal.timeout(30000)
    });

    const data = await res.json();
    if (!res.ok || data.status === 'error') {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeSec: data.executionTimeSec || 0,
        status: 'error',
        errorMessage: data.errorMessage || data.error || `HTTP ${res.status}`
      };
    }

    return {
      columns: data.columns || [],
      rows: data.rows || [],
      rowCount: data.rowCount || 0,
      executionTimeSec: data.executionTimeSec || 0,
      status: 'success'
    };
  } catch (err: any) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeSec: 0,
      status: 'error',
      errorMessage: err.message || 'Lỗi kết nối tới Backend SQL Server'
    };
  }
}

export async function listDatabasesFromDb(): Promise<string[]> {
  try {
    const res = await fetch('/api/db/databases', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.databases || [];
  } catch {
    return [];
  }
}

export async function switchActiveDatabase(database: string): Promise<boolean> {
  try {
    const res = await fetch('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ database })
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

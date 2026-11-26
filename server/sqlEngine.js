import { execFile } from 'child_process';
import { promisify } from 'util';
import { validateQuerySafety } from './queryGuard.js';

const execFileAsync = promisify(execFile);

const DEFAULT_CONFIG = {
  server: 'localhost',
  database: 'Quan_Ly_Kho_Hang',
  authMode: 'windows',
  user: '',
  password: '',
  timeoutMs: 30000
};

export function getEngineConfig(custom = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...custom
  };
}

function buildSqlCmdArgs(sql, config = {}) {
  const cfg = getEngineConfig(config);
  const args = ['-S', cfg.server, '-d', cfg.database, '-f', '65001', '-s', '\t', '-W'];

  if (cfg.authMode === 'sql' && cfg.user) {
    args.push('-U', cfg.user, '-P', cfg.password || '');
  } else {
    args.push('-E'); // Windows Authentication
  }

  // Ensure row counts are clean and batch finishes
  const wrappedSql = `SET NOCOUNT ON;\n${sql}`;
  args.push('-Q', wrappedSql);

  return args;
}

export async function testConnection(config = {}) {
  const startTime = Date.now();
  try {
    const args = buildSqlCmdArgs('SELECT @@SERVERNAME AS ServerName, DB_NAME() AS CurrentDb, @@VERSION AS SqlVersion;', config);
    const { stdout } = await execFileAsync('sqlcmd', args, {
      encoding: 'utf8',
      timeout: 10000
    });

    const elapsed = Date.now() - startTime;
    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let serverName = config.server || 'localhost';
    let currentDb = config.database || 'Quan_Ly_Kho_Hang';

    if (lines.length >= 3) {
      const vals = lines[2].split('\t');
      serverName = vals[0] || serverName;
      currentDb = vals[1] || currentDb;
    }

    return {
      success: true,
      serverName,
      currentDb,
      latencyMs: elapsed,
      message: `Kết nối thành công tới SQL Server (${serverName}) database [${currentDb}]`
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Không thể kết nối tới SQL Server',
      error: err.message
    };
  }
}

export async function listDatabases(config = {}) {
  try {
    const sql = `SELECT name FROM sys.databases WHERE state = 0 AND name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name;`;
    const args = buildSqlCmdArgs(sql, { ...config, database: 'master' });
    const { stdout } = await execFileAsync('sqlcmd', args, { encoding: 'utf8' });

    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) return ['Quan_Ly_Kho_Hang', 'QuanLyKho'];

    const dbs = lines.slice(2).filter(d => !d.startsWith('---') && !d.includes('rows affected'));
    return dbs.length > 0 ? dbs : ['Quan_Ly_Kho_Hang', 'QuanLyKho'];
  } catch {
    return ['Quan_Ly_Kho_Hang', 'QuanLyKho'];
  }
}

export async function executeQuery(rawSql, config = {}) {
  const safety = validateQuerySafety(rawSql);
  if (!safety.safe) {
    return {
      status: 'error',
      errorMessage: safety.error,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeSec: 0
    };
  }

  const startTime = process.hrtime();

  try {
    const args = buildSqlCmdArgs(rawSql, config);
    const { stdout, stderr } = await execFileAsync('sqlcmd', args, {
      encoding: 'utf8',
      timeout: config.timeoutMs || 30000,
      maxBuffer: 50 * 1024 * 1024
    });

    const elapsedParts = process.hrtime(startTime);
    const executionTimeSec = Number((elapsedParts[0] + elapsedParts[1] / 1e9).toFixed(3));

    // Check for SQL errors in output
    const errMatch = stdout.match(/Msg\s+(\d+),\s+Level\s+(\d+),\s+State\s+\d+[\s\S]*?(?=\r?\n\r?\n|$)/i);
    if (errMatch) {
      return {
        status: 'error',
        errorMessage: errMatch[0].trim(),
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeSec
      };
    }

    if (stderr && stderr.trim()) {
      return {
        status: 'error',
        errorMessage: stderr.trim(),
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeSec
      };
    }

    const lines = stdout.split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);

    // If no output or empty result
    if (lines.length === 0) {
      return {
        status: 'success',
        columns: ['Ket_Qua'],
        rows: [{ Ket_Qua: 'Lệnh đã thực thi thành công (0 dòng trả về)' }],
        rowCount: 0,
        executionTimeSec
      };
    }

    // Header line and separator
    const headerLine = lines[0];
    const columns = headerLine.split('\t').map(c => c.trim()).filter(Boolean);

    if (columns.length === 0 || lines.length === 1) {
      return {
        status: 'success',
        columns: ['Thong_Bao'],
        rows: [{ Thong_Bao: stdout.trim() || 'Thực thi thành công.' }],
        rowCount: 0,
        executionTimeSec
      };
    }

    // Data rows (skip line 1 which is separator dashes '-----')
    const dataLines = lines.slice(2);
    const rows = [];

    for (const line of dataLines) {
      if (!line || line.startsWith('(') && line.includes('affected')) continue;
      const values = line.split('\t');
      const row = {};
      columns.forEach((col, idx) => {
        let val = values[idx] !== undefined ? values[idx].trim() : null;
        if (val === 'NULL') val = null;
        else if (val && !isNaN(val) && !val.startsWith('0') && val.length < 15) {
          const num = Number(val);
          if (!isNaN(num)) val = num;
        }
        row[col] = val;
      });
      rows.push(row);
    }

    return {
      status: 'success',
      columns,
      rows,
      rowCount: rows.length,
      executionTimeSec,
      isReadOnly: safety.isReadOnly
    };
  } catch (err) {
    const elapsedParts = process.hrtime(startTime);
    const executionTimeSec = Number((elapsedParts[0] + elapsedParts[1] / 1e9).toFixed(3));

    return {
      status: 'error',
      errorMessage: err.message || 'Lỗi khi thực thi câu lệnh trên SQL Server',
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeSec
    };
  }
}

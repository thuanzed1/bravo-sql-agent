import React, { useState } from 'react';
import { Download, Bookmark, CheckCircle2, XCircle, ArrowUpDown, Table2 } from 'lucide-react';
import type { QueryResult } from '../types';

interface ResultTableProps {
  result: QueryResult;
  databaseName?: string;
  onSaveQuery?: () => void;
}

export const ResultTable: React.FC<ResultTableProps> = ({ 
  result, 
  databaseName = 'Quan_Ly_Kho_Hang',
  onSaveQuery 
}) => {
  const [saved, setSaved] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  if (result.status === 'error') {
    return (
      <div className="p-3 my-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <XCircle size={14} />
          <span>Lỗi thực thi SQL:</span>
        </div>
        <p className="font-mono text-[11px] leading-relaxed">{result.errorMessage}</p>
      </div>
    );
  }

  const handleExportCsv = () => {
    if (!result.rows || result.rows.length === 0) return;
    const headers = result.columns.join(',');
    const rows = result.rows.map(r => 
      result.columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${databaseName}_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (column: string) => {
    if (sortCol === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(column);
      setSortAsc(true);
    }
  };

  const sortedRows = [...result.rows].sort((a, b) => {
    if (!sortCol) return 0;
    const va = a[sortCol];
    const vb = b[sortCol];
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortAsc ? va - vb : vb - va;
    }
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  // Cell formatting helper
  const formatCell = (colName: string, val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-[var(--text-muted)] italic font-mono">NULL</span>;
    }
    if (typeof val === 'number') {
      if (colName.toLowerCase().includes('tien') || colName.toLowerCase().includes('gia') || colName.toLowerCase().includes('doanh_thu')) {
        return <span className="text-[var(--bravo-primary)] font-mono font-semibold">{val.toLocaleString('vi-VN')} đ</span>;
      }
      return <span className="text-[var(--sql-function)] font-mono font-medium">{val.toLocaleString('vi-VN')}</span>;
    }
    return String(val);
  };

  return (
    <div className="border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-code)] my-2.5 shadow-xs">
      {/* Top Panel Header (Bravo Query Result Console Style) */}
      <div className="h-8 bg-[var(--bg-code-header)] px-3 border-b border-[var(--border-subtle)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[var(--bravo-primary)] font-semibold">
            <Table2 size={13} />
            <span>Kết quả truy vấn</span>
          </span>
          <span className="text-[var(--border-strong)]">|</span>
          <span className="inline-flex items-center gap-1 text-[var(--bravo-primary)] text-[11px]">
            <CheckCircle2 size={11} />
            <span>Hoàn tất</span>
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-secondary)] font-mono text-[11px]">
            {result.rowCount} dòng ({result.executionTimeSec}s)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportCsv}
            className="h-6 px-2.5 rounded-md text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Xuất kết quả ra file CSV (Excel)"
          >
            <Download size={11} className="shrink-0" />
            <span>Xuất CSV</span>
          </button>

          {onSaveQuery && (
            <button
              onClick={() => {
                onSaveQuery();
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className="h-6 px-2.5 rounded-md text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Lưu vào danh mục truy vấn mẫu"
            >
              <Bookmark size={11} className={`shrink-0 ${saved ? 'text-amber-500 fill-amber-500' : ''}`} />
              <span>{saved ? 'Đã lưu' : 'Lưu mẫu'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--bg-code-header)] border-b border-[var(--border-default)] text-[var(--text-secondary)] uppercase text-[10px] tracking-wider z-10">
            <tr>
              <th className="py-2 px-3 w-10 text-center font-mono border-r border-[var(--border-subtle)]">#</th>
              {result.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="py-2 px-3 font-semibold hover:text-[var(--text-primary)] cursor-pointer select-none transition-colors border-r border-[var(--border-subtle)] last:border-r-0"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{col}</span>
                    <ArrowUpDown size={10} className={sortCol === col ? 'text-[var(--bravo-primary)]' : 'text-[var(--text-muted)]'} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] font-sans">
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="even:bg-[var(--table-row-alt)] hover:bg-[var(--table-row-hover)] transition-colors"
              >
                <td className="py-1.5 px-3 text-center text-[var(--text-muted)] font-mono text-[11px] border-r border-[var(--border-subtle)]">
                  {rowIdx + 1}
                </td>
                {result.columns.map((col) => (
                  <td key={col} className="py-1.5 px-3 text-[var(--text-primary)] text-xs border-r border-[var(--border-subtle)]/50 last:border-r-0">
                    {formatCell(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-3 py-1.5 bg-[var(--bg-code-header)] border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] flex justify-between items-center">
        <span>Click tiêu đề cột để sắp xếp tăng/giảm</span>
        <span className="font-mono">Database: {databaseName}</span>
      </div>
    </div>
  );
};

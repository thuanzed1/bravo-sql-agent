import React, { useState, useRef, useEffect } from 'react';
import { 
  Copy, Check, Play, FileCode, Download, Loader2, 
  ArrowLeftRight, ChevronDown, Save, GitMerge, Plus, AlertTriangle, CheckCircle2, X 
} from 'lucide-react';

import type { SqlDialect, FileWriteMode, PatchAnalysisResult } from '../types';
import { highlightSqlLine } from '../utils/sqlHighlight';

interface SqlBlockProps {
  sql: string;
  title?: string;
  sqlDialect?: SqlDialect;
  onRun?: (sql: string) => void;
  onSaveToFile?: (sql: string, mode: FileWriteMode) => Promise<{ success: boolean; analysis: PatchAnalysisResult } | boolean>;
  onOverwriteFile?: (sql: string) => Promise<boolean>;
  onConvertSql?: (sql: string, targetDialect: SqlDialect) => void;
  attachedFileName?: string;
  hasFileHandle?: boolean;
  onRequestPreviewPatch?: (sql: string, mode: FileWriteMode, onSuccess?: () => void) => void;
}

export const SqlBlock: React.FC<SqlBlockProps> = ({
  sql,
  title = 'Câu truy vấn SQL',
  sqlDialect = 'tsql',
  onRun,
  onSaveToFile,
  onOverwriteFile,
  onConvertSql,
  attachedFileName,
  hasFileHandle = false,
  onRequestPreviewPatch
}) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<PatchAnalysisResult | null>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài hoặc bấm ESC
  useEffect(() => {
    if (!showSaveMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSaveMenu]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExecuteSave = async (mode: FileWriteMode = 'smart-patch') => {
    setShowSaveMenu(false);

    // If modal preview is supported, open the Side-by-Side Diff Preview modal first
    if (onRequestPreviewPatch) {
      onRequestPreviewPatch(sql, mode, () => {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      });
      return;
    }

    setSaving(true);
    try {
      if (onSaveToFile) {
        const result = await onSaveToFile(sql, mode);
        if (typeof result === 'object' && result.success) {
          setLastAnalysis(result.analysis);
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
          return;
        }
      }
      
      // Fallback for legacy onOverwriteFile
      if (onOverwriteFile) {
        const ok = await onOverwriteFile(sql);
        if (ok) {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 2000);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachedFileName || `query_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Single-pass syntax highlighter using CSS Token Variables (Dark & Light safe)
  const formatSql = (raw: string) => {
    return raw.split('\n').map((line, lineIdx) => {
      const fullFormatted = highlightSqlLine(line);

      return (
        <div key={lineIdx} className="table-row leading-relaxed hover:bg-[var(--table-row-alt)]">
          <span className="table-cell pr-3.5 pl-1 text-right text-[var(--text-muted)] select-none text-[11px] font-mono border-r border-[var(--border-subtle)]/60 w-9">
            {lineIdx + 1}
          </span>
          <span
            className="table-cell pl-3 font-mono text-xs text-[var(--text-primary)] whitespace-pre"
            dangerouslySetInnerHTML={{ __html: fullFormatted || ' ' }}
          />
        </div>
      );
    });
  };

  return (
    <div className="relative border border-[var(--border-default)] rounded-xl bg-[var(--bg-code)] my-3 shadow-xs">
      {/* IDE Editor Toolbar Header */}
      <div className="min-h-9 py-1.5 bg-[var(--bg-code-header)] px-3 border-b border-[var(--border-subtle)] rounded-t-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
          <FileCode size={13} className="text-[var(--bravo-primary)] shrink-0" />
          <span className="truncate max-w-[220px] sm:max-w-xs">{title}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            sqlDialect === 'postgresql' 
              ? 'bg-[var(--accent-blue-surface)] text-[var(--accent-blue)] border-[var(--accent-blue-border)]' 
              : 'bg-[var(--bravo-surface)] text-[var(--bravo-primary)] border-[var(--bravo-border)]'
          }`}>
            {sqlDialect === 'postgresql' ? 'PostgreSQL' : 'T-SQL'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Convert dialect button */}
          {onConvertSql && (
            <button
              onClick={() => onConvertSql(sql, sqlDialect === 'tsql' ? 'postgresql' : 'tsql')}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] active:scale-95 text-[var(--sql-keyword)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={sqlDialect === 'tsql' ? 'Chuyển sang PostgreSQL' : 'Chuyển sang T-SQL'}
            >
              <ArrowLeftRight size={12} className="shrink-0" />
              <span>→ {sqlDialect === 'tsql' ? 'PostgreSQL' : 'T-SQL'}</span>
            </button>
          )}

          {/* Smart File Save / Patch / Append Button Group */}
          {(onSaveToFile || onOverwriteFile) && (hasFileHandle || attachedFileName) && (
            <div ref={saveMenuRef} className="relative inline-flex items-center shadow-2xs rounded-md">
              {/* Primary Action Button (Default Smart Patch) */}
              <button
                onClick={() => handleExecuteSave('smart-patch')}
                disabled={saving}
                className={`h-7 flex items-center gap-1.5 px-2.5 rounded-l-md text-[11px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                  savedSuccess
                    ? 'bg-[var(--bravo-primary)] text-white shadow-xs'
                    : 'bg-[var(--bravo-surface)] hover:bg-[var(--bravo-primary)]/15 text-[var(--bravo-primary)] border border-r-0 border-[var(--bravo-border)] hover:border-[var(--bravo-primary)]'
                }`}
                title="Tự động tìm đoạn code cũ tương ứng để thay thế, giữ nguyên phần còn lại của file"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin shrink-0" />
                ) : savedSuccess ? (
                  <CheckCircle2 size={12} className="shrink-0 text-white" />
                ) : (
                  <Save size={12} className="shrink-0 text-[var(--bravo-primary)]" />
                )}
                <span>{savedSuccess ? 'Đã lưu!' : `Lưu vào ${attachedFileName || 'file'}`}</span>
              </button>

              {/* Dropdown Options Trigger */}
              <button
                onClick={() => setShowSaveMenu(!showSaveMenu)}
                disabled={saving}
                className={`h-7 px-1.5 rounded-r-md text-[11px] font-medium border border-[var(--bravo-border)] transition-all cursor-pointer flex items-center justify-center ${
                  savedSuccess
                    ? 'bg-[var(--bravo-primary)] text-white border-l-white/20'
                    : 'bg-[var(--bravo-surface)] hover:bg-[var(--bravo-primary)]/15 text-[var(--bravo-primary)] hover:border-[var(--bravo-primary)]'
                }`}
                title="Tùy chọn: Sửa đoạn code, Ghi nối tiếp, hoặc Ghi đè"
              >
                <ChevronDown size={12} className={`transition-transform duration-200 ${showSaveMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu - Displays ABOVE the button (dropup) so it's NEVER cut off */}
              {showSaveMenu && (
                <div 
                  className="absolute bottom-full right-0 mb-2 w-72 bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--border-default)] rounded-xl shadow-2xl z-50 p-1.5 text-left text-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                    <span>Chọn phương thức lưu file</span>
                    <span className="text-[9px] lowercase font-normal opacity-70">esc để đóng</span>
                  </div>

                  {/* Option 1: Smart Patch */}
                  <button
                    onClick={() => handleExecuteSave('smart-patch')}
                    className="w-full px-2.5 py-2 hover:bg-[var(--bg-elevated)] rounded-lg text-left flex items-start gap-2.5 text-[var(--text-primary)] transition-colors cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-md bg-[var(--bravo-surface)] border border-[var(--bravo-border)] flex items-center justify-center text-[var(--bravo-primary)] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <GitMerge size={13} />
                    </div>
                    <div>
                      <div className="font-medium text-[11px] text-[var(--bravo-primary)] flex items-center gap-1.5">
                        <span>Sửa đoạn code liên quan</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-normal">Khuyên dùng</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">Tìm và thay thế đúng vị trí cần sửa, bảo toàn 100% các phần còn lại của file.</div>
                    </div>
                  </button>

                  {/* Option 2: Append */}
                  <button
                    onClick={() => handleExecuteSave('append')}
                    className="w-full px-2.5 py-2 hover:bg-[var(--bg-elevated)] rounded-lg text-left flex items-start gap-2.5 text-[var(--text-primary)] transition-colors cursor-pointer group mt-0.5"
                  >
                    <div className="w-6 h-6 rounded-md bg-[var(--accent-blue-surface)] border border-[var(--accent-blue-border)] flex items-center justify-center text-[var(--accent-blue)] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Plus size={13} />
                    </div>
                    <div>
                      <div className="font-medium text-[11px] text-[var(--accent-blue)]">Ghi nối thêm vào cuối (Append)</div>
                      <div className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">Chèn nguyên khối lệnh này vào cuối file hiện tại.</div>
                    </div>
                  </button>

                  {/* Option 3: Replace All */}
                  <button
                    onClick={() => handleExecuteSave('replace-all')}
                    className="w-full px-2.5 py-2 hover:bg-rose-500/10 rounded-lg text-left flex items-start gap-2.5 text-[var(--text-primary)] transition-colors border-t border-[var(--border-subtle)] cursor-pointer group mt-1 pt-1.5"
                  >
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <AlertTriangle size={13} />
                    </div>
                    <div>
                      <div className="font-medium text-[11px] text-amber-500">Ghi đè toàn bộ file (Overwrite All)</div>
                      <div className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">Thay thế toàn bộ nội dung file bằng code này.</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Download .sql button */}
          <button
            onClick={handleDownloadFile}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Tải câu lệnh này về máy dạng file .sql"
          >
            <Download size={12} className="shrink-0" />
            <span>Tải .sql</span>
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Sao chép vào clipboard"
          >
            {copied ? <Check size={12} className="text-[var(--bravo-primary)] shrink-0" /> : <Copy size={12} className="shrink-0" />}
            <span>{copied ? 'Đã chép' : 'Copy'}</span>
          </button>

          {/* Bravo Studio Run Button (F5 style) */}
          {onRun && (
            <button
              onClick={() => onRun(sql)}
              className="h-7 px-3.5 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-emerald-500/25 border border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ml-0.5"
              title="Thực thi câu truy vấn (F5)"
            >
              <Play size={11} fill="currentColor" className="shrink-0" />
              <span>Chạy</span>
            </button>
          )}
        </div>
      </div>

      {/* Smart File Save Analysis Result Banner */}
      {lastAnalysis && (
        <div className="px-3 py-2 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            {lastAnalysis.mode === 'smart-patch' && (
              <span className="w-5 h-5 rounded bg-[var(--bravo-surface)] border border-[var(--bravo-border)] flex items-center justify-center text-[var(--bravo-primary)] shrink-0">
                <GitMerge size={11} />
              </span>
            )}
            {lastAnalysis.mode === 'append' && (
              <span className="w-5 h-5 rounded bg-[var(--accent-blue-surface)] border border-[var(--accent-blue-border)] flex items-center justify-center text-[var(--accent-blue)] shrink-0">
                <Plus size={11} />
              </span>
            )}
            {lastAnalysis.mode === 'replace-all' && (
              <span className="w-5 h-5 rounded bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                <AlertTriangle size={11} />
              </span>
            )}
            <span className="text-[11px] text-[var(--text-primary)] font-medium leading-tight">
              {lastAnalysis.description}
            </span>
          </div>
          <button 
            onClick={() => setLastAnalysis(null)} 
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            title="Đóng thông báo"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Code Viewer */}
      <div className="py-2.5 px-2 overflow-x-auto rounded-b-xl">
        <div className="table w-full">
          {formatSql(sql)}
        </div>
      </div>
    </div>
  );
};

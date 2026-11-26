import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  GitMerge, X, Check, Copy, Download, Plus, AlertTriangle,
  FileCode, ShieldCheck, Columns, AlignLeft
} from 'lucide-react';
import { analyzeAndModifySqlFile } from '../services/fileModifier';
import type { FileWriteMode } from '../services/fileModifier';
import { highlightSqlLine } from '../utils/sqlHighlight';

interface FilePatchPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  fileSize?: number;
  originalContent: string;
  newSql: string;
  initialMode?: FileWriteMode;
  targetRoutineName?: string;
  onClose: () => void;
  onConfirmSave: (mode: FileWriteMode, updatedContent: string) => Promise<void> | void;
}

export const FilePatchPreviewModal: React.FC<FilePatchPreviewModalProps> = ({
  isOpen,
  fileName,
  fileSize,
  originalContent,
  newSql,
  initialMode = 'smart-patch',
  targetRoutineName,
  onClose,
  onConfirmSave
}) => {
  const [selectedMode, setSelectedMode] = useState<FileWriteMode>(initialMode);
  const [viewLayout, setViewLayout] = useState<'side-by-side' | 'full-file'>('side-by-side');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compute live patch analysis whenever mode, target hint, or inputs change
  const analysis = useMemo(() => {
    return analyzeAndModifySqlFile(originalContent, newSql, selectedMode, targetRoutineName);
  }, [originalContent, newSql, selectedMode, targetRoutineName]);

  const originalLines = useMemo(() => (originalContent || '').split(/\r?\n/), [originalContent]);
  const newLines = useMemo(() => (analysis.newBlockFull || newSql).split(/\r?\n/), [analysis.newBlockFull, newSql]);
  const oldTargetLines = useMemo(() => (analysis.originalBlockFull || '').split(/\r?\n/), [analysis.originalBlockFull]);
  const fullUpdatedLines = useMemo(() => analysis.updatedContent.split(/\r?\n/), [analysis.updatedContent]);

  const linesRemoved = analysis.mode === 'append' ? 0 : (analysis.endLine - analysis.startLine + 1);
  const linesAdded = newLines.length;
  const linesPreserved = analysis.mode === 'replace-all'
    ? 0
    : Math.max(0, analysis.totalOriginalLines - (analysis.foundMatch ? linesRemoved : 0));

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      await onConfirmSave(selectedMode, analysis.updatedContent);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [selectedMode, analysis.updatedContent, onConfirmSave, onClose]);

  // Keyboard shortcut listener: Esc to close, Ctrl+Enter to save
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleConfirm]);

  const handleCopyMerged = () => {
    navigator.clipboard.writeText(analysis.updatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMerged = () => {
    const blob = new Blob([analysis.updatedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'patched_query.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-6xl h-[90vh] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--bravo-surface)] border border-[var(--bravo-border)] flex items-center justify-center text-[var(--bravo-primary)] shadow-2xs">
              <GitMerge size={17} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  Xem trước &amp; Xác nhận chèn code vào file
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--bg-code)] text-[var(--bravo-primary)] border border-[var(--border-default)]">
                  <FileCode size={11} />
                  {fileName}
                  {fileSize ? ` (${formatFileSize(fileSize)})` : ''}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Rà soát thay đổi trước khi lưu. File gốc trên máy của bạn được bảo toàn 100% cho đến khi bạn xác nhận.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View layout toggle */}
            <div className="inline-flex rounded-lg p-0.5 bg-[var(--bg-code)] border border-[var(--border-default)] text-xs">
              <button
                type="button"
                onClick={() => setViewLayout('side-by-side')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  viewLayout === 'side-by-side'
                    ? 'bg-[var(--bg-card)] text-[var(--bravo-primary)] shadow-2xs border border-[var(--border-subtle)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="So sánh đoạn cũ và mới song song"
              >
                <Columns size={13} />
                <span>Song song</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('full-file')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  viewLayout === 'full-file'
                    ? 'bg-[var(--bg-card)] text-[var(--bravo-primary)] shadow-2xs border border-[var(--border-subtle)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Xem toàn bộ file hoàn chỉnh sau khi gộp"
              >
                <AlignLeft size={13} />
                <span>Toàn bộ file</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-code)] rounded-lg transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Mode Selector & Stats Toolbar */}
        <div className="px-5 py-2.5 bg-[var(--bg-code-header)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* 3 Modes Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mr-1">
              Chế độ lưu:
            </span>

            {/* Smart Patch Button */}
            <button
              type="button"
              onClick={() => setSelectedMode('smart-patch')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                selectedMode === 'smart-patch'
                  ? 'bg-[var(--bravo-surface)] text-[var(--bravo-primary)] border-[var(--bravo-border)] shadow-2xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
              }`}
            >
              <GitMerge size={12} className="text-[var(--bravo-primary)]" />
              <span>Sửa đoạn liên quan (Khuyên dùng)</span>
            </button>

            {/* Append Button */}
            <button
              type="button"
              onClick={() => setSelectedMode('append')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                selectedMode === 'append'
                  ? 'bg-[var(--accent-blue-surface)] text-[var(--accent-blue)] border-[var(--accent-blue-border)] shadow-2xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Plus size={12} className="text-[var(--accent-blue)]" />
              <span>Nối vào cuối (Append)</span>
            </button>

            {/* Replace All Button */}
            <button
              type="button"
              onClick={() => setSelectedMode('replace-all')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                selectedMode === 'replace-all'
                  ? 'bg-[var(--diff-warn-bg)] text-[var(--diff-warn-text)] border-[var(--diff-warn-border)] shadow-2xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
              }`}
            >
              <AlertTriangle size={12} className="text-[var(--diff-warn-accent)]" />
              <span>Ghi đè toàn bộ (Overwrite)</span>
            </button>
          </div>

          {/* Change Stats Badges */}
          <div className="flex items-center gap-2 text-[11px] font-mono font-medium">
            {linesRemoved > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--diff-del-badge-bg)] text-[var(--diff-del-accent)] border border-[var(--diff-del-border)]">
                - {linesRemoved} dòng cũ
              </span>
            )}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--diff-add-badge-bg)] text-[var(--diff-add-accent)] border border-[var(--diff-add-border)]">
              + {linesAdded} dòng mới
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-default)]">
              <ShieldCheck size={12} className="text-[var(--bravo-primary)]" />
              Giữ nguyên {linesPreserved} dòng còn lại
            </span>
          </div>
        </div>

        {/* Analysis Status Banner */}
        <div className="px-5 py-2 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-[var(--text-secondary)] shrink-0">Phân tích AST:</span>
            <span className="text-[var(--text-primary)] font-medium truncate" title={analysis.description}>
              {analysis.description}
            </span>
          </div>

          {/* Location indicator */}
          <div className="text-[11px] font-mono text-[var(--text-secondary)] flex items-center gap-1.5 shrink-0">
            <span>Dòng đích:</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-code)] text-[var(--bravo-primary)] font-semibold border border-[var(--border-default)]">
              {analysis.startLine} → {analysis.endLine}
            </span>
            <span>/ {analysis.totalOriginalLines} dòng gốc</span>
          </div>
        </div>

        {/* Warning if no routine match in smart-patch mode */}
        {selectedMode === 'smart-patch' && !analysis.foundMatch && (
          <div className="px-5 py-2 bg-[var(--diff-warn-bg)] border-b border-[var(--diff-warn-border)] text-[var(--diff-warn-text)] text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle size={14} className="shrink-0 text-[var(--diff-warn-accent)]" />
            <span>
              Không tìm thấy thủ tục hoặc câu lệnh khớp chính xác trong file. Hệ thống tự động chuyển sang chế độ <strong>Nối vào cuối file</strong> để tránh làm mất code quan trọng của bạn.
            </span>
          </div>
        )}

        {/* Main Diff Content Workspace */}
        <div className="flex-1 overflow-hidden p-3 bg-[var(--bg-app)]">
          {viewLayout === 'side-by-side' ? (
            /* Side-by-Side Split View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
              {/* Left Column: Old Code In File */}
              <div className="flex flex-col h-full min-w-0 bg-[var(--bg-code)] border border-[var(--border-default)] rounded-lg overflow-hidden shadow-2xs">
                <div className="px-3 py-2 bg-[var(--diff-del-header-bg)] border-b border-[var(--diff-del-border)] flex items-center justify-between text-xs font-semibold text-[var(--diff-del-text)] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--diff-del-accent)]" />
                    <span>Code hiện tại trong file</span>
                    {analysis.mode !== 'append' && (
                      <span className="text-[11px] font-mono font-medium text-[var(--diff-del-accent)]">
                        (Dòng {analysis.startLine} → {analysis.endLine})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-card)]/70 text-[var(--diff-del-accent)] border border-[var(--diff-del-border)]">
                    {analysis.mode === 'append' ? 'Bảo toàn' : 'Sẽ bị gỡ bỏ'}
                  </span>
                </div>

                <div className="flex-1 overflow-auto py-1.5 text-[12.5px] leading-[1.6] font-mono">
                  {analysis.mode === 'append' ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[var(--text-secondary)] font-sans">
                      <div className="w-12 h-12 rounded-full bg-[var(--diff-add-badge-bg)] text-[var(--diff-add-accent)] border border-[var(--diff-add-border)] flex items-center justify-center mb-2">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="font-semibold text-[var(--text-primary)] text-sm mb-1">
                        Không có dòng code nào bị xóa
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] max-w-sm">
                        Chế độ <strong>Nối vào cuối (Append)</strong> bảo toàn nguyên vẹn 100% toàn bộ {analysis.totalOriginalLines} dòng của file hiện tại.
                      </p>
                    </div>
                  ) : (
                    <div className="table w-full min-w-max">
                      {(analysis.mode === 'replace-all' ? originalLines : oldTargetLines).map((line, idx) => {
                        const lineNum = (analysis.mode === 'replace-all' ? 1 : analysis.startLine) + idx;
                        return (
                          <div
                            key={idx}
                            className="table-row bg-[var(--diff-del-bg)] hover:bg-[var(--diff-del-bg-hover)] transition-colors"
                          >
                            <span className="table-cell pr-2.5 pl-2 text-right text-[var(--diff-del-gutter)] select-none text-[11px] w-11 border-r border-[var(--diff-del-border)] border-l-2 border-l-[var(--diff-del-accent)]">
                              {lineNum}
                            </span>
                            <span className="table-cell px-2 text-[var(--diff-del-accent)] select-none w-5 text-center font-bold">
                              -
                            </span>
                            <span
                              className="table-cell pl-1 pr-3 text-[var(--text-primary)] whitespace-pre"
                              dangerouslySetInnerHTML={{ __html: highlightSqlLine(line) || ' ' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: New Code From AI */}
              <div className="flex flex-col h-full min-w-0 bg-[var(--bg-code)] border border-[var(--border-default)] rounded-lg overflow-hidden shadow-2xs">
                <div className="px-3 py-2 bg-[var(--diff-add-header-bg)] border-b border-[var(--diff-add-border)] flex items-center justify-between text-xs font-semibold text-[var(--diff-add-text)] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--diff-add-accent)]" />
                    <span>Code mới AI đề xuất</span>
                    <span className="text-[11px] font-mono font-medium text-[var(--diff-add-accent)]">
                      ({linesAdded} dòng)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-card)]/70 text-[var(--diff-add-accent)] border border-[var(--diff-add-border)]">
                    Sẽ chèn vào
                  </span>
                </div>

                <div className="flex-1 overflow-auto py-1.5 text-[12.5px] leading-[1.6] font-mono">
                  <div className="table w-full min-w-max">
                    {newLines.map((line, idx) => {
                      const lineNum = (analysis.mode === 'replace-all' ? 1 : analysis.startLine) + idx;
                      return (
                        <div
                          key={idx}
                          className="table-row bg-[var(--diff-add-bg)] hover:bg-[var(--diff-add-bg-hover)] transition-colors"
                        >
                          <span className="table-cell pr-2.5 pl-2 text-right text-[var(--diff-add-gutter)] select-none text-[11px] w-11 border-r border-[var(--diff-add-border)] border-l-2 border-l-[var(--diff-add-accent)]">
                            {lineNum}
                          </span>
                          <span className="table-cell px-2 text-[var(--diff-add-accent)] select-none w-5 text-center font-bold">
                            +
                          </span>
                          <span
                            className="table-cell pl-1 pr-3 text-[var(--text-primary)] whitespace-pre"
                            dangerouslySetInnerHTML={{ __html: highlightSqlLine(line) || ' ' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Full File Preview */
            <div className="flex flex-col h-full bg-[var(--bg-code)] border border-[var(--border-default)] rounded-lg overflow-hidden shadow-2xs">
              <div className="px-3 py-2 bg-[var(--bg-code-header)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[var(--text-primary)] shrink-0">
                <div className="flex items-center gap-2">
                  <FileCode size={13} className="text-[var(--bravo-primary)]" />
                  <span className="font-semibold">Toàn bộ nội dung file sau khi gộp ({fullUpdatedLines.length} dòng)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--diff-add-badge-bg)] text-[var(--diff-add-accent)] border border-[var(--diff-add-border)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--diff-add-accent)] inline-block" />
                    Dòng {analysis.startLine} → {analysis.startLine + linesAdded - 1} là đoạn code mới chèn
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto py-1.5 text-[12.5px] leading-[1.6] font-mono">
                <div className="table w-full min-w-max">
                  {fullUpdatedLines.map((line, idx) => {
                    const lineNum = idx + 1;
                    const isNewlyInserted = lineNum >= analysis.startLine && lineNum < (analysis.startLine + linesAdded);
                    return (
                      <div
                        key={idx}
                        className={`table-row transition-colors ${
                          isNewlyInserted
                            ? 'bg-[var(--diff-add-bg)] hover:bg-[var(--diff-add-bg-hover)]'
                            : 'hover:bg-[var(--table-row-alt)]'
                        }`}
                      >
                        <span className={`table-cell pr-2.5 pl-2 text-right select-none text-[11px] w-11 border-r ${
                          isNewlyInserted
                            ? 'text-[var(--diff-add-gutter)] border-r-[var(--diff-add-border)] border-l-2 border-l-[var(--diff-add-accent)] font-semibold'
                            : 'text-[var(--text-muted)] border-[var(--border-subtle)]'
                        }`}>
                          {lineNum}
                        </span>
                        <span className={`table-cell px-2 select-none w-5 text-center font-bold ${
                          isNewlyInserted ? 'text-[var(--diff-add-accent)]' : 'text-transparent'
                        }`}>
                          {isNewlyInserted ? '+' : ' '}
                        </span>
                        <span
                          className="table-cell pl-1 pr-3 text-[var(--text-primary)] whitespace-pre"
                          dangerouslySetInnerHTML={{ __html: highlightSqlLine(line) || ' ' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMerged}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-code)] text-[var(--text-primary)] border border-[var(--border-default)] transition-colors cursor-pointer"
              title="Sao chép toàn bộ nội dung file sau khi gộp vào clipboard"
            >
              {copied ? <Check size={13} className="text-[var(--bravo-primary)]" /> : <Copy size={13} />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép file sau gộp'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMerged}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-code)] text-[var(--text-primary)] border border-[var(--border-default)] transition-colors cursor-pointer"
              title="Tải file đã gộp về máy để đối chiếu riêng"
            >
              <Download size={13} />
              <span>Tải file gộp (.sql)</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            >
              Hủy bỏ (Esc)
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bravo-primary)] hover:bg-[var(--bravo-primary-hover)] text-white transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang ghi file...</span>
                </>
              ) : (
                <>
                  <span>Xác nhận ghi vào file</span>
                  <span className="text-[10px] font-mono text-white/90 bg-black/20 px-1.5 py-0.5 rounded">
                    Ctrl+Enter
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

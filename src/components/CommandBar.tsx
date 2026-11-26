import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Terminal, Database, HelpCircle, SlidersHorizontal,
  Bug, GitCompare, Boxes, Paperclip, X, FileCode, ArrowLeftRight, BookOpen
} from 'lucide-react';
import { SLASH_COMMANDS } from '../data/quanLyKhoSchema';
import type { SlashCommand, AttachedFile } from '../types';

interface CommandBarProps {
  onSendMessage: (text: string, attachedFile?: AttachedFile) => void;
  attachedFile?: AttachedFile | null;
  onAttachFile?: (file: AttachedFile | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  onSendMessage,
  attachedFile,
  onAttachFile,
  inputRef
}) => {
  const [value, setValue] = useState('');
  const [flowMode, setFlowMode] = useState<'generate' | 'optimize'>('generate');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea according to content (min 38px, max 220px)
  const adjustHeight = () => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const minHeight = 38;
    const maxHeight = 220;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const syncFlowFromText = (text: string) => {
    const trimmed = text.trim();
    if (/^\/optimize\b/i.test(trimmed)) {
      setFlowMode('optimize');
    } else if (/^\/(query|tonkho)\b/i.test(trimmed)) {
      setFlowMode('generate');
    }
  };

  // Sync value if changed externally (e.g. via handleInsertPrompt in App.tsx)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handleSync = () => {
      setValue(el.value);
      syncFlowFromText(el.value);
      adjustHeight();
    };
    el.addEventListener('input', handleSync);
    return () => el.removeEventListener('input', handleSync);
  }, [inputRef]);

  // Filter commands strictly by active flow + typed prefix
  const isCommandMatch = (cmd: SlashCommand, rawText: string, mode: 'generate' | 'optimize') => {
    if (!rawText.startsWith('/')) return false;
    if (cmd.flows && !cmd.flows.includes(mode)) return false;
    const query = rawText.slice(1).toLowerCase();
    return cmd.command.slice(1).toLowerCase().startsWith(query);
  };

  const filteredCommands = SLASH_COMMANDS.filter(cmd => isCommandMatch(cmd, value, flowMode));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setValue(nextVal);

    const nextTrimmed = nextVal.trim();
    let effectiveMode = flowMode;
    if (/^\/optimize\b/i.test(nextTrimmed)) {
      effectiveMode = 'optimize';
      setFlowMode('optimize');
    } else if (/^\/(query|tonkho)\b/i.test(nextTrimmed)) {
      effectiveMode = 'generate';
      setFlowMode('generate');
    }

    if (nextVal.startsWith('/')) {
      const matches = SLASH_COMMANDS.some(cmd => isCommandMatch(cmd, nextVal, effectiveMode));
      setShowDropdown(matches);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelectFlowMode = (mode: 'generate' | 'optimize') => {
    setFlowMode(mode);
    setSelectedIndex(0);
    if (mode === 'generate' && /^\/optimize\b\s*/i.test(value)) {
      setValue(prev => prev.replace(/^\/optimize\b\s*/i, ''));
      setShowDropdown(false);
    } else if (mode === 'optimize' && /^\/(query|tonkho)\b\s*/i.test(value)) {
      setValue(prev => prev.replace(/^\/(query|tonkho)\b\s*/i, ''));
      setShowDropdown(false);
    } else if (value.startsWith('/')) {
      const matches = SLASH_COMMANDS.some(cmd => isCommandMatch(cmd, value, mode));
      setShowDropdown(matches);
    }
    inputRef.current?.focus();
  };

  const handleSelectCommand = (cmd: SlashCommand) => {
    setValue(cmd.command + ' ');
    if (cmd.command === '/optimize') setFlowMode('optimize');
    else if (cmd.command === '/query' || cmd.command === '/tonkho') setFlowMode('generate');
    setShowDropdown(false);
    if (inputRef.current) {
      inputRef.current.focus();
      requestAnimationFrame(() => {
        adjustHeight();
      });
    }
  };

  const handlePaste = () => {
    // Preserve newlines, indentation, and tabs; adjust height right after paste
    requestAnimationFrame(() => {
      adjustHeight();
    });
  };

  const handlePickFile = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Tập tin SQL / Mã nguồn',
              accept: {
                'text/plain': ['.sql', '.txt', '.prg']
              }
            }
          ],
          multiple: false
        });

        const file = await handle.getFile();
        const content = await file.text();

        if (onAttachFile) {
          onAttachFile({
            name: file.name,
            content,
            sizeBytes: file.size,
            handle
          });
        }
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    fileInputRef.current?.click();
  };

  const handleFallbackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      if (onAttachFile) {
        onAttachFile({
          name: file.name,
          content,
          sizeBytes: file.size
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed && !attachedFile) return;

    let payload = trimmed;
    if (flowMode === 'optimize') {
      if (!trimmed && attachedFile) {
        payload = '/optimize Hãy phân tích điểm nghẽn và tối ưu file SQL đính kèm này';
      } else if (trimmed && !trimmed.startsWith('/')) {
        payload = `/optimize ${trimmed}`;
      }
    } else if (!payload) {
      payload = 'Hãy phân tích file SQL đính kèm này';
    }

    onSendMessage(payload, attachedFile || undefined);
    setValue('');
    setShowDropdown(false);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = '38px';
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Phím điều hướng khi menu lệnh gợi ý đang hiển thị
    if (showDropdown && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.altKey && !e.shiftKey)) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    // 2. Cho phép xuống dòng bằng Alt+Enter hoặc Shift+Enter (giữ nguyên con trỏ và căn lề)
    if (e.key === 'Enter' && (e.altKey || e.shiftKey)) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;
      const nextVal = currentVal.substring(0, start) + '\n' + currentVal.substring(end);
      
      setValue(nextVal);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        adjustHeight();
      });
      return;
    }

    // 3. Nhấn Enter đơn thuần (hoặc Ctrl+Enter) -> Thực thi gửi yêu cầu
    if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getCommandIcon = (type: SlashCommand['iconType']) => {
    switch (type) {
      case 'query':
        return <Terminal size={14} className="text-[var(--accent-blue)]" />;
      case 'tonkho':
        return <Boxes size={14} className="text-[var(--bravo-primary)]" />;
      case 'explain':
        return <HelpCircle size={14} className="text-amber-500" />;
      case 'optimize':
        return <SlidersHorizontal size={14} className="text-purple-400" />;
      case 'debug':
        return <Bug size={14} className="text-rose-500" />;
      case 'diff':
        return <GitCompare size={14} className="text-[var(--bravo-primary)]" />;
      case 'schema':
        return <Database size={14} className="text-amber-500" />;
      case 'convert':
        return <ArrowLeftRight size={14} className="text-[var(--sql-keyword)]" />;
      case 'learn':
        return <BookOpen size={14} className="text-emerald-400" />;
      default:
        return <Terminal size={14} className="text-[var(--bravo-primary)]" />;
    }
  };

  return (
    <div className="bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)] p-3 px-4 md:px-8 shrink-0 relative z-30">
      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sql,.txt,.prg"
        className="hidden"
        onChange={handleFallbackFileChange}
      />

      {/* Flow Mode Switcher (Tách bạch 2 luồng) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="inline-flex items-center gap-1 p-0.5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-md font-mono">
          <button
            type="button"
            onClick={() => handleSelectFlowMode('generate')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              flowMode === 'generate'
                ? 'bg-[var(--bravo-surface)] text-[var(--bravo-primary)] border border-[var(--bravo-border)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
            title="Luồng 1: Nhập yêu cầu nghiệp vụ bằng tiếng Việt -> Sinh câu lệnh SQL đã tối ưu chuẩn BRAVO ngay từ đầu"
          >
            1. Sinh SQL mới
          </button>
          <button
            type="button"
            onClick={() => handleSelectFlowMode('optimize')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              flowMode === 'optimize'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
            title="Luồng 2: Dán đoạn SQL thô bạn đã viết (hoặc đính kèm file .sql) -> Chẩn đoán điểm nghẽn và tối ưu"
          >
            2. Tối ưu SQL thô
          </button>
        </div>

        <span className="text-[11px] text-[var(--text-muted)] hidden md:inline font-mono">
          {flowMode === 'generate'
            ? 'Mô tả nghiệp vụ -> Sinh SQL chuẩn tối ưu BRAVO ngay từ đầu'
            : 'Dán code SQL thô của coder (hoặc đính kèm .sql) -> Review & Refactor'}
        </span>
      </div>

      {/* Attached file chip */}
      {attachedFile && (
        <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1 bg-[var(--bravo-surface)] border border-[var(--bravo-border)] rounded-lg text-xs text-[var(--text-primary)] shadow-2xs">
          <FileCode size={13} className="text-[var(--bravo-primary)]" />
          <span className="font-mono font-medium">{attachedFile.name}</span>
          {attachedFile.sizeBytes && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              ({(attachedFile.sizeBytes / 1024).toFixed(1)} KB)
            </span>
          )}
          {attachedFile.handle && (
            <span className="text-[10px] bg-[var(--bravo-primary)] text-white px-1.5 py-0.2 rounded font-medium">
              Smart-Patch Ready
            </span>
          )}
          <button
            onClick={() => onAttachFile && onAttachFile(null)}
            className="text-[var(--text-secondary)] hover:text-rose-500 p-0.5 rounded transition-colors ml-1 cursor-pointer"
            title="Gỡ file đính kèm"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Slash command dropdown */}
      {showDropdown && filteredCommands.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-4 md:left-8 right-4 md:right-8 mb-2 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
        >
          <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider flex items-center justify-between bg-[var(--bg-code-header)] font-mono">
            <span>
              {flowMode === 'optimize' ? 'Lệnh Luồng 2 · Tối ưu SQL thô' : 'Lệnh Luồng 1 · Sinh SQL mới'}
            </span>
            <span>Tab hoặc Enter để chọn</span>
          </div>

          <div className="p-1.5 space-y-0.5">
            {filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.command}
                  onClick={() => handleSelectCommand(cmd)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--bravo-surface)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--bg-code)] border border-[var(--border-subtle)]">
                      {getCommandIcon(cmd.iconType)}
                    </div>
                    <div>
                      <div className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {cmd.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {cmd.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cmd.shortcut && (
                      <kbd className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--bg-code)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Command input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl transition-all focus-within:border-[var(--bravo-primary)] focus-within:ring-2 focus-within:ring-[var(--bravo-surface)] shadow-2xs p-1 gap-1">
          {/* Attach file button */}
          <button
            type="button"
            onClick={handlePickFile}
            className="p-2 mb-0.5 text-[var(--text-secondary)] hover:text-[var(--bravo-primary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-colors cursor-pointer shrink-0"
            title="Đính kèm file .sql từ máy tính để phân tích hoặc ghi đè"
          >
            <Paperclip size={16} />
          </button>

          {/* Prompt prefix */}
          <div className="py-2.5 px-1.5 mb-0.5 text-[var(--text-muted)] font-mono text-[11px] font-semibold select-none shrink-0">
            SQL&gt;
          </div>

          <textarea
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            placeholder={
              flowMode === 'optimize'
                ? attachedFile
                  ? `Nhập ghi chú phạm vi tối ưu cho file "${attachedFile.name}" (hoặc Enter để tối ưu toàn bộ)...`
                  : 'Dán đoạn code SQL thô bạn đã tự viết (hoặc đính kèm file .sql) để AI phân tích điểm nghẽn & tối ưu...'
                : attachedFile
                  ? `Hỏi về file "${attachedFile.name}", hoặc gõ /convert, /explain...`
                  : 'Mô tả yêu cầu SQL bằng tiếng Việt để sinh code tối ưu, hoặc gõ / để chọn lệnh...'
            }
            className="flex-1 bg-transparent py-2.5 px-2 text-xs md:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none leading-relaxed whitespace-pre-wrap break-words font-sans selection:bg-[var(--bravo-surface)]"
            style={{ minHeight: '38px', maxHeight: '220px', tabSize: 4 }}
          />

          <div className="flex items-center shrink-0 pr-1 pb-1">
            <button
              type="submit"
              disabled={!value.trim() && !attachedFile}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                value.trim() || attachedFile
                  ? 'bg-[var(--bravo-primary)] hover:bg-[var(--bravo-primary-hover)] text-white shadow-xs cursor-pointer'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
              title="Gửi yêu cầu (Enter, Alt+Enter để xuống dòng)"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </form>

      {/* Hints footer */}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1.5 px-1 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <kbd className="font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">Attach</kbd> Đính kèm .sql
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">/</kbd> Lệnh nhanh
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">Ctrl+K</kbd> Khung lệnh
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">Alt+Enter</kbd> Xuống dòng
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">Enter</kbd> Thực thi
          </span>
        </div>
        <div className="hidden sm:inline-flex text-[var(--text-secondary)] font-mono text-[10px]">
          BRAVO B10 SQL Engine · T-SQL ⇄ PostgreSQL
        </div>
      </div>
    </div>
  );
};

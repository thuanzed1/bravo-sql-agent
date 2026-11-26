import React, { useEffect, useRef, useState } from 'react';
import { X, FileUp, Eraser } from 'lucide-react';
import type { KnowledgeRule } from '../types';
import { EXAMPLE_PROMPT_LIMIT } from '../data/knowledgeBase';
import type { LearnDraft } from '../data/knowledgeBase';

export type KnowledgeDraft = LearnDraft;

interface KnowledgeDialogProps {
  rule?: KnowledgeRule | null;
  onClose: () => void;
  onSave: (draft: KnowledgeDraft, editingId?: string) => void;
}

export const KnowledgeDialog: React.FC<KnowledgeDialogProps> = ({
  rule,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState(rule?.title ?? '');
  const [ruleText, setRuleText] = useState(rule?.ruleText ?? '');
  const [example, setExample] = useState(rule?.exampleGood ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnly = rule?.category === 'core';

  const canSave = !readOnly && title.trim().length > 0 && ruleText.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave(
      {
        title: title.trim(),
        ruleText: ruleText.trim(),
        exampleGood: example.trim() || undefined
      },
      rule?.id
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      setExample(text);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !readOnly) loadFile(file);
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || readOnly) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = example.slice(0, selectionStart) + '    ' + example.slice(selectionEnd);
    setExample(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 4;
    });
  };

  const lineCount = example ? example.split('\n').length : 0;
  const overLimit = example.length > EXAMPLE_PROMPT_LIMIT;

  const fieldClass =
    'w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--bravo-primary)] read-only:opacity-80';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {readOnly ? 'Quy tắc chuẩn BRAVO (chỉ xem)' : rule ? 'Chỉnh sửa tri thức' : 'Nạp tri thức mới cho AI'}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Quy tắc được lưu bền vững và áp dụng cho mọi phiên làm việc sau.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            title="Đóng (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tên quy tắc</label>
            <input
              type="text"
              value={title}
              readOnly={readOnly}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Luôn lọc vật tư ngừng sử dụng"
              className={fieldClass}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Nội dung quy tắc AI bắt buộc tuân thủ
            </label>
            <textarea
              rows={4}
              value={ruleText}
              readOnly={readOnly}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="Mô tả rõ điều kiện áp dụng và cách xử lý đúng"
              className={`${fieldClass} resize-y`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Code mẫu (tùy chọn)
              </label>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--bravo-primary)] hover:bg-[var(--bravo-surface)] cursor-pointer"
                  >
                    <FileUp size={12} /> Tải file .sql
                  </button>
                  {example && (
                    <button
                      type="button"
                      onClick={() => setExample('')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                    >
                      <Eraser size={12} /> Xóa
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt,.prg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadFile(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            <textarea
              value={example}
              readOnly={readOnly}
              onChange={(e) => setExample(e.target.value)}
              onKeyDown={handleTab}
              onDragOver={(e) => {
                e.preventDefault();
                if (!readOnly) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              spellCheck={false}
              placeholder="Dán code SQL vào đây, hoặc kéo thả / tải file .sql"
              className={`${fieldClass} font-mono text-[12px] leading-relaxed min-h-[260px] resize-y whitespace-pre overflow-auto ${
                isDragging ? 'border-[var(--bravo-primary)] bg-[var(--bravo-surface)]' : ''
              }`}
            />

            <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--text-muted)]">
              <span>{lineCount} dòng, {example.length.toLocaleString('vi-VN')} ký tự</span>
              {overLimit && (
                <span className="text-amber-400">
                  Chỉ {EXAMPLE_PROMPT_LIMIT.toLocaleString('vi-VN')} ký tự đầu được gửi cho AI
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-muted)]">
            {readOnly ? 'Quy tắc gốc không chỉnh sửa được, chỉ bật/tắt.' : 'Ctrl+Enter để lưu, Esc để đóng'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            >
              {readOnly ? 'Đóng' : 'Hủy'}
            </button>
            {!readOnly && (
              <button
                onClick={submit}
                disabled={!canSave}
                className="px-4 py-1.5 rounded-md bg-[var(--bravo-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Lưu quy tắc
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

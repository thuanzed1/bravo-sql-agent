import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, ChevronRight, ChevronDown, CheckCircle, Lightbulb, Loader2, Cpu, FileCode, Terminal, ArrowRight } from 'lucide-react';
import type { AgentFlowType, ChatMessage, SqlDialect, FileWriteMode, PatchAnalysisResult } from '../types';

const FLOW_BADGE_MAP: Record<AgentFlowType, { label: string; className: string }> = {
  generate: {
    label: 'Luồng 1 · Sinh SQL mới',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  },
  optimize: {
    label: 'Luồng 2 · Tối ưu SQL thô',
    className: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
  },
  convert: {
    label: 'Chuyển đổi cú pháp',
    className: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
  },
  assist: {
    label: 'Phân tích & Tra cứu',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  }
};
import { SqlBlock } from './SqlBlock';
import { ResultTable } from './ResultTable';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SAMPLE_PROMPTS } from '../data/quanLyKhoSchema';
import { detectTargetRoutineInFile } from '../services/sqlAgentService';

interface ConversationAreaProps {
  messages: ChatMessage[];
  databaseName?: string;
  isGenerating?: boolean;
  onSelectPrompt: (prompt: string) => void;
  onRunSql: (sql: string) => void;
  onSaveQuery: (title: string, sql: string) => void;
  onSaveToFile?: (sql: string, mode: FileWriteMode, fileHandle?: any, targetRoutineName?: string) => Promise<{ success: boolean; analysis: PatchAnalysisResult } | boolean>;
  onOverwriteFile?: (sql: string, fileHandle?: any) => Promise<boolean>;
  onConvertSql?: (sql: string, targetDialect: SqlDialect) => void;
  activeFileHandle?: any;
  activeFileName?: string;
  onRequestPreviewPatch?: (
    sql: string,
    mode: FileWriteMode,
    onSuccess?: () => void,
    targetFile?: { name: string; content?: string; sizeBytes?: number; handle?: any } | null,
    targetRoutineName?: string
  ) => void;
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  messages,
  databaseName = 'Quan_Ly_Kho_Hang',
  isGenerating = false,
  onSelectPrompt,
  onRunSql,
  onSaveQuery,
  onSaveToFile,
  onOverwriteFile,
  onConvertSql,
  activeFileHandle,
  activeFileName,
  onRequestPreviewPatch
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openReasonings, setOpenReasonings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const toggleReasoning = (id: string) => {
    setOpenReasonings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 md:px-8 py-6 bg-[var(--bg-workspace)] flex flex-col gap-5"
    >
      {/* Welcome state */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8 select-none">
          <div className="w-13 h-13 rounded-2xl bg-[var(--bravo-primary)] flex items-center justify-center text-white shadow-md mb-4">
            <Terminal size={26} />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1.5">
            Bravo Studio — Trợ lý Lập trình CSDL
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6 max-w-xl leading-relaxed">
            Hoạt động theo <strong>2 luồng tách biệt</strong>: <strong>(1) Sinh SQL mới chuẩn tối ưu BRAVO</strong> từ mô tả tiếng Việt, hoặc <strong>(2) Tối ưu code SQL thô</strong> do lập trình viên đã dựng sẵn (dán code / đính kèm file <code>.sql</code> với <code>/optimize</code>) kèm Smart Patch.
          </p>

          <div className="w-full">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 text-left">
              Truy vấn mẫu gợi ý (Click để chạy thử trên {databaseName}):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full text-left p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--bravo-primary)] hover:bg-[var(--bg-elevated)] text-xs text-[var(--text-primary)] transition-all flex items-start justify-between gap-2 group cursor-pointer shadow-2xs"
                >
                  <span className="leading-snug line-clamp-2">{prompt}</span>
                  <ArrowRight
                    size={13}
                    className="text-[var(--bravo-primary)] opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages stream */}
      {messages.map((msg, msgIdx) => {
        const isUser = msg.role === 'user';
        const isReasoningOpen = openReasonings[msg.id] ?? false;
        const prevUserMsg = !isUser
          ? messages.slice(0, msgIdx).reverse().find(m => m.role === 'user')
          : undefined;
        const inferredTargetRoutine =
          msg.targetRoutineName ||
          (prevUserMsg && msg.attachedFile?.content
            ? detectTargetRoutineInFile(prevUserMsg.content, msg.attachedFile.content)?.name
            : undefined);

        return (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-4xl w-full ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
          >
            {/* Avatar for agent */}
            {!isUser && (
              <div className="w-7 h-7 rounded-lg bg-[var(--bravo-surface)] border border-[var(--bravo-border)] flex items-center justify-center text-[var(--bravo-primary)] shrink-0 mt-0.5 shadow-2xs">
                <Bot size={15} />
              </div>
            )}

            {/* Content Container */}
            <div className={`flex flex-col min-w-0 ${isUser ? 'max-w-[85%] items-end' : 'flex-1'}`}>
              
              {/* Header meta */}
              <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {isUser ? 'Bạn' : 'Bravo Studio'}
                </span>
                <span>·</span>
                <span className="text-[var(--text-muted)]">{msg.timestamp}</span>

                {/* Provider used badge */}
                {msg.providerUsed && (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.2 rounded border border-[var(--border-default)]">
                    <Cpu size={10} className="text-[var(--bravo-primary)]" />
                    <span>{msg.providerUsed}</span>
                  </span>
                )}

                {/* Flow badge */}
                {!isUser && msg.flowType && FLOW_BADGE_MAP[msg.flowType] && (
                  <span className={`font-medium text-[10px] px-1.5 py-0.2 rounded border ${FLOW_BADGE_MAP[msg.flowType].className}`}>
                    {FLOW_BADGE_MAP[msg.flowType].label}
                  </span>
                )}

                {/* Command badge */}
                {msg.commandType && (
                  <span className="font-mono text-[10px] text-[var(--accent-blue)] bg-[var(--accent-blue-surface)] px-1.5 py-0.2 rounded border border-[var(--accent-blue-border)]">
                    {msg.commandType}
                  </span>
                )}

                {/* RAG chunk count badge */}
                {msg.ragChunkCount && (
                  <span className="text-[10px] text-[var(--bravo-primary)] bg-[var(--bravo-surface)] px-1.5 py-0.2 rounded border border-[var(--bravo-border)]">
                    RAG: {msg.ragChunkCount} rules
                  </span>
                )}
              </div>

              {/* Message Box */}
              <div
                className={`rounded-xl p-3.5 text-xs leading-relaxed shadow-xs w-full ${
                  isUser
                    ? 'bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] border border-[var(--user-bubble-border)] font-medium self-end rounded-tr-xs'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-tl-xs'
                }`}
              >
                {/* Attached File Chip (if user attached a file) */}
                {msg.attachedFile && (
                  <div className="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/20 border border-white/20 rounded-md text-[11px] font-mono">
                    <FileCode size={12} />
                    <span>File: {msg.attachedFile.name}</span>
                    {msg.attachedFile.sizeBytes && (
                      <span className="opacity-75">({(msg.attachedFile.sizeBytes / 1024).toFixed(1)} KB)</span>
                    )}
                  </div>
                )}

                {/* Collapsible RAG Reasoning Steps */}
                {!isUser && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                  <div className="mb-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-code)] overflow-hidden">
                    <button
                      onClick={() => toggleReasoning(msg.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-code-header)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[11px] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        {isReasoningOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="font-medium">Quá trình suy luận nghiệp vụ ({msg.reasoningSteps.length} bước)</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--bravo-primary)]">Hoàn tất</span>
                    </button>

                    {isReasoningOpen && (
                      <div className="p-2.5 space-y-1.5 bg-[var(--bg-code)] border-t border-[var(--border-subtle)]">
                        {msg.reasoningSteps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                            <CheckCircle size={11} className="text-[var(--bravo-primary)] shrink-0" />
                            <span>{step.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Text Content with Rich Markdown Rendering (Headers, Tables, Badges, Lists) */}
                {isUser ? (
                  <div className="whitespace-pre-wrap font-sans text-[13px]">{msg.content}</div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}

                {/* SQL Block with Smart File Save / Patch support & Dialect Convert */}
                {!isUser && msg.sql && (
                  <SqlBlock
                    sql={msg.sql}
                    title={msg.sqlTitle}
                    sqlDialect={msg.sqlDialect || 'tsql'}
                    onRun={(sql) => onRunSql(sql)}
                    onSaveToFile={onSaveToFile ? (newSql, mode) => onSaveToFile(newSql, mode, msg.attachedFile?.handle || activeFileHandle, inferredTargetRoutine) : undefined}
                    onOverwriteFile={onOverwriteFile ? (newSql) => onOverwriteFile(newSql, msg.attachedFile?.handle || activeFileHandle) : undefined}
                    onConvertSql={onConvertSql}
                    attachedFileName={msg.attachedFile?.name || activeFileName}
                    hasFileHandle={Boolean(msg.attachedFile?.handle || activeFileHandle)}
                    onRequestPreviewPatch={onRequestPreviewPatch ? (sql, mode, onSuccess) => {
                      const targetFile = msg.attachedFile || (activeFileName ? { name: activeFileName, content: '', handle: activeFileHandle } : null);
                      onRequestPreviewPatch(sql, mode, onSuccess, targetFile, inferredTargetRoutine);
                    } : undefined}
                  />
                )}

                {/* Result Table */}
                {!isUser && msg.result && (
                  <ResultTable
                    result={msg.result}
                    databaseName={databaseName}
                    onSaveQuery={() => msg.sql && onSaveQuery(msg.sqlTitle || 'Truy vấn đã lưu', msg.sql)}
                  />
                )}

                {/* Contextual Tips */}
                {!isUser && msg.tips && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="leading-snug flex-1">
                      <MarkdownRenderer content={msg.tips} className="text-[11px]" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar for user */}
            {isUser && (
              <div className="w-7 h-7 rounded-lg bg-[var(--bravo-primary)] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                <User size={15} />
              </div>
            )}
          </div>
        );
      })}

      {/* Loading state */}
      {isGenerating && (
        <div className="flex gap-3 max-w-4xl mr-auto justify-start">
          <div className="w-7 h-7 rounded-lg bg-[var(--bravo-surface)] border border-[var(--bravo-border)] flex items-center justify-center text-[var(--bravo-primary)] shrink-0 mt-0.5 shadow-2xs">
            <Bot size={15} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="rounded-xl p-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-tl-xs flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
              <Loader2 size={15} className="animate-spin text-[var(--bravo-primary)]" />
              <span>Đang phân tích cấu trúc bảng &amp; sinh mã SQL chuẩn BRAVO...</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

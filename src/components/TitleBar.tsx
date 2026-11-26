import React from 'react';
import { Database, Cpu, Sun, Moon, Play } from 'lucide-react';
import type { AiConfig } from '../types';

interface TitleBarProps {
  aiConfig: AiConfig;
  databaseName?: string;
  tableCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenSettings: () => void;
  onFocusCommandBar: () => void;
  onNewSession?: () => void;
  onOpenSchema?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  aiConfig, 
  databaseName = 'Quan_Ly_Kho_Hang',
  tableCount = 5,
  theme = 'dark',
  onToggleTheme,
  onOpenSettings, 
  onFocusCommandBar,
  onNewSession,
  onOpenSchema
}) => {
  const getProviderBadge = () => {
    switch (aiConfig.provider) {
      case 'groq':
        return {
          label: `Groq · ${aiConfig.model}`,
          dot: 'bg-orange-500',
          style: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
        };
      case 'openai':
        return {
          label: `OpenAI · ${aiConfig.model}`,
          dot: 'bg-emerald-500',
          style: 'bg-[var(--bravo-surface)] text-[var(--bravo-primary)] border-[var(--bravo-border)]'
        };
      case 'gemini':
        return {
          label: `Gemini · ${aiConfig.model}`,
          dot: 'bg-blue-500',
          style: 'bg-[var(--accent-blue-surface)] text-[var(--accent-blue)] border-[var(--accent-blue-border)]'
        };
      case 'ollama':
        return {
          label: `Ollama · ${aiConfig.model}`,
          dot: 'bg-purple-500',
          style: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
        };
      case 'mock':
      default:
        return {
          label: 'Offline RAG Engine',
          dot: 'bg-amber-500',
          style: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]'
        };
    }
  };

  const badge = getProviderBadge();

  return (
    <header className="h-[38px] bg-[var(--bg-titlebar)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 shrink-0 select-none text-xs">
      {/* Left: Bravo Brand + Studio Menu Bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[var(--bravo-primary)] flex items-center justify-center text-white font-bold text-[11px] font-mono shadow-xs">
            B
          </div>
          <span className="font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-1.5">
            Bravo Studio
          </span>
        </div>

        <div className="h-3.5 w-[1px] bg-[var(--border-default)] hidden md:block" />

        {/* Functional IDE Menu Items */}
        <nav className="hidden md:flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="px-2 py-1 rounded hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Tạo phiên truy vấn mới"
            >
              Tệp mới
            </button>
          )}
          {onOpenSchema && (
            <button
              onClick={onOpenSchema}
              className="px-2 py-1 rounded hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Mở cấu trúc bảng & Nhập Database"
            >
              Cơ sở dữ liệu
            </button>
          )}
          <button
            onClick={onFocusCommandBar}
            className="px-2 py-1 rounded hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Chuyển tới khung lệnh AI (Ctrl+K)"
          >
            Truy vấn AI
          </button>
          <button
            onClick={onOpenSettings}
            className="px-2 py-1 rounded hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Cấu hình mô hình LLM & Kết nối"
          >
            Cấu hình
          </button>
        </nav>
      </div>

      {/* Center: Bravo IDE Connection Bar */}
      <div className="flex items-center gap-2">
        <div 
          onClick={onOpenSchema}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--bravo-primary)] text-[11px] text-[var(--text-primary)] font-medium cursor-pointer transition-colors shadow-2xs"
          title="Click để xem Schema hoặc nạp Database mới"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--bravo-primary)] animate-pulse" />
          <Database size={12} className="text-[var(--bravo-primary)]" />
          <span className="font-mono">{databaseName}</span>
          <span className="text-[10px] text-[var(--text-muted)] font-normal hidden sm:inline">
            ({tableCount} bảng)
          </span>
        </div>

        <button
          onClick={onFocusCommandBar}
          className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bravo-primary)] hover:bg-[var(--bravo-primary-hover)] text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
          title="Đặt câu hỏi hoặc chạy lệnh SQL (Ctrl+K)"
        >
          <Play size={10} fill="currentColor" />
          <span>Hỏi AI</span>
        </button>
      </div>

      {/* Right: AI Model Tag & Theme Switcher */}
      <div className="flex items-center gap-2">
        {/* Active AI Model Badge */}
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer hover:opacity-90 transition-all ${badge.style}`}
          title="Bấm để đổi mô hình AI (OpenAI, Gemini, Ollama)"
        >
          <Cpu size={12} />
          <span className="font-mono hidden sm:inline">{badge.label}</span>
        </button>

        {/* Theme Toggle Button (Dark / Light Mode) */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={13} className="text-amber-400" />
                <span className="text-[11px] hidden xl:inline">Sáng</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-indigo-600" />
                <span className="text-[11px] hidden xl:inline">Tối</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

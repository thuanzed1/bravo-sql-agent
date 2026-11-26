import React from 'react';
import { MessageSquare, History, Bookmark, Database, Settings, BookOpen } from 'lucide-react';
import type { PanelType } from '../types';

interface ActivityBarProps {
  activePanel: PanelType;
  onTogglePanel: (panel: PanelType) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activePanel, onTogglePanel }) => {
  const navItems = [
    { id: 'chat' as PanelType, icon: MessageSquare, label: 'Phiên làm việc SQL', shortcut: 'Ctrl+1' },
    { id: 'rules' as PanelType, icon: BookOpen, label: 'Kho Tri Thức & Quy Tắc', shortcut: 'Ctrl+5' },
    { id: 'schema' as PanelType, icon: Database, label: 'Cấu trúc Database (Schema)', shortcut: 'Ctrl+4' },
    { id: 'history' as PanelType, icon: History, label: 'Nhật ký truy vấn', shortcut: 'Ctrl+2' },
    { id: 'saved' as PanelType, icon: Bookmark, label: 'Thư viện truy vấn mẫu', shortcut: 'Ctrl+3' },
  ];

  return (
    <div className="w-[46px] bg-[var(--bg-activity)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2.5 gap-1.5 shrink-0 select-none z-20">
      {/* Main navigation icons */}
      <div className="flex flex-col gap-1.5 w-full items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <div key={item.id} className="relative group flex justify-center w-full">
              <button
                onClick={() => onTogglePanel(isActive ? null : item.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer relative ${
                  isActive
                    ? 'text-[var(--bravo-primary)] bg-[var(--bravo-surface)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
                aria-label={item.label}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[var(--bravo-primary)] rounded-r-full" />
                )}
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
              </button>

              {/* Tooltip */}
              <div className="absolute left-[50px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-md text-xs text-[var(--text-primary)] whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-2">
                <span className="font-medium">{item.label}</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-mono bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                  {item.shortcut}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Settings icon */}
      <div className="relative group flex justify-center w-full">
        <button
          onClick={() => onTogglePanel(activePanel === 'settings' ? null : 'settings')}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer relative ${
            activePanel === 'settings'
              ? 'text-[var(--bravo-primary)] bg-[var(--bravo-surface)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          }`}
          aria-label="Cài đặt"
        >
          {activePanel === 'settings' && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[var(--bravo-primary)] rounded-r-full" />
          )}
          <Settings size={18} strokeWidth={1.75} />
        </button>
        <div className="absolute left-[50px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-md text-xs text-[var(--text-primary)] whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Cấu hình AI &amp; Kết nối DB
        </div>
      </div>
    </div>
  );
};

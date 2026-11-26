import React from 'react';
import { Database, Activity, Check, ShieldCheck, Server } from 'lucide-react';

interface StatusBarProps {
  lastExecution?: {
    rows: number;
    timeSec: number;
  };
  databaseName?: string;
  tableCount?: number;
  isLiveDb?: boolean;
  serverName?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  lastExecution,
  databaseName = 'Quan_Ly_Kho_Hang',
  tableCount = 6,
  isLiveDb = false,
  serverName = 'localhost'
}) => {
  return (
    <footer className="h-[24px] bg-[var(--bg-titlebar)] text-[var(--text-secondary)] flex items-center justify-between px-3 text-[11px] select-none font-mono shrink-0 z-40 border-t border-[var(--border-subtle)]">
      {/* Left items: Bravo IDE version & DB connection */}
      <div className="flex items-center gap-2.5">
        <span className="font-semibold text-[var(--text-primary)]">
          Bravo Studio 1.0
        </span>

        <span className="text-[var(--border-strong)]">|</span>

        <div className="flex items-center gap-1.5 font-sans font-medium text-[var(--bravo-primary)]">
          <span className={`w-1.5 h-1.5 rounded-full ${isLiveDb ? 'bg-emerald-400 animate-pulse' : 'bg-[var(--bravo-primary)]'}`} />
          <span>{isLiveDb ? 'SQL Server Live' : 'Connected'}</span>
        </div>

        <span className="text-[var(--border-strong)]">·</span>

        <div className="flex items-center gap-1 text-[var(--text-primary)] font-sans">
          {isLiveDb ? (
            <Server size={11} className="text-emerald-400" />
          ) : (
            <Database size={11} className="text-[var(--bravo-primary)]" />
          )}
          <span className="font-mono">{databaseName}</span>
          {isLiveDb && serverName && (
            <span className="text-[10px] text-emerald-400/80">[{serverName}]</span>
          )}
          <span className="text-[var(--text-muted)] text-[10px]">({tableCount} tables)</span>
        </div>

        <span className="text-[var(--border-strong)] hidden sm:inline">|</span>

        <span className="text-[var(--text-muted)] hidden sm:inline">
          T-SQL / SQL Server 2022
        </span>
      </div>

      {/* Right items: Execution stats & Encoding */}
      <div className="flex items-center gap-3">
        {lastExecution && (
          <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
            <Activity size={11} className="text-[var(--bravo-primary)]" />
            <span>{lastExecution.rows} dòng</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>{lastExecution.timeSec}s</span>
            <span className="text-[var(--border-strong)] ml-1">|</span>
          </div>
        )}

        <div className="hidden md:flex items-center gap-1 text-[var(--text-muted)]">
          <ShieldCheck size={11} className="text-[var(--bravo-primary)]" />
          <span>BRAVO Standard</span>
          <span className="text-[var(--border-strong)] ml-1">|</span>
        </div>

        <div className="flex items-center gap-1 text-[var(--text-secondary)]">
          <Check size={11} className="text-[var(--bravo-primary)]" />
          <span>UTF-8</span>
        </div>
      </div>
    </footer>
  );
};

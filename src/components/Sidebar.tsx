import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Search, Table, Key, ChevronRight, ChevronDown, 
  ExternalLink, Play, Clock, CheckCircle2, XCircle, Trash2, 
  BookmarkCheck, Server, Cpu, Eye, EyeOff, Check, AlertCircle, Loader2,
  FolderUp, MessageSquare, RefreshCw, X, Database,
  BookOpen, Download, Upload, RotateCcw
} from 'lucide-react';
import type { PanelType, ChatSession, HistoryItem, SavedQuery, AiConfig, AiProvider, TableSchema, TableRelationship, SyncResult, KnowledgeRule } from '../types';
import { DEFAULT_AI_CONFIGS, PROVIDER_MODELS, parseApiKeys, testAiConnection } from '../services/aiClient';
import { parseSqlDdl } from '../services/schemaParser';
import { listDatabasesFromDb } from '../services/backendApi';

interface SidebarProps {
  activePanel: PanelType;
  sessions: ChatSession[];
  currentSessionId: string;
  history: HistoryItem[];
  savedQueries: SavedQuery[];
  aiConfig: AiConfig;
  tables: TableSchema[];
  relationships: TableRelationship[];
  databaseName: string;
  rules: KnowledgeRule[];
  onImportDatabase: (result: { databaseName: string; tables: TableSchema[]; relationships: TableRelationship[] }) => void;
  onUpdateAiConfig: (config: AiConfig) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onRunQuery: (sql: string) => void;
  onInsertPrompt: (text: string) => void;
  onSyncLiveDb?: () => Promise<SyncResult>;
  onSwitchDatabase?: (dbName: string) => Promise<SyncResult>;
  onOpenRuleDialog: (rule?: KnowledgeRule) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  onImportRules: (rules: KnowledgeRule[]) => void;
  onResetRules: () => void;
  isLiveDb?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  sessions,
  currentSessionId,
  history,
  savedQueries,
  aiConfig,
  tables,
  relationships,
  databaseName,
  rules,
  onImportDatabase,
  onUpdateAiConfig,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRunQuery,
  onInsertPrompt,
  onSyncLiveDb,
  onSwitchDatabase,
  onOpenRuleDialog,
  onToggleRule,
  onDeleteRule,
  onImportRules,
  onResetRules,
  isLiveDb
}) => {
  const [schemaSearch, setSchemaSearch] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; success?: boolean } | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCard, setSyncCard] = useState<{
    success: boolean;
    message: string;
    details?: {
      databaseName?: string;
      serverName?: string;
      tableCount?: number;
      totalRows?: number;
      latencyMs?: number;
    };
  } | null>(null);
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    'DMVT': true,
    'Ton_Dau': true
  });
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge base state
  const [ruleFilter, setRuleFilter] = useState<'all' | 'core' | 'custom' | 'learned'>('all');
  const [ruleSearch, setRuleSearch] = useState('');

  const filteredRules = rules.filter(r => {
    const matchCat = ruleFilter === 'all' || r.category === ruleFilter;
    const matchSearch = !ruleSearch.trim() || 
      r.title.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      r.ruleText.toLowerCase().includes(ruleSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleExportRules = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rules, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `bravo_knowledge_rules_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportRulesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '[]'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          onImportRules(parsed);
        } else {
          alert('File JSON không hợp lệ hoặc danh sách rỗng.');
        }
      } catch {
        alert('Không thể đọc file JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (activePanel === 'schema' && isLiveDb) {
      listDatabasesFromDb().then((dbs) => {
        if (dbs && dbs.length > 0) {
          setAvailableDbs(dbs);
        }
      });
    }
  }, [activePanel, isLiveDb]);

  if (!activePanel) return null;

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    t.columns.some(c => c.name.toLowerCase().includes(schemaSearch.toLowerCase()))
  );

  const loadStoredProviderKeys = (): Partial<Record<AiProvider, string>> => {
    try {
      const raw = localStorage.getItem('bravo_provider_keys_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveStoredProviderKey = (provider: AiProvider, key: string) => {
    try {
      const map = loadStoredProviderKeys();
      map[provider] = key;
      localStorage.setItem('bravo_provider_keys_v1', JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const handleProviderChange = (provider: AiProvider) => {
    // Lưu lại key hiện tại của provider cũ trước khi chuyển
    if (aiConfig.apiKey) {
      saveStoredProviderKey(aiConfig.provider, aiConfig.apiKey);
    }

    const storedKeys = loadStoredProviderKeys();
    const fallbackDef = DEFAULT_AI_CONFIGS[provider];
    const restoredKey = storedKeys[provider] ?? fallbackDef.apiKey ?? '';

    onUpdateAiConfig({
      ...aiConfig,
      provider,
      model: fallbackDef.model,
      baseUrl: fallbackDef.baseUrl,
      apiKey: restoredKey
    });
    setTestStatus(null);
  };

  const handleApiKeyChange = (newKey: string) => {
    saveStoredProviderKey(aiConfig.provider, newKey);
    onUpdateAiConfig({ ...aiConfig, apiKey: newKey });
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    const res = await testAiConnection(aiConfig);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.message + (res.latencyMs ? ` (${res.latencyMs}ms)` : '')
    });
  };

  const handleTriggerSync = async () => {
    if (!onSyncLiveDb || isSyncing) return;
    setIsSyncing(true);
    setSyncCard(null);

    try {
      const res = await onSyncLiveDb();
      if (res.success) {
        setSyncCard({
          success: true,
          message: res.message || 'Đồng bộ thành công từ SQL Server',
          details: {
            databaseName: res.databaseName,
            serverName: res.serverName,
            tableCount: res.tableCount,
            totalRows: res.totalRows,
            latencyMs: res.latencyMs
          }
        });
      } else {
        setSyncCard({
          success: false,
          message: res.message || 'Đồng bộ thất bại. Vui lòng kiểm tra lại SQL Server.'
        });
      }
    } catch (err: any) {
      setSyncCard({
        success: false,
        message: err.message || 'Lỗi kết nối tới Backend SQL Server.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectDb = async (newDb: string) => {
    if (!onSwitchDatabase || newDb === databaseName || isSyncing) return;
    setIsSyncing(true);
    setSyncCard(null);
    try {
      const res = await onSwitchDatabase(newDb);
      if (res.success) {
        setSyncCard({
          success: true,
          message: `Đã chuyển sang CSDL [${newDb}]`,
          details: {
            databaseName: res.databaseName,
            serverName: res.serverName,
            tableCount: res.tableCount,
            totalRows: res.totalRows,
            latencyMs: res.latencyMs
          }
        });
      } else {
        setSyncCard({
          success: false,
          message: res.message || `Không thể chuyển sang CSDL [${newDb}]`
        });
      }
    } catch (err: any) {
      setSyncCard({
        success: false,
        message: err.message || `Lỗi khi chuyển CSDL sang [${newDb}]`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportDbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      try {
        const parsed = parseSqlDdl(content);
        if (parsed.tables.length === 0) {
          alert('Không tìm thấy câu lệnh CREATE TABLE hợp lệ trong file SQL.');
          return;
        }
        onImportDatabase(parsed);
        setImportStatus(`Đã nạp ${parsed.tables.length} bảng từ database "${parsed.databaseName}"!`);
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err: any) {
        alert('Lỗi phân tích file SQL: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <aside className="w-[290px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col h-full shrink-0 select-none overflow-hidden">
      {/* Hidden input for DDL import */}
      <input
        ref={dbFileInputRef}
        type="file"
        accept=".sql,.txt,.ddl"
        className="hidden"
        onChange={handleImportDbFile}
      />

      {/* Chat sessions panel */}
      {activePanel === 'chat' && (
        <div className="flex flex-col h-full">
          <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <span className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
              Phiên làm việc
            </span>
            <button
              onClick={onCreateSession}
              className="flex items-center gap-1 bg-[var(--bravo-primary)] hover:bg-[var(--bravo-primary-hover)] text-white px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              <Plus size={13} />
              <span>Phiên mới</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {sessions.map((s) => {
              const isSelected = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`group p-2.5 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[var(--bravo-surface)] border-[var(--bravo-border)] text-[var(--text-primary)] shadow-2xs'
                      : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MessageSquare
                        size={13}
                        className={isSelected ? 'text-[var(--bravo-primary)] shrink-0' : 'text-[var(--text-muted)] shrink-0'}
                      />
                      <div className="font-medium text-xs truncate leading-snug">{s.title}</div>
                    </div>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-500 p-0.5 transition-opacity cursor-pointer"
                        title="Xoá phiên"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1.5 pl-5 flex items-center justify-between">
                    <span>{s.lastActive}</span>
                    <span className="font-mono">{s.messages.length} msg</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History panel */}
      {activePanel === 'history' && (
        <div className="flex flex-col h-full">
          <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)]">
            <span className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
              Nhật ký truy vấn
            </span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Các câu lệnh SQL đã chạy gần đây</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--text-muted)]">Chưa có lịch sử truy vấn</div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--bravo-border)] transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                      <Clock size={11} /> {h.timestamp}
                    </span>
                    <span className="flex items-center gap-1">
                      {h.status === 'success' ? (
                        <CheckCircle2 size={12} className="text-[var(--bravo-primary)]" />
                      ) : (
                        <XCircle size={12} className="text-rose-500" />
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{h.executionTimeSec}s</span>
                    </span>
                  </div>
                  <pre className="font-mono text-[11px] text-[var(--sql-function)] line-clamp-2 bg-[var(--bg-code)] p-1.5 rounded border border-[var(--border-subtle)] overflow-x-hidden">
                    {h.sql}
                  </pre>
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button
                      onClick={() => onRunQuery(h.sql)}
                      className="text-[11px] flex items-center gap-1 text-[var(--bravo-primary)] hover:opacity-85 px-2 py-0.5 rounded bg-[var(--bravo-surface)] border border-[var(--bravo-border)] font-medium cursor-pointer"
                    >
                      <Play size={10} fill="currentColor" /> Chạy lại
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Saved queries panel */}
      {activePanel === 'saved' && (
        <div className="flex flex-col h-full">
          <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)]">
            <span className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
              Thư viện truy vấn
            </span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Mẫu câu lệnh nghiệp vụ kho BRAVO</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {savedQueries.map((q) => (
              <div
                key={q.id}
                className="p-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--bravo-border)] transition-colors"
              >
                <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--text-primary)] mb-1.5">
                  <BookmarkCheck size={13} className="text-amber-500 shrink-0" />
                  <span className="truncate">{q.title}</span>
                </div>
                <pre className="font-mono text-[11px] text-[var(--text-secondary)] line-clamp-2 bg-[var(--bg-code)] p-1.5 rounded border border-[var(--border-subtle)]">
                  {q.sql}
                </pre>
                <div className="flex justify-end items-center gap-2 mt-2">
                  <button
                    onClick={() => onInsertPrompt('/query ' + q.title)}
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1.5 py-0.5 cursor-pointer"
                  >
                    Dán vào lệnh
                  </button>
                  <button
                    onClick={() => onRunQuery(q.sql)}
                    className="text-[11px] flex items-center gap-1 text-[var(--bravo-primary)] hover:opacity-85 px-2 py-0.5 rounded bg-[var(--bravo-surface)] border border-[var(--bravo-border)] font-medium cursor-pointer"
                  >
                    <Play size={10} fill="currentColor" /> Chạy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Base panel */}
      {activePanel === 'rules' && (
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} className="text-[var(--bravo-primary)]" />
                  Kho Tri Thức & Quy Tắc
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {rules.filter(r => r.enabled).length}/{rules.length} quy tắc đang kích hoạt
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleExportRules}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded cursor-pointer"
                  title="Xuất file JSON toàn bộ quy tắc"
                >
                  <Download size={13} />
                </button>
                <label
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded cursor-pointer"
                  title="Nhập file JSON quy tắc mới"
                >
                  <Upload size={13} />
                  <input type="file" accept=".json" onChange={handleImportRulesFile} className="hidden" />
                </label>
                <button
                  onClick={onResetRules}
                  className="p-1.5 text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-elevated)] rounded cursor-pointer"
                  title="Khôi phục về bộ quy tắc chuẩn gốc BRAVO"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Quick Add Button */}
            <button
              onClick={() => onOpenRuleDialog()}
              className="w-full py-1.5 px-2 bg-[var(--bravo-surface)] hover:bg-[var(--bravo-border)] text-[var(--bravo-primary)] border border-[var(--bravo-border)] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={13} />
              <span>Nạp thêm tri thức mới</span>
            </button>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5">
              {(['all', 'core', 'custom', 'learned'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRuleFilter(tab)}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                    ruleFilter === tab
                      ? 'bg-[var(--bravo-surface)] text-[var(--bravo-primary)] font-semibold border border-[var(--bravo-border)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  {tab === 'all' && `Tất cả (${rules.length})`}
                  {tab === 'core' && `BRAVO Core (${rules.filter(r => r.category === 'core').length})`}
                  {tab === 'custom' && `Tùy chỉnh (${rules.filter(r => r.category === 'custom').length})`}
                  {tab === 'learned' && `AI tự học (${rules.filter(r => r.category === 'learned').length})`}
                </button>
              ))}
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Tìm quy tắc hoặc từ khóa..."
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md pl-7 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--bravo-primary)]"
              />
            </div>
          </div>

          {/* Rules List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  rule.enabled
                    ? 'border-[var(--border-default)] bg-[var(--bg-card)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleRule(rule.id)}
                      className="rounded accent-[var(--bravo-primary)] cursor-pointer"
                      title={rule.enabled ? 'Đang kích hoạt (Click để tắt)' : 'Đang tắt (Click để bật)'}
                    />
                    <span className="font-semibold text-xs text-[var(--text-primary)] truncate">
                      {rule.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      rule.category === 'core'
                        ? 'text-[var(--bravo-primary)] bg-[var(--bravo-surface)] border border-[var(--bravo-border)]'
                        : rule.category === 'learned'
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        : 'text-purple-400 bg-purple-500/10 border border-purple-500/20'
                    }`}>
                      {rule.category === 'core' ? 'BRAVO Core' : rule.category === 'learned' ? 'AI Tự học' : 'Tùy chỉnh'}
                    </span>
                    {rule.category !== 'core' && (
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                        title="Xóa quy tắc này"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-3">
                  {rule.ruleText}
                </p>

                <div className="flex items-center justify-between mt-1.5">
                  {rule.exampleGood ? (
                    <span className="text-[10px] font-mono text-emerald-400">
                      Có code mẫu ({rule.exampleGood.split('\n').length} dòng)
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => onOpenRuleDialog(rule)}
                    className="text-[11px] text-[var(--bravo-primary)] hover:underline cursor-pointer"
                  >
                    {rule.category === 'core' ? 'Xem chi tiết' : 'Xem / Sửa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schema browser panel */}
      {activePanel === 'schema' && (
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Database size={13} className="text-emerald-400 shrink-0" />
                {isLiveDb && availableDbs.length > 0 ? (
                  <select
                    value={databaseName}
                    onChange={(e) => handleSelectDb(e.target.value)}
                    disabled={isSyncing}
                    className="font-semibold text-xs text-[var(--text-primary)] font-mono bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-1.5 py-0.5 truncate max-w-[130px] focus:outline-none focus:border-emerald-500 cursor-pointer"
                    title="Chọn cơ sở dữ liệu trên máy chủ SQL Server"
                  >
                    {availableDbs.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-xs text-[var(--text-primary)] truncate font-mono">
                    {databaseName}
                  </span>
                )}
                {isLiveDb && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono shrink-0">
                    Live SQL
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--bravo-primary)] bg-[var(--bravo-surface)] px-1.5 py-0.5 rounded border border-[var(--bravo-border)] font-mono shrink-0">
                {tables.length} bảng
              </span>
            </div>

            {/* BUTTON TO IMPORT NEW DATABASE */}
            <div className="grid grid-cols-1 gap-1.5">
              {onSyncLiveDb && (
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className={`w-full py-2 px-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--border-default)] active:scale-[0.99] text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer ${
                    isSyncing ? 'opacity-70 cursor-wait' : ''
                  }`}
                  title="Kết nối trực tiếp vào Microsoft SQL Server để nạp lại danh sách bảng, kiểu dữ liệu và số lượng dòng mới nhất"
                >
                  {isSyncing ? (
                    <Loader2 size={13} className="text-emerald-400 animate-spin" />
                  ) : (
                    <RefreshCw size={13} className="text-emerald-400" />
                  )}
                  <span className="font-semibold">
                    {isSyncing ? 'Đang đồng bộ từ SQL Server...' : 'Đồng bộ từ SQL Server (Live)'}
                  </span>
                </button>
              )}

              <button
                onClick={() => dbFileInputRef.current?.click()}
                disabled={isSyncing}
                className="w-full py-1.5 px-2.5 bg-[var(--bravo-surface)] hover:bg-[var(--bravo-border)] text-[var(--bravo-primary)] border border-[var(--bravo-border)] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Tải lên file script .sql chứa lệnh CREATE TABLE để nạp Database mới vào AI"
              >
                <FolderUp size={13} />
                <span>+ Nhập Database mới (.sql)</span>
              </button>
            </div>

            {/* Live Sync Status Card */}
            {syncCard && (
              <div
                className={`p-2.5 rounded-lg border text-xs relative transition-all ${
                  syncCard.success
                    ? 'bg-[var(--bravo-surface)] border-[var(--bravo-border)] text-[var(--text-primary)]'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                }`}
              >
                <button
                  onClick={() => setSyncCard(null)}
                  className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X size={13} />
                </button>
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-[var(--bravo-primary)]">
                  {syncCard.success ? (
                    <CheckCircle2 size={14} className="text-[var(--bravo-primary)] shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-500 shrink-0" />
                  )}
                  <span>{syncCard.message}</span>
                </div>
                {syncCard.success && syncCard.details && (
                  <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5 mt-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">CSDL:</span>
                      <span className="text-[var(--text-primary)] font-semibold">{syncCard.details.databaseName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Máy chủ:</span>
                      <span className="text-[var(--text-primary)]">{syncCard.details.serverName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Quy mô:</span>
                      <span className="text-[var(--bravo-primary)] font-semibold">
                        {syncCard.details.tableCount} bảng • {syncCard.details.totalRows?.toLocaleString()} dòng
                      </span>
                    </div>
                    {syncCard.details.latencyMs !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Độ trễ:</span>
                        <span className="text-[var(--bravo-primary)] font-semibold">{syncCard.details.latencyMs}ms</span>
                      </div>
                    )}
                  </div>
                )}
                {!syncCard.success && (
                  <p className="text-[11px] text-rose-500 mt-1 leading-relaxed">
                    Hãy khởi chạy ứng dụng bằng <code className="bg-[var(--bg-elevated)] px-1 py-0.5 rounded font-mono">npm run dev</code> hoặc click đúp <code className="bg-[var(--bg-elevated)] px-1 py-0.5 rounded font-mono">Start-App.bat</code> để bật Backend Server.
                  </p>
                )}
              </div>
            )}

            {/* Notification when imported */}
            {importStatus && (
              <div className="p-2 rounded-md bg-[var(--bravo-surface)] border border-[var(--bravo-border)] text-[var(--bravo-primary)] text-[11px] flex items-center gap-1.5">
                <CheckCircle2 size={12} className="shrink-0" />
                <span className="truncate font-medium">{importStatus}</span>
              </div>
            )}
            
            {/* Search filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Tìm bảng hoặc cột..."
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md pl-7 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--bravo-primary)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs">
            {filteredTables.map((table) => {
              const isExpanded = expandedTables[table.name] ?? false;
              return (
                <div key={table.name} className="border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-card)] overflow-hidden">
                  {/* Table Header */}
                  <div
                    onClick={() => toggleTable(table.name)}
                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--bg-elevated)] cursor-pointer text-[var(--text-primary)] transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown size={13} className="text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronRight size={13} className="text-[var(--text-secondary)]" />
                      )}
                      <Table size={13} className="text-[var(--bravo-primary)]" />
                      <span className="font-mono font-semibold text-xs">{table.name}</span>
                    </div>
                    {table.rowCount > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{table.rowCount} rows</span>
                    )}
                  </div>

                  {/* Columns list + Data Dictionary */}
                  {isExpanded && (
                    <div className="p-2 pl-3.5 bg-[var(--bg-code)] space-y-1.5 border-t border-[var(--border-subtle)]">
                      {table.columns.map((col) => (
                        <div key={col.name} className="py-1 border-b border-[var(--border-subtle)]/50 last:border-b-0">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
                              {col.isPk && (
                                <span title="Khóa chính (PK)">
                                  <Key size={11} className="text-amber-500" />
                                </span>
                              )}
                              {col.isFk && (
                                <span title={`Khóa ngoại (FK) trỏ tới ${col.fkRef}`}>
                                  <ExternalLink size={11} className="text-[var(--accent-blue)]" />
                                </span>
                              )}
                              <span className="font-mono">{col.name}</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              {col.type}
                            </span>
                          </div>
                          {/* Từ điển dữ liệu & Ràng buộc CHECK của cột */}
                          {(col.description || col.checkConstraint) && (
                            <div className="mt-0.5 pl-1 space-y-0.5">
                              {col.description && !col.description.startsWith('Cột ') && (
                                <div className="text-[10px] text-[var(--text-secondary)] leading-snug">
                                  ↳ <span className="font-medium text-[var(--bravo-primary)]">Từ điển:</span> {col.description}
                                </div>
                              )}
                              {col.checkConstraint && (
                                <div className="text-[9.5px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded inline-block">
                                  CHECK: {col.checkConstraint}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="pt-1.5 mt-1 text-[10px] text-[var(--text-secondary)] border-t border-[var(--border-subtle)] leading-snug">
                        <span className="font-semibold text-[var(--text-primary)]">Mô tả bảng:</span> {table.description}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Relationships overview */}
            {relationships.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Quan hệ khóa ngoại (FK)
                </div>
                <div className="space-y-1 text-[11px] text-[var(--text-secondary)] font-mono">
                  {relationships.map((rel, idx) => (
                    <div key={idx} className="hover:text-[var(--bravo-primary)] cursor-help truncate" title={rel.description}>
                      {rel.fromTable}.{rel.fromColumn} → {rel.toTable}.{rel.toColumn}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {activePanel === 'settings' && (
        <div className="flex flex-col h-full p-3.5 text-xs overflow-y-auto space-y-4">
          {/* AI MODEL CONFIGURATION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu size={14} className="text-[var(--bravo-primary)]" />
                Cấu hình Mô hình AI
              </span>
            </div>

            {/* Provider Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[var(--text-secondary)] font-medium">Nhà cung cấp AI:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'groq' as AiProvider, name: 'Groq (Miễn phí)', desc: 'Llama 3.3 / Qwen' },
                  { id: 'gemini' as AiProvider, name: 'Gemini (Multi-Key)', desc: '2.5 Flash / Lite' },
                  { id: 'openai' as AiProvider, name: 'OpenAI', desc: 'GPT-4o / Custom' },
                  { id: 'ollama' as AiProvider, name: 'Ollama (Local)', desc: 'Qwen/DeepSeek' },
                  { id: 'mock' as AiProvider, name: 'Offline Mock', desc: 'Không cần key' }
                ].map((p) => {
                  const isActive = aiConfig.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProviderChange(p.id)}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--bravo-surface)] border-[var(--bravo-primary)] text-[var(--text-primary)] font-semibold shadow-2xs'
                          : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <div className="text-xs">{p.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Name Selector */}
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-secondary)] font-medium">Tên Model:</label>
              <select
                value={aiConfig.model}
                onChange={(e) => onUpdateAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--bravo-primary)] cursor-pointer"
              >
                {!PROVIDER_MODELS[aiConfig.provider]?.includes(aiConfig.model) && (
                  <option value={aiConfig.model}>{aiConfig.model}</option>
                )}
                {PROVIDER_MODELS[aiConfig.provider]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* API Key (for Groq, OpenAI or Gemini — hỗ trợ dán nhiều key cách nhau dấu phẩy / xuống dòng) */}
            {(aiConfig.provider === 'groq' || aiConfig.provider === 'openai' || aiConfig.provider === 'gemini') && (
              <div className="space-y-1">
                <label className="text-[11px] text-[var(--text-secondary)] font-medium">
                  {aiConfig.provider === 'groq'
                    ? 'Groq API Key (gsk_...):'
                    : aiConfig.provider === 'openai'
                    ? 'OpenAI API Key (sk-...):'
                    : 'Gemini API Key (hỗ trợ nhiều key):'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={
                      aiConfig.provider === 'groq'
                        ? 'Nhập gsk_... (cách nhau dấu phẩy nếu nhiều key)'
                        : aiConfig.provider === 'openai'
                        ? 'Nhập sk-... (OpenAI hoặc compatible)'
                        : 'Nhập 1 hoặc nhiều Gemini Key (cách nhau dấu phẩy)...'
                    }
                    value={aiConfig.apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (/[\r\n]/.test(pasted)) {
                        e.preventDefault();
                        const normalized = pasted
                          .split(/[\r\n]+/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .join(', ');
                        const existing = aiConfig.apiKey.trim();
                        const merged = existing ? `${existing}, ${normalized}` : normalized;
                        handleApiKeyChange(merged);
                      }
                    }}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md pl-2.5 pr-8 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--bravo-primary)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {(() => {
                  const keyCount = parseApiKeys(aiConfig.apiKey).length;
                  if (keyCount > 1) {
                    return (
                      <p className="text-[10px] text-emerald-500">
                        Đã nạp {keyCount} API key — tự động xoay vòng khi gặp giới hạn 429.
                      </p>
                    );
                  }
                  if (aiConfig.provider === 'gemini' || aiConfig.provider === 'groq') {
                    return (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Mẹo: Dán nhiều key cách nhau dấu phẩy (hoặc xuống dòng) để tự động xoay vòng.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Base URL (for Ollama or custom OpenAI-compatible) */}
            {(aiConfig.provider === 'ollama' || aiConfig.provider === 'openai') && (
              <div className="space-y-1">
                <label className="text-[11px] text-[var(--text-secondary)] font-medium">
                  {aiConfig.provider === 'ollama' ? 'Ollama Endpoint URL:' : 'Base URL (OpenAI-compatible):'}
                </label>
                <input
                  type="text"
                  placeholder={aiConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                  value={aiConfig.baseUrl}
                  onChange={(e) => onUpdateAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--bravo-primary)] font-mono"
                />
                {aiConfig.provider === 'ollama' && (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Chạy máy chủ cục bộ: <code className="text-amber-500 font-mono">ollama serve</code>
                  </p>
                )}
              </div>
            )}

            {/* Test Connection Button */}
            <div className="pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testStatus?.loading}
                className="w-full py-1.5 px-3 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {testStatus?.loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-[var(--bravo-primary)]" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <span>Kiểm tra kết nối AI</span>
                )}
              </button>

              {testStatus && !testStatus.loading && (
                <div className={`mt-2 p-2 rounded-md text-[11px] flex items-start gap-1.5 border ${
                  testStatus.success 
                    ? 'bg-[var(--bravo-surface)] border-[var(--bravo-border)] text-[var(--bravo-primary)]' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                }`}>
                  {testStatus.success ? (
                    <Check size={13} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug break-words min-w-0">{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-subtle)]" />

          {/* DATABASE CONFIGURATION */}
          <div className="space-y-2">
            <span className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
              <Server size={14} className="text-[var(--bravo-primary)]" />
              Database hiện hành
            </span>
            <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] font-mono space-y-1">
              <div>DB: <span className="text-[var(--text-primary)] font-semibold">{databaseName}</span></div>
              <div>Số bảng: <span className="text-[var(--text-primary)]">{tables.length} bảng</span></div>
              <div>Engine: <span className="text-[var(--text-primary)]">SQL Server / PostgreSQL</span></div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

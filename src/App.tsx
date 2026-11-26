import { useState, useRef, useEffect, useMemo } from 'react';
import { FileCode, Plus, X } from 'lucide-react';
import { usePersistentState } from './usePersistentState';
import type { PanelType, ChatSession, HistoryItem, SavedQuery, AiConfig, TableSchema, TableRelationship, AttachedFile, SqlDialect, FileWriteMode, PatchAnalysisResult, ChatMessage, SyncResult, KnowledgeRule } from './types';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { ConversationArea } from './components/ConversationArea';
import { CommandBar } from './components/CommandBar';
import { StatusBar } from './components/StatusBar';
import { executeAgentQuery, generateMockResponse } from './services/sqlAgentService';
import { DEFAULT_AI_CONFIGS, dispatchConversionRequest, normalizeGeminiModel } from './services/aiClient';
import { TABLES_SCHEMA, RELATIONSHIPS } from './data/quanLyKhoSchema';
import { DEFAULT_BRAVO_RULES, parseLearnInput } from './data/knowledgeBase';
import type { LearnDraft } from './data/knowledgeBase';
import { KnowledgeDialog } from './components/KnowledgeDialog';
import { FilePatchPreviewModal } from './components/FilePatchPreviewModal';
import { analyzeAndModifySqlFile } from './services/fileModifier';
import { checkBackendStatus, fetchLiveSchemaFromDb, executeSqlOnLiveDb, switchActiveDatabase } from './services/backendApi';

export function App() {
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic Database State (Quan_Ly_Kho_Hang default or imported by user)
  const [databaseName, setDatabaseName] = useState<string>('Quan_Ly_Kho_Hang');
  const [tables, setTables] = useState<TableSchema[]>(TABLES_SCHEMA);
  const [relationships, setRelationships] = useState<TableRelationship[]>(RELATIONSHIPS);

  // Live SQL Server State
  const [isLiveDbConnected, setIsLiveDbConnected] = useState<boolean>(false);
  const [serverName, setServerName] = useState<string>('localhost');

  // Dynamic Open Knowledge Base State (Persisted across sessions)
  const [rules, setRules] = usePersistentState<KnowledgeRule[]>(
    'bravo_knowledge_rules',
    DEFAULT_BRAVO_RULES
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null);

  const handleOpenRuleDialog = (rule?: KnowledgeRule) => {
    setEditingRule(rule ?? null);
    setActivePanel('rules');
    setDialogOpen(true);
  };

  const handleSaveRule = (draft: LearnDraft, editingId?: string) => {
    if (editingId) {
      setRules(prev => prev.map(r => r.id === editingId ? { ...r, ...draft } : r));
    } else {
      setRules(prev => [
        {
          ...draft,
          id: 'rule-' + Date.now(),
          category: 'custom',
          enabled: true,
          createdAt: new Date().toLocaleDateString('vi-VN')
        },
        ...prev
      ]);
    }
    setDialogOpen(false);
    setEditingRule(null);
  };

  const handleToggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleImportRules = (imported: KnowledgeRule[]) => {
    setRules(imported);
  };

  const handleResetRules = () => {
    if (window.confirm('Khôi phục danh sách quy tắc về bộ quy tắc chuẩn gốc của BRAVO ERP?')) {
      setRules(DEFAULT_BRAVO_RULES);
    }
  };

  useEffect(() => {
    // Tự động đồng bộ nội dung mới nhất của các quy tắc cốt lõi (core) và bổ sung quy tắc mới vào bộ quy tắc đã lưu
    setRules(prev => {
      const defaultMap = new Map(DEFAULT_BRAVO_RULES.map(def => [def.id, def]));
      let changed = false;

      const updated = prev.map(r => {
        const def = defaultMap.get(r.id);
        if (def && r.category === 'core') {
          if (
            r.title !== def.title ||
            r.description !== def.description ||
            r.ruleText !== def.ruleText ||
            r.exampleGood !== def.exampleGood ||
            r.exampleBad !== def.exampleBad
          ) {
            changed = true;
            return {
              ...def,
              enabled: r.enabled
            };
          }
        }
        return r;
      });

      const existingIds = new Set(updated.map(r => r.id));
      const missingDefaults = DEFAULT_BRAVO_RULES.filter(def => !existingIds.has(def.id));
      if (missingDefaults.length > 0) {
        changed = true;
        return [...updated, ...missingDefaults];
      }

      return changed ? updated : prev;
    });
  }, [setRules]);

  useEffect(() => {
    let isMounted = true;
    async function initLiveDb() {
      const status = await checkBackendStatus();
      if (!isMounted) return;
      if (status.success) {
        setIsLiveDbConnected(true);
        if (status.serverName) setServerName(status.serverName);
        if (status.currentDb) setDatabaseName(status.currentDb);

        const liveSchema = await fetchLiveSchemaFromDb(true);
        if (isMounted && liveSchema && liveSchema.tables.length > 0) {
          setTables(mergeWithDataDictionary(liveSchema.tables));
          setRelationships(liveSchema.relationships);
        }
      }
    }
    initLiveDb();
    return () => { isMounted = false; };
  }, []);

  // Giữ nguyên Từ điển dữ liệu (Data Dictionary) chuẩn ERP khi đồng bộ số dòng thực tế từ SQL Server
  const mergeWithDataDictionary = (liveTables: TableSchema[]): TableSchema[] => {
    return liveTables.map((lt) => {
      const dictTable = TABLES_SCHEMA.find(
        (dt) => dt.name.toLowerCase() === lt.name.toLowerCase()
      );
      if (!dictTable) return lt;
      return {
        ...lt,
        fullName: dictTable.fullName || lt.fullName,
        description: dictTable.description || lt.description,
        columns: lt.columns.map((lc) => {
          const dictCol = dictTable.columns.find(
            (dc) => dc.name.toLowerCase() === lc.name.toLowerCase()
          );
          if (!dictCol) return lc;
          return {
            ...lc,
            type: dictCol.type || lc.type,
            description: dictCol.description || lc.description,
            checkConstraint: dictCol.checkConstraint || lc.checkConstraint,
            defaultValue: dictCol.defaultValue || lc.defaultValue
          };
        })
      };
    });
  };

  const handleSyncLiveSchema = async (): Promise<SyncResult> => {
    try {
      const status = await checkBackendStatus();
      if (!status.success) {
        setIsLiveDbConnected(false);
        return {
          success: false,
          message: status.message || 'Không thể kết nối đến Backend Server (port 5000). Hãy chạy "npm run dev".'
        };
      }

      setIsLiveDbConnected(true);
      if (status.serverName) setServerName(status.serverName);

      const liveSchema = await fetchLiveSchemaFromDb(true);
      if (liveSchema && liveSchema.tables.length > 0) {
        setTables(mergeWithDataDictionary(liveSchema.tables));
        setRelationships(liveSchema.relationships);
        setDatabaseName(liveSchema.databaseName);

        const totalRows = liveSchema.tables.reduce((acc, t) => acc + (t.rowCount || 0), 0);
        return {
          success: true,
          message: `Đồng bộ thành công từ ${status.serverName || 'SQL Server'}`,
          databaseName: liveSchema.databaseName,
          serverName: status.serverName || 'localhost',
          tableCount: liveSchema.tables.length,
          totalRows,
          latencyMs: status.latencyMs || 0
        };
      }

      return {
        success: false,
        message: 'Không tìm thấy bảng nào trong database ' + (status.currentDb || databaseName)
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi khi đồng bộ từ SQL Server.'
      };
    }
  };

  const handleSwitchDatabase = async (newDb: string): Promise<SyncResult> => {
    try {
      const switched = await switchActiveDatabase(newDb);
      if (!switched) {
        return {
          success: false,
          message: `Không thể chuyển sang database [${newDb}]`
        };
      }
      return await handleSyncLiveSchema();
    } catch (err: any) {
      return {
        success: false,
        message: err.message || `Lỗi khi chuyển sang CSDL [${newDb}]`
      };
    }
  };

  // Attached File State for workspace SQL file (undefined = chưa chọn, null = người dùng chủ động gỡ)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null | undefined>(undefined);

  // Theme State: 'dark' or 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('bravo_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  // Apply theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    try {
      localStorage.setItem('bravo_theme', theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Load AI configuration from localStorage or use default (với hỗ trợ tự động lấy API key cài sẵn trong code)
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    try {
      const saved = localStorage.getItem('bravo_sql_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultConfig = (DEFAULT_AI_CONFIGS as Record<string, AiConfig>)[parsed?.provider] || DEFAULT_AI_CONFIGS.gemini;
        // Nếu bản lưu trên máy chưa có key nhưng trong code/env đã cài sẵn key -> tự động lấy key trong code
        if (!parsed.apiKey && defaultConfig.apiKey) {
          parsed.apiKey = defaultConfig.apiKey;
        }
        // Thống nhất sử dụng cặp model tối ưu gemini-3.6-flash và gemini-3.8-flash
        if (parsed.provider === 'gemini') {
          parsed.model = normalizeGeminiModel(parsed.model);
          localStorage.setItem('bravo_sql_ai_config', JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_AI_CONFIGS.gemini;
  });

  // Save AI config to localStorage on change
  const handleUpdateAiConfig = (newConfig: AiConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('bravo_sql_ai_config', JSON.stringify(newConfig));
    } catch {
      // ignore
    }
  };

  // Persistent state in localStorage
  const rawCoderSqlDemo = `/optimize SELECT td.Ma_Vt,
    (SELECT vt.Ten_vt FROM dbo.DMVT vt WHERE vt.Ma_vt = td.Ma_Vt) AS Ten_vt,
    td.So_Luong AS Ton_Dau_SL,
    nhap.SL_Nhap,
    xuat.SL_Xuat
FROM dbo.Ton_Dau td
LEFT JOIN (
    SELECT ct2.Ma_Vt, SUM(ct2.So_Luong) AS SL_Nhap
    FROM dbo.CTCT ct2 INNER JOIN dbo.CT c ON ct2.So_Ct = c.So_Ct
    WHERE c.Loai_Ct = 1 AND c.Ma_Kho = 'K01' AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-01-31'
    GROUP BY ct2.Ma_Vt
) nhap ON td.Ma_Vt = nhap.Ma_Vt
LEFT JOIN (
    SELECT ct2.Ma_Vt, SUM(ct2.So_Luong) AS SL_Xuat
    FROM dbo.CTCT ct2 INNER JOIN dbo.CT c ON ct2.So_Ct = c.So_Ct
    WHERE c.Loai_Ct = 2 AND c.Ma_Kho = 'K01' AND c.Ngay_Ct BETWEEN '2025-01-01' AND '2025-01-31'
    GROUP BY ct2.Ma_Vt
) xuat ON td.Ma_Vt = xuat.Ma_Vt
WHERE td.Nam = 2025 AND td.Ky = 1 AND td.Ma_Kho = 'K01'`;

  const defaultSessions: ChatSession[] = [
    {
      id: 'session-1',
      title: 'Luồng 1 · Sinh Tồn kho K01',
      createdAt: 'Hôm nay, 10:15',
      lastActive: 'Vừa xong',
      messages: [
        {
          id: 'msg-user-1',
          role: 'user',
          timestamp: '10:15',
          content: '/tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)',
          commandType: '/tonkho'
        },
        { ...generateMockResponse('/tonkho tháng 1/2025 cho Kho tổng Hà Nội (K01)'), id: 'msg-agent-1' }
      ]
    },
    {
      id: 'session-2',
      title: 'Luồng 2 · Tối ưu SQL thô (Coder)',
      createdAt: 'Hôm nay, 10:20',
      lastActive: 'Vừa xong',
      messages: [
        {
          id: 'msg-user-opt-1',
          role: 'user',
          timestamp: '10:20',
          content: rawCoderSqlDemo,
          commandType: '/optimize'
        },
        { ...generateMockResponse(rawCoderSqlDemo), id: 'msg-agent-opt-1' }
      ]
    },
    {
      id: 'session-3',
      title: 'Luồng 1 · Top khách hàng (2025)',
      createdAt: 'Hôm qua, 16:30',
      lastActive: 'Hôm qua',
      messages: [
        {
          id: 'msg-user-3',
          role: 'user',
          timestamp: '16:30',
          content: '/query Top 5 khách hàng mua nhiều hàng nhất theo tổng tiền xuất kho năm 2025',
          commandType: '/query'
        },
        { ...generateMockResponse('/query Top 5 khách hàng mua nhiều hàng nhất năm 2025'), id: 'msg-agent-3' }
      ]
    }
  ];

  const [sessions, setSessions] = usePersistentState<ChatSession[]>('bravo_sessions', defaultSessions);

  useEffect(() => {
    // Nâng cấp 1 lần nếu localStorage còn giữ phiên mẫu cũ (nơi /tonkho tự gọi /optimize chính nó)
    setSessions(prev => {
      const hasLegacySelfOptimize = prev.some(
        s => s.id === 'session-1' && s.messages.some(m => m.id === 'msg-user-2')
      );
      if (!hasLegacySelfOptimize) return prev;
      const customUserSessions = prev.filter(s => s.id !== 'session-1' && s.id !== 'session-2');
      return [...defaultSessions, ...customUserSessions];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentSessionId, setCurrentSessionId] = usePersistentState<string>(
    'bravo_current_session_id',
    'session-1'
  );

  const [history, setHistory] = usePersistentState<HistoryItem[]>('bravo_query_history', [
    {
      id: 'hist-1',
      sql: `SELECT td.Ma_Vt, vt.Ten_vt, td.So_Luong, SUM(ct2.So_Luong)... FROM dbo.Ton_Dau td WHERE td.Nam=2025 AND td.Ma_Kho='K01'`,
      timestamp: '10:16',
      status: 'success',
      rowCount: 10,
      executionTimeSec: 0.038
    },
    {
      id: 'hist-2',
      sql: `SELECT TOP 5 dt.Ten_Dt, SUM(ctct.Tien) AS Tong_Tien FROM dbo.DMDT dt INNER JOIN dbo.CT c ON dt.Ma_Dt=c.Ma_Dt WHERE c.Loai_Ct=2...`,
      timestamp: '10:14',
      status: 'success',
      rowCount: 5,
      executionTimeSec: 0.052
    }
  ]);

  const [savedQueries, setSavedQueries] = usePersistentState<SavedQuery[]>('bravo_saved_queries', [
    {
      id: 'saved-1',
      title: 'Bảng cân đối Nhập - Xuất - Tồn Kho K01 (T1/2025)',
      sql: `SELECT td.Ma_Vt, vt.Ten_vt, td.So_Luong AS Ton_Dau, ISNULL(SUM(CASE WHEN c.Loai_Ct=1 THEN ct2.So_Luong END),0) AS Nhap, ISNULL(SUM(CASE WHEN c.Loai_Ct=2 THEN ct2.So_Luong END),0) AS Xuat FROM dbo.Ton_Dau td INNER JOIN dbo.DMVT vt ON td.Ma_Vt=vt.Ma_vt WHERE td.Nam=2025 AND td.Ma_Kho='K01' GROUP BY td.Ma_Vt, vt.Ten_vt, td.So_Luong;`,
      createdAt: '01/11/2026'
    },
    {
      id: 'saved-2',
      title: 'Danh sách phiếu nhập mua vật tư chưa định chỉ (Dinh_Chi = 0)',
      sql: `SELECT So_Ct, Ngay_Ct, Ma_Dt, Dien_Giai FROM dbo.CT WHERE Loai_Ct = 1 AND Dinh_Chi = 0 ORDER BY Ngay_Ct DESC;`,
      createdAt: '01/11/2026'
    }
  ]);

  const [lastExecution, setLastExecution] = useState<{ rows: number; timeSec: number }>({
    rows: 15,
    timeSec: 0.048
  });

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  // Tự động duy trì và kế thừa tệp đính kèm cho phiên chat hiện tại:
  // Nếu người dùng chủ động bấm 'X' gỡ tệp (attachedFile === null hoặc currentSession.attachedFile === null) -> KHÔNG hiển thị lại!
  const effectiveAttachedFile = useMemo<AttachedFile | null>(() => {
    // 1. Nếu người dùng vừa bấm X gỡ tệp trong phiên này -> lập tức ẩn
    if (attachedFile === null) {
      return null;
    }
    // 2. Nếu người dùng vừa đính kèm tệp mới -> sử dụng tệp đó
    if (attachedFile) {
      return attachedFile;
    }
    // 3. Nếu phiên này trước đó đã được đánh dấu gỡ tệp (null) -> giữ nguyên không hiển thị
    if (currentSession?.attachedFile === null) {
      return null;
    }
    // 4. Nếu phiên này có tệp đính kèm hợp lệ -> sử dụng tệp của phiên
    if (currentSession?.attachedFile) {
      return currentSession.attachedFile;
    }
    // 5. Chỉ với phiên cũ chưa từng có trường attachedFile (undefined) -> kế thừa từ tin nhắn gần nhất
    if (currentSession?.attachedFile === undefined && currentSession?.messages) {
      for (let i = currentSession.messages.length - 1; i >= 0; i--) {
        const m = currentSession.messages[i];
        if (m.attachedFile) return m.attachedFile;
      }
    }
    return null;
  }, [attachedFile, currentSession]);

  const handleAttachFile = (file: AttachedFile | null) => {
    setAttachedFile(file);
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          attachedFile: file // strictly null if user clicked X, or AttachedFile if attached
        };
      }
      return s;
    }));
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    const target = sessions.find(s => s.id === id);
    if (target?.attachedFile !== undefined) {
      setAttachedFile(target.attachedFile);
    } else {
      const lastMsgWithFile = target?.messages.slice().reverse().find(m => m.attachedFile);
      setAttachedFile(lastMsgWithFile?.attachedFile || null);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K -> Focus Command Bar
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Ctrl+1 to Ctrl+4 -> Toggle Sidebar Panels
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        setActivePanel(prev => prev === 'chat' ? null : 'chat');
      } else if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        setActivePanel(prev => prev === 'history' ? null : 'history');
      } else if (e.ctrlKey && e.key === '3') {
        e.preventDefault();
        setActivePanel(prev => prev === 'saved' ? null : 'saved');
      } else if (e.ctrlKey && e.key === '4') {
        e.preventDefault();
        setActivePanel(prev => prev === 'schema' ? null : 'schema');
      } else if (e.ctrlKey && e.key === '5') {
        e.preventDefault();
        setActivePanel(prev => prev === 'rules' ? null : 'rules');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // State & Handler for Smart File Diff Preview Modal
  const [patchPreview, setPatchPreview] = useState<{
    sql: string;
    mode: FileWriteMode;
    fileName: string;
    fileSize?: number;
    originalContent: string;
    fileHandle?: any;
    targetRoutineName?: string;
    onSuccess?: () => void;
  } | null>(null);

  const handleRequestPreviewPatch = (
    sql: string,
    mode: FileWriteMode = 'smart-patch',
    onSuccess?: () => void,
    targetFile?: { name: string; content?: string; sizeBytes?: number; handle?: any } | null,
    targetRoutineName?: string
  ) => {
    const file = (targetFile && targetFile.content) ? targetFile : effectiveAttachedFile;
    if (!file) return;

    setPatchPreview({
      sql,
      mode,
      fileName: file.name,
      fileSize: file.sizeBytes,
      originalContent: file.content || '',
      fileHandle: file.handle,
      targetRoutineName,
      onSuccess
    });
  };

  const handleConfirmPatchSave = async (_mode: FileWriteMode, updatedContent: string) => {
    if (!patchPreview) return;

    const targetHandle = patchPreview.fileHandle || effectiveAttachedFile?.handle;

    if (targetHandle && typeof targetHandle.createWritable === 'function') {
      try {
        const writable = await targetHandle.createWritable();
        await writable.write(updatedContent);
        await writable.close();
      } catch (err: any) {
        console.warn('File System Write error:', err);
      }
    } else {
      // Fallback: Trigger browser download with the updated content
      const blob = new Blob([updatedContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = patchPreview.fileName || effectiveAttachedFile?.name || 'query_patched.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Cập nhật đồng bộ cả state bộ nhớ và session
    const newSizeBytes = new Blob([updatedContent]).size;
    const updatedFileObj: AttachedFile = {
      name: patchPreview.fileName,
      content: updatedContent,
      sizeBytes: newSizeBytes,
      handle: targetHandle
    };
    setAttachedFile(updatedFileObj);
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          attachedFile: updatedFileObj
        };
      }
      return s;
    }));

    // Trigger visual feedback on the button
    if (patchPreview.onSuccess) {
      patchPreview.onSuccess();
    }
  };

  // Smart File Save / Patch / Append implementation
  const handleSaveToFile = async (
    newSql: string, 
    mode: FileWriteMode = 'smart-patch', 
    fileHandle?: any,
    targetRoutineName?: string
  ): Promise<{ success: boolean; analysis: PatchAnalysisResult }> => {
    const targetHandle = fileHandle || effectiveAttachedFile?.handle;
    const currentContent = effectiveAttachedFile?.content || '';

    // Run the intelligent patch analyzer
    const analysis = analyzeAndModifySqlFile(currentContent, newSql, mode, targetRoutineName);

    if (targetHandle && typeof targetHandle.createWritable === 'function') {
      try {
        const writable = await targetHandle.createWritable();
        await writable.write(analysis.updatedContent);
        await writable.close();

        // Cập nhật đồng bộ cả state bộ nhớ và session
        const newSizeBytes = new Blob([analysis.updatedContent]).size;
        const updatedFileObj: AttachedFile = {
          name: effectiveAttachedFile?.name || 'query.sql',
          content: analysis.updatedContent,
          sizeBytes: newSizeBytes,
          handle: targetHandle
        };
        setAttachedFile(updatedFileObj);
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              attachedFile: updatedFileObj
            };
          }
          return s;
        }));
        return { success: true, analysis };
      } catch (err: any) {
        console.warn('File System Write error:', err);
      }
    }

    // Fallback: Trigger browser download with the updated content
    const blob = new Blob([analysis.updatedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = effectiveAttachedFile?.name || 'query_updated.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const newSizeBytes = new Blob([analysis.updatedContent]).size;
    const updatedFileObj: AttachedFile = {
      name: effectiveAttachedFile?.name || 'query_updated.sql',
      content: analysis.updatedContent,
      sizeBytes: newSizeBytes,
      handle: targetHandle
    };
    setAttachedFile(updatedFileObj);
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          attachedFile: updatedFileObj
        };
      }
      return s;
    }));

    return { success: true, analysis };
  };

  // Direct File Overwrite implementation (legacy compatibility)
  const handleOverwriteFile = async (newSql: string, fileHandle?: any): Promise<boolean> => {
    const res = await handleSaveToFile(newSql, 'replace-all', fileHandle);
    return res.success;
  };

  const handleImportDatabase = (parsed: { databaseName: string; tables: TableSchema[]; relationships: TableRelationship[] }) => {
    setDatabaseName(parsed.databaseName);
    setTables(parsed.tables);
    setRelationships(parsed.relationships);
  };

  const handleSendMessage = async (text: string, currentFile?: AttachedFile) => {
    if (isGenerating) return;

    const fileToUse = currentFile || attachedFile || effectiveAttachedFile || undefined;

    if (/^\/learn\b/i.test(text.trim()) && !parseLearnInput(text.trim(), fileToUse)) {
      handleOpenRuleDialog();
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user' as const,
      timestamp: timeStr,
      content: text,
      attachedFile: fileToUse
    };

    // Thêm tin nhắn người dùng và lưu đồng bộ tệp đính kèm vào cấp phiên
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          lastActive: 'Vừa xong',
          attachedFile: fileToUse || s.attachedFile,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    }));

    const learnMatch = text.trim().match(/^\/learn\b/i);
    if (learnMatch) {
      const draft = parseLearnInput(text.trim(), fileToUse);
      if (draft) {
        const newRule: KnowledgeRule = {
          id: 'rule-learned-' + Date.now(),
          title: draft.title,
          ruleText: draft.ruleText,
          exampleGood: draft.exampleGood,
          category: 'learned',
          enabled: true,
          createdAt: new Date().toLocaleDateString('vi-VN')
        };
        setRules(prev => [newRule, ...prev]);
        if (!text.includes('```') && (currentFile || attachedFile)) setAttachedFile(null);

        const exampleNote = newRule.exampleGood
          ? `\n- **Code mẫu**: ${newRule.exampleGood.split('\n').length} dòng`
          : '';
        const botMsg: ChatMessage = {
          id: 'msg-' + Date.now(),
          role: 'agent',
          timestamp: timeStr,
          content: `### Đã nạp tri thức mới\n\n- **Tên quy tắc**: \`${newRule.title}\`\n- **Nội dung**: ${newRule.ruleText}${exampleNote}\n- **Phân loại**: AI tự học\n- **Trạng thái**: đang kích hoạt\n\nQuy tắc được lưu bền vững và áp dụng cho mọi phiên làm việc sau. Xem hoặc chỉnh sửa tại tab **Kho Tri Thức (Ctrl+5)**.`,
          commandType: '/learn',
          providerUsed: aiConfig.provider,
          attachedFile: fileToUse
        };

        setSessions(prev => prev.map(s =>
          s.id === currentSessionId
            ? { ...s, lastActive: 'Vừa xong', messages: [...s.messages, botMsg] }
            : s
        ));
        return;
      }
    }
    setIsGenerating(true);

    try {
      // Build conversation history for AI context (including generated SQL blocks)
      const chatHistory = currentSession.messages.map(m => ({
        role: m.role,
        content: m.sql ? `${m.content}\n\n\`\`\`sql\n${m.sql}\n\`\`\`` : m.content
      }));

      // Execute through multi-provider AI dispatcher with dynamic schema, attached file and dynamic rules
      const agentMsg = await executeAgentQuery(
        text, 
        aiConfig, 
        chatHistory,
        tables,
        relationships,
        databaseName,
        fileToUse,
        rules
      );

      // Đảm bảo mọi tin nhắn phản hồi của agent đều kế thừa file đính kèm để hiển thị nút Lưu vào file
      if (!agentMsg.attachedFile && fileToUse) {
        agentMsg.attachedFile = fileToUse;
      }

      if (isLiveDbConnected && agentMsg.sql) {
        try {
          const liveResult = await executeSqlOnLiveDb(agentMsg.sql, databaseName);
          if (liveResult && liveResult.status === 'success') {
            agentMsg.result = liveResult;
          }
        } catch {
          // ignore
        }
      }

      // Add agent response
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            lastActive: 'Vừa xong',
            messages: [...s.messages, agentMsg]
          };
        }
        return s;
      }));

      if (agentMsg.result) {
        setLastExecution({
          rows: agentMsg.result.rowCount,
          timeSec: agentMsg.result.executionTimeSec
        });

        if (agentMsg.sql) {
          setHistory(prev => [
            {
              id: 'hist-' + Date.now(),
              sql: agentMsg.sql!,
              timestamp: timeStr,
              status: agentMsg.result!.status,
              rowCount: agentMsg.result!.rowCount,
              executionTimeSec: agentMsg.result!.executionTimeSec
            },
            ...prev.slice(0, 20)
          ]);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConvertSql = async (sql: string, targetDialect: SqlDialect) => {
    if (isGenerating) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetLabel = targetDialect === 'postgresql' ? 'PostgreSQL' : 'T-SQL';
    const direction = targetDialect === 'postgresql' ? 'tsql-to-pg' : 'pg-to-tsql';

    const fileToUse = effectiveAttachedFile || undefined;
    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user' as const,
      timestamp: timeStr,
      content: `Chuyển đổi câu lệnh SQL này sang cú pháp ${targetLabel} (giữ nguyên logic nghiệp vụ):`,
      attachedFile: fileToUse
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          lastActive: 'Vừa xong',
          attachedFile: fileToUse || s.attachedFile,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    }));

    setIsGenerating(true);

    try {
      if (aiConfig.provider === 'mock') {
        const mockMsg = generateMockResponse('/convert ' + sql);
        if (!mockMsg.attachedFile && fileToUse) {
          mockMsg.attachedFile = fileToUse;
        }
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              lastActive: 'Vừa xong',
              messages: [...s.messages, mockMsg]
            };
          }
          return s;
        }));
        return;
      }

      const convRes = await dispatchConversionRequest(aiConfig, sql, direction);

      const agentMsg = {
        id: 'agent-' + Date.now(),
        role: 'agent' as const,
        timestamp: timeStr,
        content: convRes.fullText,
        commandType: '/convert',
        ragChunkCount: 3,
        reasoningSteps: convRes.reasoningSteps,
        sql: convRes.convertedSql,
        sqlTitle: `${targetLabel} — Chuyển đổi bởi ${convRes.providerLabel}`,
        sqlDialect: convRes.targetDialect,
        providerUsed: convRes.providerLabel,
        attachedFile: fileToUse,
        tips: `Mẹo: Bấm nút chuyển đổi trên khối SQL để chuyển ngược lại sang ${targetDialect === 'postgresql' ? 'T-SQL' : 'PostgreSQL'}.`
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            lastActive: 'Vừa xong',
            messages: [...s.messages, agentMsg]
          };
        }
        return s;
      }));
    } catch (err: any) {
      const fallbackMsg = generateMockResponse('/convert ' + sql);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            lastActive: 'Vừa xong',
            messages: [
              ...s.messages,
              {
                ...fallbackMsg,
                id: 'agent-' + Date.now(),
                content: `[Lỗi gọi ${aiConfig.provider.toUpperCase()}]: ${err.message || 'Không thể gọi AI'}\n\nDưới đây là kết quả mẫu từ Offline Knowledge Base:`
              }
            ]
          };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSession = () => {
    const newId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: 'Phiên mới ' + (sessions.length + 1),
      createdAt: 'Hôm nay',
      lastActive: 'Vừa tạo',
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setAttachedFile(null);
    inputRef.current?.focus();
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (currentSessionId === id) {
      setCurrentSessionId(remaining[0].id);
    }
  };

  const handleRunSql = async (sql: string) => {
    if (isLiveDbConnected) {
      const result = await executeSqlOnLiveDb(sql, databaseName);
      setLastExecution({
        rows: result.rowCount,
        timeSec: result.executionTimeSec
      });

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const execMsg: ChatMessage = {
        id: 'msg-exec-' + Date.now(),
        role: 'agent',
        timestamp: timeStr,
        content: result.status === 'success'
          ? `Đã thực thi trực tiếp trên SQL Server **[${databaseName}]** (${result.rowCount} dòng, ${result.executionTimeSec}s):`
          : `Lỗi khi thực thi trên SQL Server:`,
        sql,
        sqlTitle: `Kết quả thực thi SQL Server [${databaseName}]`,
        result
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            lastActive: 'Vừa xong',
            messages: [...s.messages, execMsg]
          };
        }
        return s;
      }));

      setHistory(prev => [
        {
          id: 'hist-' + Date.now(),
          sql,
          timestamp: timeStr,
          status: result.status,
          rowCount: result.rowCount,
          executionTimeSec: result.executionTimeSec
        },
        ...prev.slice(0, 20)
      ]);
    } else {
      handleSendMessage('/query ' + sql);
    }
  };

  const handleSaveQuery = (title: string, sql: string) => {
    setSavedQueries(prev => [
      {
        id: 'saved-' + Date.now(),
        title,
        sql,
        createdAt: 'Vừa lưu'
      },
      ...prev
    ]);
  };

  const handleInsertPrompt = (text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text;
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans antialiased">
      {/* Top Title Bar */}
      <TitleBar 
        aiConfig={aiConfig}
        databaseName={databaseName}
        tableCount={tables.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setActivePanel('settings')}
        onFocusCommandBar={() => inputRef.current?.focus()}
        onNewSession={handleCreateSession}
        onOpenSchema={() => setActivePanel('schema')}
      />

      {/* Center Layout: ActivityBar + Sidebar + Main Conversation */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel(panel)}
        />

        {/* Collapsible Sidebar Panel with Dynamic Schema & DDL Import & Knowledge Base */}
        <Sidebar
          activePanel={activePanel}
          sessions={sessions}
          currentSessionId={currentSessionId}
          history={history}
          savedQueries={savedQueries}
          aiConfig={aiConfig}
          tables={tables}
          relationships={relationships}
          databaseName={databaseName}
          rules={rules}
          onImportDatabase={handleImportDatabase}
          onUpdateAiConfig={handleUpdateAiConfig}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRunQuery={handleRunSql}
          onInsertPrompt={handleInsertPrompt}
          onSyncLiveDb={handleSyncLiveSchema}
          onSwitchDatabase={handleSwitchDatabase}
          onOpenRuleDialog={handleOpenRuleDialog}
          onToggleRule={handleToggleRule}
          onDeleteRule={handleDeleteRule}
          onImportRules={handleImportRules}
          onResetRules={handleResetRules}
          isLiveDb={isLiveDbConnected}
        />

        {/* Main Center Area: Bravo IDE Tab Bar + Conversation Stream + Unified Command Bar */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-workspace)]">
          {/* Smart IDE Session Tab Bar (Bravo Studio style) */}
          <div className="h-[34px] bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] flex items-center px-1.5 gap-1 overflow-x-auto shrink-0 select-none">
            {sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={`group relative h-[28px] px-2.5 rounded-t-md flex items-center gap-1.5 text-xs cursor-pointer transition-all shrink-0 max-w-[240px] border-t-2 ${
                    isActive
                      ? 'bg-[var(--bg-workspace)] text-[var(--text-primary)] font-medium border-t-[var(--bravo-primary)] shadow-2xs'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] border-t-transparent'
                  }`}
                >
                  <FileCode
                    size={12}
                    className={isActive ? 'text-[var(--bravo-primary)] shrink-0' : 'text-[var(--text-muted)] shrink-0'}
                  />
                  <span className="truncate">{s.title}.sql</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity cursor-pointer"
                      title="Đóng tab"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleCreateSession}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0 cursor-pointer ml-0.5"
              title="Mở tab phiên mới"
            >
              <Plus size={13} />
            </button>
          </div>

          <ConversationArea
            messages={currentSession.messages}
            databaseName={databaseName}
            isGenerating={isGenerating}
            onSelectPrompt={(p) => handleSendMessage(p)}
            onRunSql={handleRunSql}
            onSaveQuery={handleSaveQuery}
            onSaveToFile={handleSaveToFile}
            onOverwriteFile={handleOverwriteFile}
            onConvertSql={handleConvertSql}
            activeFileHandle={effectiveAttachedFile?.handle}
            activeFileName={effectiveAttachedFile?.name}
            onRequestPreviewPatch={handleRequestPreviewPatch}
          />

          {/* Unified Slash Command Frame with File Attachment */}
          <CommandBar
            inputRef={inputRef}
            attachedFile={effectiveAttachedFile}
            onAttachFile={handleAttachFile}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        lastExecution={lastExecution}
        databaseName={databaseName}
        tableCount={tables.length}
        isLiveDb={isLiveDbConnected}
        serverName={serverName}
      />

      {dialogOpen && (
        <KnowledgeDialog
          key={editingRule?.id ?? 'new'}
          rule={editingRule}
          onClose={() => {
            setDialogOpen(false);
            setEditingRule(null);
          }}
          onSave={handleSaveRule}
        />
      )}

      {patchPreview && (
        <FilePatchPreviewModal
          key={`${patchPreview.fileName}-${patchPreview.mode}-${patchPreview.targetRoutineName || ''}`}
          isOpen={Boolean(patchPreview)}
          fileName={patchPreview.fileName}
          fileSize={patchPreview.fileSize}
          originalContent={patchPreview.originalContent}
          newSql={patchPreview.sql}
          initialMode={patchPreview.mode}
          targetRoutineName={patchPreview.targetRoutineName}
          onClose={() => setPatchPreview(null)}
          onConfirmSave={handleConfirmPatchSave}
        />
      )}
    </div>
  );
}

export default App;

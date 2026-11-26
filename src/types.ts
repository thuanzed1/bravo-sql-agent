export type PanelType = 'chat' | 'history' | 'saved' | 'schema' | 'rules' | 'settings' | null;

export interface KnowledgeRule {
  id: string;
  title: string;
  category: 'core' | 'custom' | 'learned';
  ruleText: string;
  enabled: boolean;
  createdAt: string;
  description?: string;
  exampleGood?: string;
  exampleBad?: string;
}

export type AiProvider = 'groq' | 'openai' | 'gemini' | 'ollama' | 'mock';

export type AgentFlowType = 'generate' | 'optimize' | 'convert' | 'assist';

export type SqlDialect = 'tsql' | 'postgresql';

export type FileWriteMode = 'smart-patch' | 'append' | 'replace-all';

export interface PatchAnalysisResult {
  mode: FileWriteMode;
  foundMatch: boolean;
  matchType: 'routine' | 'query' | 'exact' | 'append' | 'replace-all' | 'none';
  startLine: number;
  endLine: number;
  totalOriginalLines: number;
  changedLinesCount: number;
  routineName?: string;
  originalBlockPreview?: string;
  newBlockPreview: string;
  description: string;
  updatedContent: string;
}

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface AttachedFile {
  name: string;
  content: string;
  sizeBytes?: number;
  handle?: any; // FileSystemFileHandle if supported
}

export interface ColumnSchema {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  fkRef?: string;
  nullable?: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  description?: string;
}

export interface TableSchema {
  name: string;
  fullName: string;
  rowCount: number;
  description: string;
  columns: ColumnSchema[];
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  description: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  databaseName?: string;
  serverName?: string;
  tableCount?: number;
  totalRows?: number;
  latencyMs?: number;
}

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  shortcut?: string;
  iconType: 'query' | 'explain' | 'optimize' | 'debug' | 'diff' | 'schema' | 'tonkho' | 'convert' | 'learn';
  flows?: ('generate' | 'optimize')[];
  example: string;
}

export interface ReasoningStep {
  text: string;
  status: 'done' | 'pending' | 'active';
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeSec: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  timestamp: string;
  content: string;
  commandType?: string;
  flowType?: AgentFlowType;
  reasoningSteps?: ReasoningStep[];
  ragChunkCount?: number;
  sql?: string;
  sqlTitle?: string;
  result?: QueryResult;
  tips?: string;
  providerUsed?: string;
  isLoading?: boolean;
  attachedFile?: AttachedFile | null;
  sqlDialect?: SqlDialect;
  targetRoutineName?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastActive: string;
  messages: ChatMessage[];
  attachedFile?: AttachedFile | null;
}

export interface HistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  status: 'success' | 'error';
  rowCount: number;
  executionTimeSec: number;
}

export interface SavedQuery {
  id: string;
  title: string;
  sql: string;
  createdAt: string;
  category?: string;
}

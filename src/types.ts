export type AgentEngine =
  | "codex"
  | "claude"
  | "antigravity"
  | "ollama"
  | "gemini"
  | "anthropic"
  | "openai";

export interface AgentSuiteSettings {
  // Engine Selection
  engine: AgentEngine;

  // Local Ollama Settings
  ollamaUrl: string;
  ollamaModel: string;

  // CLI Engine Commands
  codexCliCommand: string;
  claudeCliCommand: string;
  antigravityCliCommand: string;

  // Direct Cloud API Keys
  geminiApiKey: string;
  geminiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;

  // Skills & Tools Toggles
  enableTriageTool: boolean;
  enableDecomposeTool: boolean;
  enableWorkstreamTool: boolean;
  enableStatsTool: boolean;
  enableLockTool: boolean;

  // Workflow & Review Behavior
  defaultReviewStatus: "pending" | "approved";
  autoGitCommit: boolean;
  lockNotesDuringProcessing: boolean;
}

export const DEFAULT_SETTINGS: AgentSuiteSettings = {
  engine: "ollama",

  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3",

  codexCliCommand: "codex",
  claudeCliCommand: "claude",
  antigravityCliCommand: "agy",

  geminiApiKey: "",
  geminiModel: "gemini-1.5-flash",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-sonnet-20241022",
  openaiApiKey: "",
  openaiModel: "gpt-4o",

  enableTriageTool: true,
  enableDecomposeTool: true,
  enableWorkstreamTool: true,
  enableStatsTool: true,
  enableLockTool: true,

  defaultReviewStatus: "pending",
  autoGitCommit: true,
  lockNotesDuringProcessing: true,
};

export interface TriageItemResult {
  sourceFile: string;
  action: "task_created" | "note_created" | "workstream_created" | "archived" | "skipped";
  targetPath?: string;
  title: string;
  workstream?: string;
  priority?: string;
  summary: string;
}

export interface TriageResult {
  processedCount: number;
  items: TriageItemResult[];
  errors: string[];
}

export interface DecomposeResult {
  taskPath: string;
  title: string;
  subtasks: string[];
  success: boolean;
  message: string;
}

export interface WorkstreamResult {
  workstreamName: string;
  folderPath: string;
  readmePath: string;
  agentsPath: string;
  success: boolean;
}

export interface VaultStatsResult {
  inboxCount: number;
  unprocessedInboxCount: number;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  activeWorkstreams: string[];
  totalNotes: number;
  activeLocksCount: number;
}

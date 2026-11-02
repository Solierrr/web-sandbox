import type { AiFilters } from "../filters";
import type { Replay } from "../replay";
import type { EnvId } from "../targets";
import type { DebugNode } from "../trace";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
  agent?: string;
  trace?: DebugNode[];
  latencyMs?: number | null;
  costUsd?: number | null;
  replay?: Replay;
  replayReason?: string;
}

export interface ConversationSummary {
  sessionId: string;
  userId: string;
  assistant: string;
  environment: EnvId;
  startedAt: string;
  messageCount: number;
  firstMessage: string;
  nps: number | null;
  costUsd: number;
  latencyMs: number;
  error: boolean;
}

export interface ConversationDetail extends ConversationSummary {
  replayConversationId?: string;
  messages: ConversationMessage[];
  metadata: Record<string, string>;
  trace: DebugNode[];
}

export interface ConversationQuery {
  filters: AiFilters;
  sessionId: string;
  userId: string;
  text: string;
  limit?: number;
}

export interface DayPoint {
  day: string;
  conversations: number;
  costUsd: number;
  p95Ms: number;
  errors: number;
}

export interface AssistantRow {
  assistant: string;
  conversations: number;
  nps: number | null;
  costUsd: number;
  p95Ms: number;
  errorRate: number;
}

export interface DashboardData {
  totals: {
    conversations: number;
    users: number;
    pricedConversations: number;
    resolvedConversations: number;
    nps: number | null;
    costUsd: number;
    costP50: number;
    costP95: number;
    p50Ms: number;
    p95Ms: number;
    errorRate: number;
  };
  byDay: DayPoint[];
  byAssistant: AssistantRow[];
  truncated?: boolean;
}

export interface LangSmithRow {
  name: string;
  runs: number;
  errorRate: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  p50Ms: number;
  p99Ms: number;
}

export interface LangSmithSummary {
  enabled: boolean;
  project: string | null;
  projectUrl: string | null;
  totals: LangSmithRow | null;
  byAssistant: LangSmithRow[];
  byModel: LangSmithRow[];
}

export interface AiDataSource {
  readonly demo: boolean;
  listConversations(query: ConversationQuery): Promise<ConversationSummary[]>;
  getConversation(sessionId: string): Promise<ConversationDetail | null>;
  dashboard(filters: AiFilters): Promise<DashboardData>;
  langsmith(filters: AiFilters): Promise<LangSmithSummary>;
}

export class DataUnavailableError extends Error {
  constructor(message = "Não foi possível ler o histórico de conversas.") {
    super(message);
    this.name = "DataUnavailableError";
  }
}

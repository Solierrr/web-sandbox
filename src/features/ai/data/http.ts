import { getSession, refresh } from "../../access/access.service";
import { prodUrl, qaUrl } from "../../../config/catalog";
import { getFilters, type AiFilters } from "../filters";
import type { Replay } from "../replay";
import type { EnvId } from "../targets";
import type { DebugLlmCall, DebugNode } from "../trace";
import { summarize } from "./stats";
import {
  DataUnavailableError,
  type AiDataSource,
  type ConversationDetail,
  type ConversationMessage,
  type ConversationQuery,
  type ConversationSummary,
  type DashboardData,
  type LangSmithSummary,
} from "./types";

export const DASHBOARD_LIMIT = 2000;
const REQUEST_TIMEOUT_MS = 60000;
export const TOOL_WITHOUT_NAME = "tool (nome não gravado no histórico)";
const NO_THREAD = "Esta conversa não veio do Simulador: não há estado guardado para reexecutar um nó dela.";
const OTHER_ADMIN = "Esta conversa foi feita no Simulador por outro admin. Só quem a criou consegue reexecutar nós dela.";
const NO_TURN = "Esta resposta foi gravada antes de o serviço registrar o turno do Simulador. Só respostas novas podem ser reexecutadas.";

export interface StepDto {
  node: string;
  stepType: string | null;
  toolName?: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  status: string | null;
  error: string | null;
  timestamp: string | null;
}

export interface SummaryDto {
  sessionId: string;
  userId: string;
  assistant: string;
  source: string | null;
  startedAt: string;
  messageCount: number;
  firstMessage: string;
  nps: number | null;
  costUsd: number;
  latencyMs: number;
  error: boolean;
}

export interface MessageDto {
  role: string;
  content: string;
  timestamp: string;
  turn: number | null;
  threadTurn: number | null;
  specialistsUsed: string[] | null;
  latencyMs: number;
  costUsd: number;
  steps: StepDto[] | null;
}

export interface DetailDto {
  summary: SummaryDto;
  threadId: string | null;
  userDetails: Record<string, unknown> | null;
  messages: MessageDto[];
}

export interface PageDto {
  items: SummaryDto[];
  total: number;
  truncated: boolean;
}

export function toSummary(dto: SummaryDto, environment: EnvId): ConversationSummary {
  return {
    sessionId: dto.sessionId,
    userId: dto.userId,
    assistant: dto.assistant,
    environment,
    startedAt: dto.startedAt,
    messageCount: dto.messageCount,
    firstMessage: dto.firstMessage,
    nps: dto.nps,
    costUsd: dto.costUsd,
    latencyMs: dto.latencyMs,
    error: dto.error,
  };
}

export function stepsToNodes(steps: StepDto[]): DebugNode[] {
  const nodes: DebugNode[] = [];
  for (const step of steps) {
    let node = nodes[nodes.length - 1];
    if (!node || node.node !== step.node) {
      node = {
        order: nodes.length + 1,
        node: step.node,
        started_at: step.timestamp ?? undefined,
        duration_ms: 0,
        status: "ok",
        input: null,
        output: null,
        llm_calls: [],
        error: null,
      };
      nodes.push(node);
    }
    node.duration_ms = (node.duration_ms ?? 0) + (step.latencyMs ?? 0);
    if (step.status && step.status !== "ok") {
      node.status = "error";
      node.error = node.error ?? step.error ?? step.status;
    }
    if (step.stepType === "LLM_CALL") {
      const call: DebugLlmCall = {
        model: step.model,
        prompt: null,
        completion: null,
        tokens_in: step.tokensIn,
        tokens_out: step.tokensOut,
        latency_ms: step.latencyMs,
        error: step.status && step.status !== "ok" ? (step.error ?? step.status) : null,
        node: step.node,
      };
      node.llm_calls.push(call);
    }
    if (step.stepType === "TOOL_CALL") {
      const failed = step.status !== null && step.status !== "ok";
      const name = step.toolName?.trim() || TOOL_WITHOUT_NAME;
      node.tool_calls = [
        ...(node.tool_calls ?? []),
        {
          name,
          input: null,
          output: null,
          duration_ms: step.latencyMs,
          status: failed ? "error" : "ok",
          error: failed ? (step.error ?? step.status) : null,
        },
      ];
      if (!node.tools?.some((tool) => tool.name === name)) node.tools = [...(node.tools ?? []), { name }];
    }
  }
  return nodes;
}

const THREAD = /^debug:([^:]+):(.+)$/s;

export function replayFor(
  threadId: string | null,
  threadTurn: number | null,
  persona: string | undefined,
  userId: string,
): { replay?: Replay; conversationId?: string; reason?: string } {
  const match = threadId ? THREAD.exec(threadId) : null;
  if (!match) return { reason: NO_THREAD };
  if (match[1].toLowerCase() !== userId.toLowerCase()) return { reason: OTHER_ADMIN };
  if (threadTurn === null || threadTurn < 0) return { reason: NO_TURN };
  return { replay: { kind: "chat", turn: threadTurn, persona }, conversationId: match[2] };
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

export function toDetail(dto: DetailDto, environment: EnvId, userId: string): ConversationDetail {
  const details = dto.userDetails ?? {};
  const persona = text(details.persona);
  let replayConversationId: string | undefined;
  const messages: ConversationMessage[] = dto.messages.map((message) => {
    if (message.role !== "assistant") return { role: "user", content: message.content, at: message.timestamp };
    const specialists = message.specialistsUsed ?? [];
    const found = replayFor(dto.threadId, message.threadTurn, persona, userId);
    replayConversationId = replayConversationId ?? found.conversationId;
    return {
      role: "assistant",
      content: message.content,
      at: message.timestamp,
      agent: specialists.length ? specialists[specialists.length - 1] : undefined,
      trace: stepsToNodes(message.steps ?? []),
      latencyMs: message.latencyMs,
      costUsd: message.costUsd,
      replay: found.replay,
      replayReason: found.reason,
    };
  });
  const replies = messages.filter((message) => message.role === "assistant");
  const metadata: Record<string, string> = {};
  if (dto.summary.source) metadata.Origem = dto.summary.source;
  if (persona) metadata.Persona = persona;
  return {
    ...toSummary(dto.summary, environment),
    replayConversationId,
    messages,
    metadata,
    trace: replies[replies.length - 1]?.trace ?? [],
  };
}

function baseUrl(environment: EnvId) {
  return (environment === "QA" ? qaUrl("api-messenger") : prodUrl("api-messenger"))?.replace(/\/$/, "");
}

async function problemDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
  } catch {
    return "";
  }
}

async function failure(response: Response): Promise<never> {
  switch (response.status) {
    case 401:
      throw new Error("O api-messenger recusou o token (inválido ou expirado). Entre novamente.");
    case 403:
      throw new DataUnavailableError("Sua conta não está em DEBUG_ADMIN_SUBS no api-messenger deste ambiente.");
    case 404:
      throw new DataUnavailableError("O api-messenger deste ambiente ainda não tem as rotas /messaging/admin. Publique a versão nova dele.");
    case 503: {
      const detail = await problemDetail(response);
      if (!detail) throw new DataUnavailableError("O api-messenger não conseguiu consultar uma dependência agora. Tente de novo em instantes.");
      const limited = /\b429\b/.test(detail) ? " É o limite de requisições do LangSmith (a consulta de estatísticas aceita 1 a cada 10 segundos por chave). Espere cerca de 10 segundos e aplique os filtros de novo." : "";
      throw new DataUnavailableError(`${detail}${limited}`);
    }
    default:
      throw new Error(`O api-messenger falhou (HTTP ${response.status}).`);
  }
}

async function getJson(environment: EnvId, path: string, params: Record<string, string | number | undefined> = {}) {
  const base = baseUrl(environment);
  if (!base) throw new DataUnavailableError(`Sem URL do api-messenger em ${environment}.`);
  let session = getSession();
  if (!session) throw new Error("Sua sessão terminou. Entre novamente.");
  if (session.mock)
    throw new DataUnavailableError("A sessão é de mock e o api-messenger não aceita esse token. Use VITE_MOCKS=DEACTIVATED e entre com a conta de QA.");
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && String(value).trim() !== "") url.searchParams.set(key, String(value));
  const call = (token: string) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      credentials: "omit",
      redirect: "error",
    }).catch(() => {
      throw new Error("Não foi possível falar com o api-messenger (rede, CORS ou serviço acordando). Tente de novo.");
    });
  let response = await call(session.accessToken);
  if (response.status === 401) {
    await refresh();
    session = getSession();
    if (!session) throw new Error("Sua sessão terminou. Entre novamente.");
    response = await call(session.accessToken);
  }
  return response;
}

async function readPage(filters: AiFilters, query: Partial<ConversationQuery>, limit: number): Promise<PageDto> {
  const response = await getJson(filters.environment, "/messaging/admin/conversations", {
    from: filters.from,
    to: filters.to,
    assistant: filters.assistant,
    sessionId: query.sessionId?.trim(),
    userId: query.userId?.trim(),
    text: query.text?.trim(),
    limit,
  });
  if (!response.ok) return failure(response);
  return (await response.json()) as PageDto;
}

export const messengerSource: AiDataSource = {
  demo: false,
  async listConversations(query) {
    const page = await readPage(query.filters, query, query.limit ?? 200);
    return page.items.map((item) => toSummary(item, query.filters.environment));
  },
  async getConversation(sessionId) {
    const environment = getFilters().environment;
    const response = await getJson(environment, `/messaging/admin/conversations/${encodeURIComponent(sessionId)}`);
    if (response.status === 404) return null;
    if (!response.ok) return failure(response);
    return toDetail((await response.json()) as DetailDto, environment, getSession()?.userId ?? "");
  },
  async dashboard(filters): Promise<DashboardData> {
    const page = await readPage(filters, {}, DASHBOARD_LIMIT);
    const data = summarize(
      page.items.map((item) => toSummary(item, filters.environment)),
      filters.from,
      filters.to,
    );
    return { ...data, truncated: page.truncated || page.total > page.items.length };
  },
  async langsmith(filters): Promise<LangSmithSummary> {
    const response = await getJson(filters.environment, "/messaging/admin/langsmith/summary", { from: filters.from, to: filters.to });
    if (!response.ok) return failure(response);
    return (await response.json()) as LangSmithSummary;
  },
};

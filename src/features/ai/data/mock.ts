import type { DebugOutcome } from "../debug.service";
import { aiTargets, type EnvId } from "../targets";
import type { DebugNode } from "../trace";
import { summarize } from "./stats";
import type {
  AiDataSource,
  ConversationDetail,
  ConversationMessage,
  ConversationQuery,
  ConversationSummary,
  LangSmithRow,
} from "./types";

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUESTIONS: Record<string, string[]> = {
  assistant: ["Preciso de um instalador de painéis em SP", "Quais fornecedores têm inversor de 5 kW?", "Quero comparar duas propostas de instalação"],
  operational: ["Cadastrar placa modelo XPTO 550W", "Listar placas sem estoque", "Atualizar o preço do modelo ABC"],
  geographic: ["Qual a distância entre Campinas e Sorocaba?", "Instaladores a até 50 km de Santos", "Melhor rota para visitar 3 clientes em Osasco"],
};
const ANSWERS = ["Encontrei 3 opções na sua região. Quer ver os detalhes de cada uma?", "Feito. O cadastro foi simulado e nada foi gravado.", "A distância é de cerca de 90 km, com 1 h 20 min de carro."];

const DEMO_TOOLS: Record<string, { name: string; description: string }[]> = {
  specialist: [
    { name: "buscar_profissionais", description: "Busca profissionais por região e especialidade." },
    { name: "consultar_faq", description: "Consulta a base de perguntas frequentes." },
  ],
  geo_resolver: [{ name: "calcular_rota", description: "Calcula distância e tempo entre dois pontos." }],
};

function demoTools(node: string): Pick<DebugNode, "tools" | "tool_calls"> {
  const tools = DEMO_TOOLS[node];
  if (!tools) return {};
  return {
    tools,
    tool_calls: [
      {
        name: tools[0].name,
        input: { consulta: "exemplo" },
        output: "2 resultados (exemplo)",
        duration_ms: 120,
        status: "ok",
        error: null,
      },
    ],
  };
}

export function buildTrace(assistant: string, rng: () => number): DebugNode[] {
  const names = assistant === "geographic" ? ["router", "geo_resolver", "answer"] : ["router", "supervisor", "specialist", "answer"];
  const models: Record<string, string> = { router: "gpt-4.1-nano", specialist: "gpt-4.1", answer: "gpt-4.1-mini" };
  return names.map((node, index) => {
    const calls = node === "router" || node === "answer" || node === "specialist";
    return {
      order: index + 1,
      node,
      duration_ms: Math.round(200 + rng() * 1800),
      status: "ok",
      input: { message: "…" },
      output: { next: names[index + 1] ?? "fim" },
      error: null,
      ...demoTools(node),
      llm_calls: calls
        ? [
            {
              model: models[node] ?? "gpt-4.1-mini",
              prompt: [{ type: "system", content: `Você é o nó ${node} do assistente.` }],
              completion: `decisão do nó ${node}`,
              tokens_in: Math.round(600 + rng() * 1400),
              tokens_out: Math.round(40 + rng() * 300),
              latency_ms: Math.round(150 + rng() * 1200),
              error: null,
            },
          ]
        : [],
    };
  });
}

function build(): ConversationDetail[] {
  const rng = random(42);
  const chatTargets = aiTargets.filter((target) => target.kind === "chat");
  const now = Date.now();
  const items: ConversationDetail[] = [];
  for (let index = 0; index < 90; index++) {
    const target = chatTargets[Math.floor(rng() * chatTargets.length)];
    const environment: EnvId = rng() < 0.75 ? "QA" : "PROD";
    const started = new Date(now - Math.floor(rng() * 14 * 86400000));
    const question = QUESTIONS[target.id][Math.floor(rng() * 3)];
    const turns = 1 + Math.floor(rng() * 3);
    const messages: ConversationMessage[] = [];
    for (let turn = 0; turn < turns; turn++) {
      const at = new Date(started.getTime() + turn * 60000).toISOString();
      messages.push({ role: "user", content: turn === 0 ? question : "Pode detalhar?", at });
      const turnTrace = buildTrace(target.id, rng);
      messages.push({
        role: "assistant",
        content: ANSWERS[Math.floor(rng() * 3)],
        at,
        agent: "SUPERVISOR",
        trace: turnTrace,
        latencyMs: turnTrace.reduce((total, node) => total + (node.duration_ms ?? 0), 0),
        costUsd: Number((0.001 + rng() * 0.012).toFixed(4)),
      });
    }
    const replies = messages.filter((message) => message.role === "assistant");
    const trace = replies[replies.length - 1]?.trace ?? [];
    const latencyMs = replies.reduce((total, message) => total + (message.latencyMs ?? 0), 0);
    const answered = rng() < 0.6;
    items.push({
      sessionId: `${(1e7 + Math.floor(rng() * 9e7)).toString(16)}-${index.toString().padStart(4, "0")}-demo`,
      userId: String(100000 + Math.floor(rng() * 900000)),
      assistant: target.id,
      environment,
      startedAt: started.toISOString(),
      messageCount: messages.length,
      firstMessage: question,
      nps: answered ? Math.min(10, Math.round(5 + rng() * 5.4)) : null,
      costUsd: Number(replies.reduce((total, message) => total + (message.costUsd ?? 0), 0).toFixed(4)),
      latencyMs,
      error: rng() < 0.06,
      messages,
      metadata: { Persona: "demandante", "Versão do prompt": "39" },
      trace,
    });
  }
  return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

const all = build();
const inRange = (item: ConversationSummary, from: string, to: string) =>
  item.startedAt.slice(0, 10) >= from && item.startedAt.slice(0, 10) <= to;

export const mockSource: AiDataSource = {
  demo: true,
  async listConversations({ filters, sessionId, userId, text }: ConversationQuery) {
    const needle = text.trim().toLowerCase();
    return all
      .filter(
        (item) =>
          item.environment === filters.environment &&
          (!filters.assistant || item.assistant === filters.assistant) &&
          inRange(item, filters.from, filters.to) &&
          (!sessionId.trim() || item.sessionId.includes(sessionId.trim())) &&
          (!userId.trim() || item.userId.includes(userId.trim())) &&
          (!needle || item.messages.some((message) => message.content.toLowerCase().includes(needle))),
      )
      .map(({ messages: _messages, metadata: _metadata, trace: _trace, ...summary }) => (void [_messages, _metadata, _trace], summary));
  },
  async getConversation(sessionId) {
    return all.find((item) => item.sessionId === sessionId) ?? null;
  },
  async dashboard(filters) {
    const rows = all.filter(
      (item) => item.environment === filters.environment && (!filters.assistant || item.assistant === filters.assistant) && inRange(item, filters.from, filters.to),
    );
    return summarize(rows, filters.from, filters.to);
  },
  async langsmith() {
    const row = (name: string, runs: number, costUsd: number, totalTokens: number): LangSmithRow => ({
      name,
      runs,
      errorRate: 0.02,
      totalTokens,
      promptTokens: Math.round(totalTokens * 0.7),
      completionTokens: Math.round(totalTokens * 0.3),
      costUsd,
      p50Ms: 1800,
      p99Ms: 7200,
    });
    return {
      enabled: true,
      project: "solaria-demo",
      projectUrl: null,
      totals: row("total", 160, 1.84, 410000),
      byAssistant: [row("ai-assistant", 90, 1.1, 250000), row("ai-operational", 45, 0.5, 110000), row("ai-geographic", 25, 0.24, 50000)],
      byModel: [row("gpt-4o", 120, 1.5, 330000), row("gpt-4o-mini", 200, 0.34, 80000)],
    };
  },
};

export function demoOutcome(targetId: string, message: string): DebugOutcome {
  const rng = random(message.length * 7919 + 1);
  const trace = buildTrace(targetId, rng);
  const elapsed = trace.reduce((total, node) => total + (node.duration_ms ?? 0), 0);
  return {
    ok: true,
    status: 200,
    elapsed,
    body: { response: ANSWERS[Math.floor(rng() * ANSWERS.length)], specialists_used: ["SUPERVISOR"] },
    debug: { nodes: trace, truncated: false, duration_ms: elapsed, persisted: false },
  };
}

export function demoRerun(node: DebugNode, prompts: { call: number; prompt: { type: string; content: string }[] }[]): DebugNode {
  const edited = new Set(prompts.map((item) => item.call));
  return {
    ...node,
    duration_ms: Math.round((node.duration_ms ?? 300) * 0.9),
    output: { ...(node.output && typeof node.output === "object" ? node.output : {}), reexecutado: true },
    llm_calls: node.llm_calls.map((call, index) => {
      const override = prompts.find((item) => item.call === index);
      return {
        ...call,
        prompt: override ? override.prompt : call.prompt,
        completion: edited.has(index) ? `[simulado com o prompt editado] ${call.completion ?? ""}`.trim() : call.completion,
      };
    }),
  };
}

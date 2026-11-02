import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { accessToken: string; userId: string; mock?: true },
  refresh: vi.fn(),
}));
vi.mock("../../access/access.service", () => ({
  getSession: () => state.session,
  refresh: state.refresh,
}));

import { setFilters } from "../filters";
import { DASHBOARD_LIMIT, messengerSource, replayFor, stepsToNodes, toDetail, TOOL_WITHOUT_NAME, type DetailDto, type StepDto } from "./http";
import { DataUnavailableError } from "./types";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const filters = { environment: "QA" as const, assistant: "", from: "2026-10-20", to: "2026-10-22" };
const query = { filters, sessionId: "", userId: "", text: "" };
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

const step = (node: string, overrides: Partial<StepDto> = {}): StepDto => ({
  node,
  stepType: "LLM_CALL",
  model: "gpt",
  tokensIn: 10,
  tokensOut: 5,
  latencyMs: 100,
  status: "ok",
  error: null,
  timestamp: "2026-10-20T10:00:01Z",
  ...overrides,
});

const summary = {
  sessionId: "abc",
  userId: ADMIN,
  assistant: "assistant",
  source: "debug",
  startedAt: "2026-10-20T10:00:00Z",
  messageCount: 2,
  firstMessage: "oi",
  nps: 9,
  costUsd: 0.01,
  latencyMs: 300,
  error: false,
};

const detail = (overrides: Partial<DetailDto> = {}, turn: number | null = 0): DetailDto => ({
  summary,
  threadId: `debug:${ADMIN}:conv-9`,
  userDetails: { persona: "profissional" },
  messages: [
    { role: "user", content: "oi", timestamp: "2026-10-20T10:00:00Z", turn: null, threadTurn: null, specialistsUsed: null, latencyMs: 0, costUsd: 0, steps: null },
    {
      role: "assistant",
      content: "olá",
      timestamp: "2026-10-20T10:00:05Z",
      turn: 1,
      threadTurn: turn,
      specialistsUsed: ["faq_reader"],
      latencyMs: 300,
      costUsd: 0.01,
      steps: [step("router"), step("faq_reader", { latencyMs: 200 })],
    },
  ],
  ...overrides,
});

beforeEach(() => {
  state.session = { accessToken: "jwt-1", userId: ADMIN };
  state.refresh.mockReset();
  setFilters({ environment: "QA" });
});

describe("stepsToNodes", () => {
  it("agrupa passos seguidos do mesmo nó, soma a latência e guarda só chamadas de LLM", () => {
    const nodes = stepsToNodes([
      step("router"),
      step("faq_reader", { latencyMs: 40 }),
      step("faq_reader", { stepType: "TOOL_CALL", model: "n/a", latencyMs: 60 }),
      step("router"),
    ]);
    expect(nodes.map((node) => node.node)).toEqual(["router", "faq_reader", "router"]);
    expect(nodes.map((node) => node.order)).toEqual([1, 2, 3]);
    expect(nodes[1].llm_calls).toHaveLength(1);
    expect(nodes[1].duration_ms).toBe(100);
    expect(nodes[0].llm_calls[0]).toMatchObject({ prompt: null, completion: null, model: "gpt", tokens_in: 10, tokens_out: 5 });
  });

  it("transforma passos TOOL_CALL em chamadas de tool, com o nome quando o histórico traz", () => {
    const [node] = stepsToNodes([
      step("data_reader", { stepType: "TOOL_CALL", model: "n/a", latencyMs: 60, toolName: "minhas_ofertas" }),
      step("data_reader", { stepType: "TOOL_CALL", model: "n/a", latencyMs: 20 }),
      step("data_reader", { stepType: "TOOL_CALL", model: "n/a", latencyMs: 5, toolName: "meu_estoque", status: "timeout", error: "demorou" }),
    ]);
    expect(node.llm_calls).toHaveLength(0);
    expect(node.tool_calls?.map((call) => call.name)).toEqual(["minhas_ofertas", TOOL_WITHOUT_NAME, "meu_estoque"]);
    expect(node.tool_calls?.[0]).toMatchObject({ duration_ms: 60, status: "ok", error: null });
    expect(node.tool_calls?.[2]).toMatchObject({ status: "error", error: "demorou" });
    expect(node.tools?.map((tool) => tool.name)).toEqual(["minhas_ofertas", TOOL_WITHOUT_NAME, "meu_estoque"]);
  });

  it("marca o nó com erro quando algum passo não deu certo", () => {
    const [node] = stepsToNodes([step("router", { status: "timeout", error: "demorou" })]);
    expect(node.status).toBe("error");
    expect(node.error).toBe("demorou");
    expect(node.llm_calls[0].error).toBe("demorou");
  });
});

describe("replayFor", () => {
  it("monta o replay de chat a partir da thread de debug do próprio admin", () => {
    expect(replayFor(`debug:${ADMIN}:conv-9`, 2, "profissional", ADMIN.toUpperCase())).toEqual({
      replay: { kind: "chat", turn: 2, persona: "profissional" },
      conversationId: "conv-9",
    });
  });
  it("explica por que não dá para reexecutar", () => {
    expect(replayFor(null, 0, undefined, ADMIN).reason).toMatch(/não veio do Simulador/);
    expect(replayFor("conversa-de-usuario", 0, undefined, ADMIN).reason).toMatch(/não veio do Simulador/);
    expect(replayFor(`debug:${ADMIN}:c`, 0, undefined, "outro").reason).toMatch(/outro admin/);
    expect(replayFor(`debug:${ADMIN}:c`, null, undefined, ADMIN).reason).toMatch(/antes de o serviço registrar/);
  });
});

describe("toDetail", () => {
  it("converte mensagens, passos e replay", () => {
    const result = toDetail(detail(), "QA", ADMIN);
    expect(result).toMatchObject({ sessionId: "abc", environment: "QA", replayConversationId: "conv-9", metadata: { Origem: "debug", Persona: "profissional" } });
    expect(result.messages[0]).toEqual({ role: "user", content: "oi", at: "2026-10-20T10:00:00Z" });
    const reply = result.messages[1];
    expect(reply).toMatchObject({ role: "assistant", agent: "faq_reader", latencyMs: 300, costUsd: 0.01 });
    expect(reply.trace?.map((node) => node.node)).toEqual(["router", "faq_reader"]);
    expect(reply.replay).toEqual({ kind: "chat", turn: 0, persona: "profissional" });
    expect(result.trace).toBe(reply.trace);
  });

  it("sem thread de debug a resposta vem sem replay e com o motivo", () => {
    const reply = toDetail(detail({ threadId: null }), "QA", ADMIN).messages[1];
    expect(reply.replay).toBeUndefined();
    expect(reply.replayReason).toMatch(/não veio do Simulador/);
  });
});

describe("messengerSource", () => {
  it("lista com o JWT, os filtros e o limite, e devolve resumos do ambiente escolhido", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { items: [summary], total: 1, truncated: false }));
    vi.stubGlobal("fetch", fetchMock);
    const items = await messengerSource.listConversations({ ...query, filters: { ...filters, assistant: "assistant" }, text: " preço ", limit: 50 });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api-messenger-5g2n.onrender.com/messaging/admin/conversations");
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: "2026-10-20", to: "2026-10-22", assistant: "assistant", text: "preço", limit: "50" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-1");
    expect(init.credentials).toBe("omit");
    expect(items).toEqual([expect.objectContaining({ sessionId: "abc", environment: "QA", nps: 9 })]);
  });

  it("renova o token uma vez quando recebe 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(200, { items: [], total: 0, truncated: false }));
    vi.stubGlobal("fetch", fetchMock);
    state.refresh.mockImplementation(async () => {
      state.session = { accessToken: "jwt-2", userId: ADMIN };
    });
    await expect(messengerSource.listConversations(query)).resolves.toEqual([]);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(((fetchMock.mock.calls[1] as [URL, RequestInit])[1].headers as Record<string, string>).Authorization).toBe("Bearer jwt-2");
  });

  it("403 e 404 viram aviso, não erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(403)).mockResolvedValueOnce(reply(404)));
    await expect(messengerSource.listConversations(query)).rejects.toThrow(/DEBUG_ADMIN_SUBS/);
    const error = await messengerSource.listConversations(query).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DataUnavailableError);
    expect((error as Error).message).toMatch(/\/messaging\/admin/);
  });

  it("sessão de mock não chama o serviço", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    state.session = { accessToken: "mock-x", userId: "mock:a", mock: true };
    await expect(messengerSource.listConversations(query)).rejects.toBeInstanceOf(DataUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(messengerSource.listConversations(query)).rejects.toThrow(/api-messenger/);
  });

  it("abre uma conversa no ambiente dos filtros e devolve null quando não existe", async () => {
    setFilters({ environment: "QA" });
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, detail())).mockResolvedValueOnce(reply(404));
    vi.stubGlobal("fetch", fetchMock);
    const found = await messengerSource.getConversation("abc");
    expect((fetchMock.mock.calls[0] as [URL])[0].pathname).toBe("/messaging/admin/conversations/abc");
    expect(found?.messages[1].replay).toEqual({ kind: "chat", turn: 0, persona: "profissional" });
    await expect(messengerSource.getConversation("x")).resolves.toBeNull();
  });

  it("o dashboard soma o período lido e avisa quando há mais do que o limite", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { items: [summary], total: 5000, truncated: true }));
    vi.stubGlobal("fetch", fetchMock);
    const data = await messengerSource.dashboard(filters);
    expect((fetchMock.mock.calls[0] as [URL])[0].searchParams.get("limit")).toBe(String(DASHBOARD_LIMIT));
    expect(data.truncated).toBe(true);
    expect(data.totals).toMatchObject({ conversations: 1, nps: 100 });
    expect(data.byAssistant[0]).toMatchObject({ assistant: "assistant", conversations: 1 });
  });

  it("o resumo do LangSmith vem do api-messenger do ambiente, com o mesmo período", async () => {
    const summaryBody = { enabled: true, project: "solaria-qa", projectUrl: null, totals: null, byAssistant: [], byModel: [] };
    const fetchMock = vi.fn().mockResolvedValue(reply(200, summaryBody));
    vi.stubGlobal("fetch", fetchMock);
    const data = await messengerSource.langsmith(filters);
    const url = (fetchMock.mock.calls[0] as [URL])[0];
    expect(url.pathname).toBe("/messaging/admin/langsmith/summary");
    expect(url.searchParams.get("from")).toBe("2026-10-20");
    expect(url.searchParams.get("to")).toBe("2026-10-22");
    expect(data.project).toBe("solaria-qa");
  });

  it("sem detalhe no 503, avisa que uma dependência do api-messenger falhou", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(messengerSource.langsmith(filters)).rejects.toThrow(/dependência/);
  });

  it("mostra o motivo que o api-messenger devolve no 503", async () => {
    const detail = "LangSmith indisponível ao buscar o projeto solaria-qa.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, { detail, errorCode: "DEPENDENCY_UNAVAILABLE" })));
    await expect(messengerSource.langsmith(filters)).rejects.toThrow(detail);
  });

  it("tira as tags quando o LangSmith devolve uma página HTML de 429", async () => {
    const detail = 'LangSmith respondeu 429 ao consultar as estatísticas. Detalhe: <!doctype html><meta charset="utf-8"><title>429</title>429 Too Many Requests.';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, { detail })));
    const error = (await messengerSource.langsmith(filters).catch((caught: Error) => caught)) as Error;
    expect(error.message).not.toMatch(/[<>]/);
    expect(error.message).toMatch(/429 Too Many Requests/);
  });

  it("no 429 do LangSmith explica que foi limite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, { detail: "LangSmith respondeu 429 ao consultar as estatísticas." })));
    const error = await messengerSource.langsmith(filters).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(DataUnavailableError);
    expect((error as Error).message).toMatch(/respondeu 429/);
    expect((error as Error).message).toMatch(/limite de requisições do LangSmith/);
  });
});

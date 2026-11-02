import { describe, expect, it, vi } from "vitest";
import { mockSource } from "./mock";
import { getDataSource } from "./source";
import { MAX_CHART_DAYS, npsOf, percentile, summarize } from "./stats";

const base = { environment: "QA" as const, assistant: "", from: "2000-01-01", to: "2999-12-31" };
const query = { filters: base, sessionId: "", userId: "", text: "" };

describe("stats", () => {
  it("NPS = promotores menos detratores entre quem respondeu", () => {
    expect(npsOf([10, 9, 8, 3, null])).toBe(25);
    expect(npsOf([null, null])).toBeNull();
  });
  it("percentil por posição", () => {
    expect(percentile([1, 2, 3, 4, 100], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 100], 95)).toBe(100);
    expect(percentile([], 95)).toBe(0);
  });
  it("limita a série diária para períodos longos", () => {
    expect(summarize([], "2000-01-01", "2026-10-24").byDay).toHaveLength(MAX_CHART_DAYS);
  });
  it("summarize cobre todos os dias do período, mesmo sem conversas", () => {
    const result = summarize([], "2026-10-01", "2026-10-03");
    expect(result.byDay.map((day) => day.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(result.totals).toMatchObject({ conversations: 0, nps: null, errorRate: 0 });
  });
});

describe("mockSource", () => {
  it("filtra por ambiente e assistente", async () => {
    const qa = await mockSource.listConversations(query);
    const prod = await mockSource.listConversations({ ...query, filters: { ...base, environment: "PROD" } });
    expect(qa.length).toBeGreaterThan(0);
    expect(prod.length).toBeGreaterThan(0);
    expect(qa.every((item) => item.environment === "QA")).toBe(true);
    const geo = await mockSource.listConversations({ ...query, filters: { ...base, assistant: "geographic" } });
    expect(geo.length).toBeGreaterThan(0);
    expect(geo.every((item) => item.assistant === "geographic")).toBe(true);
  });
  it("filtra por session id, usuário, texto e período", async () => {
    const [first] = await mockSource.listConversations(query);
    expect((await mockSource.listConversations({ ...query, sessionId: first.sessionId })).map((item) => item.sessionId)).toContain(first.sessionId);
    expect((await mockSource.listConversations({ ...query, userId: first.userId })).every((item) => item.userId.includes(first.userId))).toBe(true);
    expect((await mockSource.listConversations({ ...query, text: "zzz-inexistente" })).length).toBe(0);
    expect((await mockSource.listConversations({ ...query, filters: { ...base, from: "1999-01-01", to: "1999-01-02" } })).length).toBe(0);
  });
  it("o dashboard bate com a lista de conversas", async () => {
    const recent = { ...base, from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    const list = await mockSource.listConversations({ ...query, filters: recent });
    const dashboard = await mockSource.dashboard(recent);
    expect(dashboard.totals.conversations).toBe(list.length);
    expect(dashboard.byDay.reduce((total, day) => total + day.conversations, 0)).toBe(list.length);
    expect(dashboard.byAssistant.reduce((total, row) => total + row.conversations, 0)).toBe(list.length);
  });
  it("abre uma conversa com mensagens e passos; id inexistente devolve null", async () => {
    const [first] = await mockSource.listConversations(query);
    const detail = await mockSource.getConversation(first.sessionId);
    expect(detail?.messages.length).toBe(first.messageCount);
    expect(detail?.trace.length).toBeGreaterThan(0);
    expect(await mockSource.getConversation("nao-existe")).toBeNull();
  });
});

describe("getDataSource", () => {
  it("sem mock lê do api-messenger e, sem sessão, não inventa dados", async () => {
    vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
    const source = getDataSource();
    expect(source.demo).toBe(false);
    await expect(source.dashboard(base)).rejects.toThrow(/sessão terminou/);
    vi.unstubAllEnvs();
  });
  it("com VITE_MOCKS=ALWAYS usa os dados de exemplo", () => {
    vi.stubEnv("VITE_MOCKS", "ALWAYS");
    expect(getDataSource().demo).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("summarize: usuários distintos", () => {
  const item = (sessionId: string, userId: string) => ({
    sessionId, userId, assistant: "assistant", environment: "QA" as const, startedAt: "2026-10-02T10:00:00Z",
    messageCount: 2, firstMessage: "oi", nps: null, costUsd: 0.1, latencyMs: 1000, error: false,
  });

  it("conta cada usuário uma vez, mesmo com várias conversas", () => {
    const result = summarize([item("a", "u1"), item("b", "u1"), item("c", "u2")], "2026-10-01", "2026-10-07");

    expect(result.totals.conversations).toBe(3);
    expect(result.totals.users).toBe(2);
  });

  it("sem conversas não há usuários", () => {
    expect(summarize([], "2026-10-01", "2026-10-07").totals.users).toBe(0);
  });
});

describe("summarize: custo por conversa", () => {
  const item = (sessionId: string, costUsd: number) => ({
    sessionId, userId: "u", assistant: "assistant", environment: "QA" as const, startedAt: "2026-10-02T10:00:00Z",
    messageCount: 2, firstMessage: "oi", nps: null, costUsd, latencyMs: 1000, error: false,
  });

  it("só conversas com custo maior que zero entram na mediana e no p95", () => {
    const result = summarize([item("a", 0), item("b", 0.02), item("c", 0.04), item("d", 0.06)], "2026-10-01", "2026-10-07");

    expect(result.totals.conversations).toBe(4);
    expect(result.totals.pricedConversations).toBe(3);
    expect(result.totals.costUsd).toBeCloseTo(0.12);
    expect(result.totals.costP50).toBeCloseTo(0.04);
    expect(result.totals.costP95).toBeGreaterThanOrEqual(0.04);
  });
});

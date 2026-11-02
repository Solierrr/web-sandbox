import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSource } from "../data/mock";
import { resetFilters, setFilters } from "../filters";
import ConversationPage from "./ConversationPage";
import ConversationsPage from "./ConversationsPage";
import DashboardsPage from "./DashboardsPage";
import { getPlaygroundRun } from "../playground";
import { recordSimulatorTurn } from "../sessions";
import { aiTargets } from "../targets";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubEnv("VITE_MOCKS", "ALWAYS");
  resetFilters();
  setFilters({ from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("telas de IA com dados de exemplo", () => {
  it("lista as conversas, abre uma e mostra os passos", async () => {
    const expected = (await mockSource.listConversations({ filters: { environment: "QA", assistant: "", from: "2000-01-01", to: "2999-12-31" }, sessionId: "", userId: "", text: "" })).length;
    render(
      <MemoryRouter initialEntries={["/ia/conversas"]}>
        <Routes>
          <Route path="/ia/conversas" element={<ConversationsPage />} />
          <Route path="/ia/conversas/:sessionId" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(`Foram encontradas ${expected} conversas.`)).toBeTruthy());
    expect(screen.getByText(/Dados de exemplo/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("link")[0]);
    await waitFor(() => expect(screen.getByText("Resposta 1")).toBeTruthy());
    const cards = screen.getAllByText(/^Resposta \d+$/).length;
    expect(screen.getAllByText("Agente")).toHaveLength(cards);
    expect(screen.getAllByText("Assistente").length).toBeGreaterThanOrEqual(cards);
    expect(screen.queryByText("Modelo")).toBeNull();
    expect(screen.queryByText("Mensagens")).toBeNull();
    expect(screen.queryByText("Abrir no simulador")).toBeNull();
    expect(screen.getAllByRole("link", { name: /^Playground Debug da resposta/ })).toHaveLength(cards);
    expect(screen.getByRole("link", { name: "Playground Debug da resposta 1" }).getAttribute("href")).toBe("/ia/playground");
  });

  it("uma conversa do simulador abre pelo Session ID, com o playground por resposta", async () => {
    const outcome = {
      ok: true as const, status: 200, elapsed: 120, body: { response: "Oi!", specialists_used: ["SUPERVISOR"] },
      debug: { nodes: [{ order: 1, node: "router", status: "ok", duration_ms: 5, input: {}, output: {}, error: null, llm_calls: [] }] },
    };
    recordSimulatorTurn("sandbox-abc", { target: aiTargets[0], environment: "QA", demo: false }, { userText: "oi", outcome, at: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/ia/conversas/sandbox-abc"]}>
        <Routes>
          <Route path="/ia/conversas/:sessionId" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Resposta 1")).toBeTruthy();
    expect(screen.getByText("Oi!")).toBeTruthy();
    expect(screen.getAllByText("SUPERVISOR", { exact: false }).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("link", { name: "Playground Debug da resposta 1" }));
    expect(getPlaygroundRun()?.conversationId).toBe("sandbox-abc");
    expect(getPlaygroundRun()?.back?.to).toBe("/ia/conversas/sandbox-abc");
  });

  it("passa o replay da resposta ao playground, ou o motivo de não haver", async () => {
    const outcome = (turn?: number) => ({
      ok: true as const, status: 200, elapsed: 120, body: { response: "Oi!", specialists_used: [] },
      debug: { ...(turn === undefined ? {} : { turn }), nodes: [{ order: 1, node: "router", status: "ok", duration_ms: 5, input: {}, output: {}, error: null, llm_calls: [] }] },
    });
    const open = async (id: string) => {
      render(
        <MemoryRouter initialEntries={[`/ia/conversas/${id}`]}>
          <Routes>
            <Route path="/ia/conversas/:sessionId" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole("link", { name: "Playground Debug da resposta 1" }));
      return getPlaygroundRun();
    };
    const ctx = { target: aiTargets[0], environment: "QA" as const, demo: false };
    recordSimulatorTurn("sandbox-com", ctx, { userText: "oi", outcome: outcome(0), at: new Date().toISOString(), replay: { kind: "chat", turn: 0 } });
    const withReplay = await open("sandbox-com");
    expect(withReplay?.replay).toEqual({ kind: "chat", turn: 0 });
    expect(withReplay?.replayReason).toBeUndefined();
    cleanup();
    recordSimulatorTurn("sandbox-sem", ctx, { userText: "oi", outcome: outcome(), at: new Date().toISOString() });
    const without = await open("sandbox-sem");
    expect(without?.replay).toBeUndefined();
    expect(without?.replayReason).toMatch(/debug\.turn/);
  });

  it("o filtro de ambiente compartilhado muda o resultado", async () => {
    render(
      <MemoryRouter>
        <ConversationsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/Foram encontradas/)).toBeTruthy());
    const qaText = screen.getByText(/Foram encontradas/).textContent;
    setFilters({ environment: "PROD" });
    await waitFor(() => expect(screen.getByText(/Foram encontradas/).textContent).not.toBe(qaText));
  });

  it("o dashboard mostra totais, gráficos e a quebra por assistente", async () => {
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Latência p95").length).toBeGreaterThan(0));
    expect(screen.getByText("Conversas por dia")).toBeTruthy();
    expect(screen.getByText("Custo por dia")).toBeTruthy();
    expect(screen.getByText("Por assistente")).toBeTruthy();
  });

  it("o dashboard mostra o LangSmith com a quebra por assistente e por modelo", async () => {
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/LangSmith · solaria-demo/)).toBeTruthy());
    expect(screen.getByText("Execuções por assistente")).toBeTruthy();
    expect(screen.getByText("Execuções por modelo")).toBeTruthy();
    expect(screen.getByText("gpt-4o")).toBeTruthy();
  });

  it("quando o api-messenger traz só o ai-assistant, mostra os totais sem as tabelas por assistente e por modelo", async () => {
    const summary = await mockSource.langsmith({ environment: "QA", assistant: "", from: "2000-01-01", to: "2999-12-31" });
    vi.spyOn(mockSource, "langsmith").mockResolvedValue({ ...summary, byAssistant: [], byModel: [] });
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/LangSmith · solaria-demo/)).toBeTruthy());
    expect(screen.getByText(/Execuções só do ai-assistant/)).toBeTruthy();
    expect(screen.queryByText("Execuções por assistente")).toBeNull();
    expect(screen.queryByText("Execuções por modelo")).toBeNull();
    expect(screen.getAllByText("Execuções").length).toBeGreaterThan(0);
  });

  it("sem mock e sem sessão avisa o erro em vez de mostrar números", async () => {
    vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/sessão terminou/)).toBeTruthy());
    expect(screen.queryAllByText("Latência p95")).toHaveLength(0);
  });
});

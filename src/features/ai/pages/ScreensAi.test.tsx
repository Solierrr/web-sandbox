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

  it("o LangSmith aparece logo abaixo dos cards de cima, antes dos gráficos", async () => {
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/LangSmith · solaria-demo/)).toBeTruthy());
    const lastTopCard = screen.getAllByText("Latência p95")[0];
    const langsmith = screen.getByText(/LangSmith · solaria-demo/);
    const charts = screen.getByText("Conversas por dia");

    expect(lastTopCard.compareDocumentPosition(langsmith) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(langsmith.compareDocumentPosition(charts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a simulação de ROI continua visível e a explicação fica recolhida no fim da página", async () => {
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Latência p95").length).toBeGreaterThan(0));
    const abrir = screen.getByRole("button", { name: /Como o ROI e o custo humano são calculados/ });
    const simulacao = screen.getByText("Simulação de custo por usuários semanais");

    expect(simulacao).toBeTruthy();
    expect((screen.getByLabelText("Custo de um atendimento humano") as HTMLInputElement).value).toBe("2");
    expect(abrir.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/ROI = \(resoluções/)).toBeNull();
    // a setinha vem depois da simulação, no fim da página
    expect(simulacao.compareDocumentPosition(abrir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Por assistente").compareDocumentPosition(abrir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(abrir);

    expect(abrir.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/ROI = \(resoluções × custo de um atendimento humano − custo da IA\) ÷ custo da IA/)).toBeTruthy();
    expect(screen.getByText(/Como o custo de um atendimento humano foi calculado/)).toBeTruthy();
    expect(screen.getByText(/US\$ 1,73, arredondado para US\$ 2\.00/)).toBeTruthy();

    fireEvent.click(abrir);

    expect(screen.queryByText(/ROI = \(resoluções/)).toBeNull();
  });

  it("a explicação do custo humano cita as fontes com link", async () => {
    render(
      <MemoryRouter>
        <DashboardsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Latência p95").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Como o ROI e o custo humano são calculados/ }));

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    for (const dominio of ["salario.com.br", "valorfinal.com.br", "comm100.com", "gov.br", "gartner.com"]) {
      expect(links.some((href) => href.includes(dominio))).toBe(true);
    }
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

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPlaygroundRun, type PlaygroundRun } from "../playground";
import { aiTargets } from "../targets";

const service = vi.hoisted(() => ({ runDebug: vi.fn() }));
vi.mock("../debug.service", async (original) => ({ ...(await original<typeof import("../debug.service")>()), runDebug: service.runDebug }));

import PlaygroundPage from "./PlaygroundPage";

const node = (order: number, name: string, input: unknown) => ({
  order, node: name, status: "ok", duration_ms: 25 * order, input, output: { next: "fim" }, error: null,
  llm_calls: order === 1 ? [{ model: "gpt", prompt: [{ type: "system", content: "Você é o router" }, { type: "human", content: "oi" }], prompt_complete: true, completion: "geo", tokens_in: 10, tokens_out: 2, latency_ms: 20, error: null }] : [],
});
const run = (overrides: Partial<PlaygroundRun> = {}): PlaygroundRun => ({
  target: aiTargets[0],
  environment: "QA",
  conversationId: "sandbox-1",
  messages: [{ role: "user", text: "Preciso de instalador" }, { role: "assistant", text: "Achei 3" }],
  outcome: {
    ok: true, status: 200, elapsed: 900, body: { response: "Achei 3", specialists_used: ["SUPERVISOR"] },
    debug: { nodes: [node(1, "router", { message: "oi" }), node(2, "answer", { route: "geo" })] },
  },
  demo: false,
  replay: { kind: "chat", turn: 0 },
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  service.runDebug.mockReset();
  setPlaygroundRun(null);
});
afterEach(cleanup);

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlaygroundPage />
    </MemoryRouter>,
  );

describe("PlaygroundPage", () => {
  it("sem turno explica como chegar nele", () => {
    renderPage();
    expect(screen.getByText(/Nenhum turno para mostrar/)).toBeTruthy();
  });

  it("mostra o modelo de cada nó na linha do tempo e no detalhe", () => {
    setPlaygroundRun(run());
    renderPage();
    expect(screen.getAllByText("gpt").length).toBeGreaterThan(0);
    expect(screen.getByText(/modelo gpt/)).toBeTruthy();
  });

  it("mostra um passo por vez e troca o painel ao clicar em cada bolinha", () => {
    setPlaygroundRun(run());
    renderPage();
    expect(screen.getByText("1. router")).toBeTruthy();
    expect(screen.getByText("Você é o router", { exact: false })).toBeTruthy();
    expect(screen.queryByText("2. answer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ANSWER/i }));
    expect(screen.getByText("2. answer")).toBeTruthy();
    expect(screen.queryByText("1. router")).toBeNull();
    expect(screen.queryByText("Você é o router", { exact: false })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Resposta final/ }));
    expect(screen.getByText("Preciso de instalador")).toBeTruthy();
    expect(screen.getByText("Achei 3")).toBeTruthy();
    expect(screen.getByText(/Agente selecionado: SUPERVISOR/)).toBeTruthy();
    expect(screen.queryByText("2. answer")).toBeNull();
    expect(screen.getByRole("button", { name: /Resposta final/ }).getAttribute("aria-current")).toBe("step");
  });

  it("o link de voltar leva às conversas, ou à conversa de onde veio", () => {
    setPlaygroundRun(run());
    const { unmount } = renderPage();
    expect(screen.getByRole("link", { name: "Voltar para conversas" }).getAttribute("href")).toBe("/ia/conversas");
    unmount();
    setPlaygroundRun(run({ back: { to: "/ia/conversas/abc", label: "Voltar para a conversa" } }));
    renderPage();
    expect(screen.getByRole("link", { name: "Voltar para a conversa" }).getAttribute("href")).toBe("/ia/conversas/abc");
  });

  const customOutcome = (name: string, completion: string) => ({
    ok: true,
    status: 200,
    elapsed: 40,
    body: {},
    debug: {
      nodes: [{ ...node(1, name, { message: "oi" }), llm_calls: [{ model: "gpt", prompt: [{ type: "system", content: "NOVO" }, { type: "human", content: "oi" }], prompt_complete: true, completion, tokens_in: 1, tokens_out: 1, latency_ms: 5, error: null }] }],
      custom: { node: name, stopped: true, overrides_applied: 1, next: ["answer"] },
    },
  });

  it("execução personalizada: edita o prompt de um nó e roda só esse nó", async () => {
    service.runDebug.mockResolvedValue(customOutcome("router", "resposta nova"));
    setPlaygroundRun(run());
    renderPage();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Executar apenas/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt system do nó 1" }), { target: { value: "NOVO" } });
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(screen.getByText("resposta nova")).toBeTruthy());
    const [, , input] = service.runDebug.mock.calls[0];
    expect(input).toMatchObject({
      kind: "chat",
      conversationId: "sandbox-1",
      message: "Preciso de instalador",
      custom: { turn: 0, node: "router", occurrence: 0, prompts: [{ call: 0, prompt: [{ type: "system", content: "NOVO" }, { type: "human", content: "oi" }] }] },
    });
    expect(screen.getByText(/Só este nó foi executado/)).toBeTruthy();
    expect(screen.getByText(/O próximo nó seria: answer/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /ANSWER/i }));
    expect(screen.getByText("2. answer")).toBeTruthy();
    expect(screen.queryByText(/Só este nó foi executado/)).toBeNull();
    expect(service.runDebug).toHaveBeenCalledTimes(1);
  });

  it("a mensagem do usuário aparece no prompt mas não é editável", () => {
    setPlaygroundRun(run());
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText("Prompt · human (não editável)")).toBeTruthy();
  });

  it("prompt cortado pelo serviço não pode ser editado", () => {
    const base = run();
    const cortado = run({ outcome: { ...base.outcome, debug: { nodes: base.outcome.ok && base.outcome.debug ? [{ ...base.outcome.debug.nodes[0], llm_calls: [{ ...base.outcome.debug.nodes[0].llm_calls[0], prompt_complete: false }] }] : [] } } as PlaygroundRun["outcome"] });
    setPlaygroundRun(cortado);
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/com dado pessoal mascarado/)).toBeTruthy();
  });

  it("envia o turno do Playground e a ocorrência do nó", async () => {
    const nodes = [node(1, "router", {}), node(2, "answer", {}), { ...node(3, "router", {}), llm_calls: node(1, "router", {}).llm_calls }];
    service.runDebug.mockResolvedValue(customOutcome("router", "ok"));
    setPlaygroundRun(run({ replay: { kind: "chat", turn: 2, persona: "profissional" }, outcome: { ...run().outcome, debug: { nodes } } as PlaygroundRun["outcome"] }));
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.click(screen.getAllByRole("button", { name: /ROUTER/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(service.runDebug).toHaveBeenCalled());
    expect(service.runDebug.mock.calls[0][2].custom).toMatchObject({ turn: 2, node: "router", occurrence: 1 });
    expect(service.runDebug.mock.calls[0][2].persona).toBe("profissional");
  });

  it("avisa quando o serviço rodou o nó mas não aplicou o prompt", async () => {
    const outcome = customOutcome("router", "x");
    (outcome.debug.custom as { overrides_applied: number }).overrides_applied = 0;
    service.runDebug.mockResolvedValue(outcome);
    setPlaygroundRun(run());
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt system do nó 1" }), { target: { value: "NOVO" } });
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(screen.getByText(/não encontrou onde aplicar o prompt/)).toBeTruthy());
  });

  it("editar o system prompt vale para todas as chamadas do nó que usam o mesmo texto", async () => {
    const call = (completion: string) => ({ model: "gpt", prompt: [{ type: "system", content: "Mesmo prompt" }, { type: "human", content: "oi" }], prompt_complete: true, completion, tokens_in: 1, tokens_out: 1, latency_ms: 1, error: null });
    const agent = { ...node(1, "especialista", {}), llm_calls: [call("a"), call("b")] };
    service.runDebug.mockResolvedValue(customOutcome("especialista", "ok"));
    setPlaygroundRun(run({ outcome: { ...run().outcome, debug: { nodes: [agent] } } as PlaygroundRun["outcome"] }));
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Prompt system do nó 1" })[0], { target: { value: "Editado" } });
    expect((screen.getAllByRole("textbox", { name: "Prompt system do nó 1" })[1] as HTMLTextAreaElement).value).toBe("Editado");
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó especialista" }));
    await waitFor(() => expect(service.runDebug).toHaveBeenCalled());
    expect(service.runDebug.mock.calls[0][2].custom.prompts.map((item: { call: number }) => item.call)).toEqual([0, 1]);
  });

  it("recusa o resultado quando o serviço não confirma a execução parcial", async () => {
    const full = run().outcome;
    service.runDebug.mockResolvedValue({ ...full, debug: { ...full.debug } });
    setPlaygroundRun(run());
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(screen.getByText(/não confirmou a execução só deste nó/)).toBeTruthy());
    expect(screen.queryByText(/Só este nó foi executado/)).toBeNull();
  });

  it("mostra o motivo quando o serviço recusa", async () => {
    service.runDebug.mockResolvedValue({ ok: false, status: 403, reason: "forbidden", message: "Sua conta não está em DEBUG_ADMIN_SUBS neste serviço.", debug: null, elapsed: 5 });
    setPlaygroundRun(run());
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(screen.getByText(/DEBUG_ADMIN_SUBS/)).toBeTruthy());
  });

  it("no modo demo simula o nó sem chamar o serviço e permite restaurar", async () => {
    setPlaygroundRun(run({ demo: true }));
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt system do nó 1" }), { target: { value: "Outro prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Executar apenas o nó router" }));
    await waitFor(() => expect(screen.getByText(/simulado com o prompt editado/)).toBeTruthy());
    expect(service.runDebug).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao prompt e ao resultado originais" }));
    expect(screen.queryByText(/simulado com o prompt editado/)).toBeNull();
    expect((screen.getByRole("textbox", { name: "Prompt system do nó 1" }) as HTMLTextAreaElement).value).toBe("Você é o router");
  });

  it("a última bolinha não tem edição", () => {
    setPlaygroundRun(run());
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
    fireEvent.click(screen.getByRole("button", { name: /Resposta final/ }));
    expect(screen.queryByRole("button", { name: /Executar apenas/ })).toBeNull();
  });

  describe("outros serviços", () => {
    const outcomeOf = (name: string, extra: Record<string, unknown> = {}) => ({
      ...customOutcome(name, "novo"),
      debug: { ...customOutcome(name, "novo").debug, custom: { node: name, stopped: true, overrides_applied: 1, next: [], ...extra } },
    });
    const baseRun = (kind: PlaygroundRun["target"]["kind"], replay: PlaygroundRun["replay"], name: string) =>
      run({
        target: aiTargets.find((target) => target.kind === kind) ?? aiTargets[0],
        replay,
        outcome: { ...run().outcome, debug: { nodes: [node(1, name, {}), node(2, "depois", {})] } } as PlaygroundRun["outcome"],
      });
    const execute = async (name: string) => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Ativar execução personalizada?" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Prompt system do nó 1" }), { target: { value: "NOVO" } });
      fireEvent.click(screen.getByRole("button", { name: `Executar apenas o nó ${name}` }));
      await waitFor(() => expect(service.runDebug).toHaveBeenCalled());
      return service.runDebug.mock.calls[0][2];
    };

    it("certificados: envia o run_id e as URLs de novo", async () => {
      service.runDebug.mockResolvedValue(outcomeOf("nr10_agent"));
      setPlaygroundRun(baseRun("certificates", { kind: "certificates", runId: "run-1", nr10Url: "https://a/nr10", nr35Url: "https://a/nr35" }, "nr10_agent"));
      renderPage();
      const input = await execute("nr10_agent");
      expect(input).toMatchObject({
        kind: "certificates",
        nr10Url: "https://a/nr10",
        nr35Url: "https://a/nr35",
        custom: { runId: "run-1", node: "nr10_agent", occurrence: 0 },
      });
      await waitFor(() => expect(screen.getByText(/Este era o último nó/)).toBeTruthy());
    });

    it("CNPJ: envia o CNPJ de novo e sempre ocorrência 0", async () => {
      service.runDebug.mockResolvedValue(outcomeOf("cnpj_validation"));
      setPlaygroundRun(baseRun("cnpj", { kind: "cnpj", cnpj: "12.345.678/0001-90" }, "cnpj_validation"));
      renderPage();
      expect(await execute("cnpj_validation")).toMatchObject({
        kind: "cnpj",
        cnpj: "12.345.678/0001-90",
        custom: { node: "cnpj_validation", occurrence: 0 },
      });
    });

    it("imagem: usa a rota de etapa com o run_id", async () => {
      service.runDebug.mockResolvedValue(outcomeOf("moderation"));
      setPlaygroundRun(baseRun("image", { kind: "image", runId: "run-img" }, "moderation"));
      renderPage();
      expect(await execute("moderation")).toMatchObject({
        kind: "image-stage",
        custom: { runId: "run-img", node: "moderation", occurrence: 0 },
      });
    });

    it("imagem: etapa sem chamada a modelo mostra o motivo e não oferece a execução", () => {
      setPlaygroundRun(baseRun("image", { kind: "image", runId: "run-img" }, "image_validation"));
      renderPage();
      expect(screen.getByText(/só moderation e caption têm prompt/)).toBeTruthy();
      expect(screen.queryByRole("checkbox", { name: "Ativar execução personalizada?" })).toBeNull();
    });

    it("sem replay, mostra o motivo no lugar do seletor e não chama o serviço", () => {
      setPlaygroundRun(run({ replay: undefined, replayReason: "Esta conversa veio do histórico, não do Simulador." }));
      renderPage();
      expect(screen.getByText(/Execução personalizada indisponível: Esta conversa veio do histórico/)).toBeTruthy();
      expect(screen.queryByRole("checkbox", { name: "Ativar execução personalizada?" })).toBeNull();
      expect(service.runDebug).not.toHaveBeenCalled();
    });

    it("sem replay e sem motivo explicado, culpa a versão do serviço", () => {
      setPlaygroundRun(run({ replay: undefined }));
      renderPage();
      expect(screen.getByText(/debug.turn ou debug.run_id/)).toBeTruthy();
    });
  });
});

describe("PlaygroundPage: conversa no detalhe do nó", () => {
  const withInput = (input: unknown) =>
    run({
      messages: [
        { role: "user", text: "Oi" },
        { role: "assistant", text: "Olá, como ajudo?" },
        { role: "user", text: "Preciso de instalador" },
      ],
      outcome: {
        ok: true, status: 200, elapsed: 900, body: { response: "Achei 3", specialists_used: ["SUPERVISOR"] },
        debug: { nodes: [node(1, "router", input), node(2, "answer", input)] },
      },
    });

  it("sem resumo mostra a conversa toda com a mensagem do usuário", () => {
    setPlaygroundRun(withInput({ message_count: 3, last_message: { type: "human", content: "Preciso de instalador" } }));
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Conversa")).toBeTruthy();
    expect(screen.getAllByText("Oi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Olá, como ajudo?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Preciso de instalador").length).toBeGreaterThan(0);
  });

  it("com resumo mostra o resumo e a mensagem do usuário, sem as mensagens antigas", () => {
    setPlaygroundRun(withInput({ summary: "Quer instalador em SP.", last_message: { type: "human", content: "Preciso de instalador" } }));
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Conversa (resumida)")).toBeTruthy();
    expect(screen.getByText("Quer instalador em SP.")).toBeTruthy();
    expect(screen.queryByText("Olá, como ajudo?")).toBeNull();
  });
});

describe("PlaygroundPage: tools", () => {
  const withTools = () =>
    run({
      outcome: {
        ok: true, status: 200, elapsed: 900, body: { response: "Achei 3", specialists_used: ["SUPERVISOR"] },
        debug: {
          nodes: [
            {
              ...node(1, "data_reader", { message: "oi" }),
              tools: [
                { name: "minhas_ofertas", description: "Lista as ofertas da empresa." },
                { name: "meu_estoque", description: "Mostra o estoque." },
              ],
              tool_calls: [
                { name: "minhas_ofertas", input: { empresa: "ACME" }, output: "2 ofertas", duration_ms: 120, status: "ok", error: null },
              ],
            },
            node(2, "answer", { route: "geo" }),
          ],
        },
      },
    });

  it("lista todas as tools do agente, marca a utilizada e mostra a chamada com entrada e saída", () => {
    setPlaygroundRun(withTools());
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Tools que este agente pode chamar \(2\)/)).toBeTruthy();
    const available = screen.getByLabelText("Tools disponíveis");
    expect(available.textContent).toContain("minhas_ofertas");
    expect(available.textContent).toContain("meu_estoque");
    expect(available.textContent).toContain("utilizada");
    expect(available.textContent).toContain("não utilizada neste passo");
    expect(screen.getByText(/Tool call 1/)).toBeTruthy();
    expect(screen.getByText("Entrada da tool")).toBeTruthy();
    expect(screen.getByText("Saída da tool")).toBeTruthy();
    expect(screen.getByText("2 ofertas")).toBeTruthy();
  });

  it("mostra o selo de tools na linha do passo e as tools utilizadas na resposta final", () => {
    setPlaygroundRun(withTools());
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("Tools chamadas neste passo").textContent).toContain("1 tool");
    fireEvent.click(screen.getByRole("button", { name: /Resposta final/ }));
    expect(screen.getByText(/Tools utilizadas: minhas_ofertas/)).toBeTruthy();
  });

  it("nó sem tools não mostra a seção", () => {
    setPlaygroundRun(run());
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Tools disponíveis")).toBeNull();
    expect(screen.queryByText(/Tool call/)).toBeNull();
  });
});

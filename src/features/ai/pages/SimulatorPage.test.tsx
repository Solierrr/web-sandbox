import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFilters, setFilters } from "../filters";
import { getPlaygroundRun, setPlaygroundRun } from "../playground";
import { getSimulatorSession } from "../sessions";

const service = vi.hoisted(() => ({ runDebug: vi.fn() }));
vi.mock("../debug.service", async (original) => ({ ...(await original<typeof import("../debug.service")>()), runDebug: service.runDebug }));

import SimulatorPage from "./SimulatorPage";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  service.runDebug.mockReset();
  vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
  resetFilters();
  setPlaygroundRun(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SimulatorPage />
    </MemoryRouter>,
  );

const okOutcome = {
  ok: true,
  status: 200,
  elapsed: 1200,
  body: { response: "Achei 3 instaladores", specialists_used: ["geo"] },
  debug: {
    nodes: [
      {
        order: 1,
        node: "router",
        status: "ok",
        duration_ms: 40,
        input: { message: "oi" },
        output: { route: "geo" },
        llm_calls: [{ model: "gpt", prompt: [], completion: "geo", tokens_in: 10, tokens_out: 2, latency_ms: 30, error: null }],
        error: null,
      },
    ],
  },
};

async function sendMessage(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Mensagem" }), { target: { value: text } });
  fireEvent.click(await screen.findByRole("button", { name: "Enviar mensagem" }));
}

describe("SimulatorPage", () => {
  it("começa com o convite para conversar, mostra a resposta e linka o Session ID à conversa", async () => {
    service.runDebug.mockResolvedValue(okOutcome);
    renderPage();
    expect(screen.getByText("Comece a conversar!")).toBeTruthy();
    await sendMessage("Preciso de instalador");
    await waitFor(() => expect(screen.getByText("Achei 3 instaladores")).toBeTruthy());
    expect(screen.getByText("Preciso de instalador")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Playground Debug/ })).toBeNull();
    const link = screen.getByRole("link", { name: /^sandbox-/ });
    expect(link.getAttribute("href")).toBe(`/ia/conversas/${link.textContent}`);
    expect(getSimulatorSession(link.textContent ?? "")?.turns).toHaveLength(1);
    const [target, environment, input, , local] = service.runDebug.mock.calls[0];
    expect(target.id).toBe("assistant");
    expect(environment).toBe("QA");
    expect(input).toMatchObject({ kind: "chat", message: "Preciso de instalador", persona: "demandante" });
    expect(local).toBeUndefined();
    expect(getPlaygroundRun()).toBeNull();
  });

  it("mostra o motivo quando o debug está desligado", async () => {
    service.runDebug.mockResolvedValue({
      ok: false, status: 404, reason: "disabled", message: "Debug desligado neste serviço e ambiente.", debug: null, elapsed: 90,
    });
    renderPage();
    await sendMessage("oi");
    await waitFor(() => expect(screen.getByText("Debug desligado neste serviço e ambiente.")).toBeTruthy());
  });

  it("usa o servidor local quando marcado e recusa host que não seja localhost", async () => {
    service.runDebug.mockResolvedValue(okOutcome);
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Usar servidor local" }));
    await sendMessage("oi");
    await waitFor(() => expect(service.runDebug).toHaveBeenCalledOnce());
    expect(service.runDebug.mock.calls[0][4]).toBe("http://localhost:8000");
    fireEvent.change(screen.getByRole("textbox", { name: "URL do servidor local" }), { target: { value: "https://evil.example.com" } });
    expect(screen.getByText(/Só localhost/)).toBeTruthy();
    expect(screen.getByText(/Só localhost/)).toBeTruthy();
  });

  it("serviços sem chat mostram os campos ao lado e o botão Executar", async () => {
    service.runDebug.mockResolvedValue({ ...okOutcome, body: { status: "VALID" } });
    setFilters({ assistant: "cnpj" });
    renderPage();
    expect(screen.getByText("Pronto para executar")).toBeTruthy();
    const run = screen.getByRole("button", { name: "Executar pela rota de debug" });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "CNPJ" }), { target: { value: "12345678000190" } });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(run);
    await waitFor(() => expect(service.runDebug).toHaveBeenCalledOnce());
    expect(service.runDebug.mock.calls[0][2]).toEqual({ kind: "cnpj", cnpj: "12345678000190" });
  });

  it("guarda o turno devolvido pelo serviço para a execução personalizada", async () => {
    service.runDebug.mockResolvedValue({ ...okOutcome, debug: { ...okOutcome.debug, turn: 0 } });
    renderPage();
    await sendMessage("oi");
    const link = await screen.findByRole("link", { name: /^sandbox-/ });
    const session = getSimulatorSession(link.textContent ?? "");
    expect(session?.turns[0].replay).toEqual({ kind: "chat", turn: 0, persona: "demandante" });
  });

  it("sem o turno no debug (serviço antigo) não guarda replay", async () => {
    service.runDebug.mockResolvedValue(okOutcome);
    renderPage();
    await sendMessage("oi");
    const link = await screen.findByRole("link", { name: /^sandbox-/ });
    expect(getSimulatorSession(link.textContent ?? "")?.turns[0].replay).toBeUndefined();
  });

  it("no modo mock responde com exemplo e não chama o serviço", async () => {
    vi.stubEnv("VITE_MOCKS", "ALWAYS");
    renderPage();
    expect(screen.getByText(/Modo mock/)).toBeTruthy();
    await sendMessage("oi");
    await waitFor(() => expect(screen.getByRole("link", { name: /^sandbox-/ })).toBeTruthy());
    expect(service.runDebug).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /Playground Debug/ })).toBeNull();
    expect(getSimulatorSession(screen.getByRole("link", { name: /^sandbox-/ }).textContent ?? "")?.run.demo).toBe(true);
  });
});

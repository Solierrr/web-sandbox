import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ runDebug: vi.fn() }));
vi.mock("../debug.service", () => service);

import AiFlowPage from "./AiFlowPage";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  service.runDebug.mockReset();
});
afterEach(cleanup);

const renderPage = () =>
  render(
    <MemoryRouter>
      <AiFlowPage />
    </MemoryRouter>,
  );

describe("AiFlowPage", () => {
  it("só habilita Executar com mensagem e mostra resposta e passos", async () => {
    service.runDebug.mockResolvedValue({
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
    });
    renderPage();
    const run = screen.getByRole("button", { name: "Executar o turno pela rota de debug" });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensagem" }), { target: { value: "Preciso de instalador" } });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(run);
    await waitFor(() => expect(screen.getByText("Achei 3 instaladores")).toBeTruthy());
    expect(screen.getByText(/1\. router/)).toBeTruthy();
    expect(service.runDebug).toHaveBeenCalledOnce();
    const [target, environment, input] = service.runDebug.mock.calls[0];
    expect(target.id).toBe("assistant");
    expect(environment).toBe("QA");
    expect(input).toMatchObject({ kind: "chat", message: "Preciso de instalador", persona: "demandante" });
  });

  it("mostra o motivo quando o debug está desligado", async () => {
    service.runDebug.mockResolvedValue({
      ok: false, status: 404, reason: "disabled", message: "Debug desligado neste serviço e ambiente.", debug: null, elapsed: 90,
    });
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "Mensagem" }), { target: { value: "oi" } });
    const run = screen.getByRole("button", { name: "Executar o turno pela rota de debug" });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(run);
    await waitFor(() => expect(screen.getByText("Debug desligado neste serviço e ambiente.")).toBeTruthy());
  });
});

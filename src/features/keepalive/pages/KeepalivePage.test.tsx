import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KeepalivePage from "./KeepalivePage";
import { keepaliveSets, targets } from "../../../config/keepalive";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <KeepalivePage />
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("KeepalivePage", () => {
  it("acorda um serviço pelo botão da linha, mesmo no StrictMode do desenvolvimento", async () => {
    const fetcher = vi.fn((_url: string, init?: RequestInit) =>
      init?.signal?.aborted ? Promise.reject(new DOMException("Aborted", "AbortError")) : Promise.resolve(new Response(null)),
    );
    vi.stubGlobal("fetch", fetcher);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Acordar api-auth" }));
    await waitFor(() => expect(screen.getAllByText(/Respondeu/)).toHaveLength(1));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("acorda todos os serviços de um conjunto predefinido", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetcher);
    renderPage();
    const essentials = keepaliveSets.find((set) => set.id === "essentials")!;
    fireEvent.click(screen.getByRole("button", { name: "Acordar o conjunto Essenciais" }));
    await waitFor(() => expect(screen.getAllByText(/Respondeu/)).toHaveLength(essentials.ids.length));
    expect(fetcher).toHaveBeenCalledTimes(essentials.ids.length);
  });

  it("acorda só os serviços selecionados e marca os que não respondem", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    renderPage();
    const wakeSelected = screen.getByRole("button", { name: "Acordar os serviços selecionados" });
    expect((wakeSelected as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("api-auth"));
    fireEvent.click(screen.getByLabelText("api-core"));
    fireEvent.click(wakeSelected);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText(/Respondeu/)).toHaveLength(1));
    expect(screen.getAllByText("Sem resposta")).toHaveLength(1);
  });

  it("seleciona todos os serviços de uma vez", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Selecionar todos"));
    expect(screen.getByRole("button", { name: "Acordar os serviços selecionados" }).textContent).toContain(`(${targets.length})`);
  });
});

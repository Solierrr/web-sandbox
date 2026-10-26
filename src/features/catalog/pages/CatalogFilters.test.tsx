import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CatalogFilters from "./CatalogFilters";

let resize: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderFilters() {
  const onToggle = vi.fn();
  const view = render(
    <MemoryRouter>
      <CatalogFilters filters={{ framework: "react" }} icons={{ framework: {}, language: {}, kind: {} }} onToggle={onToggle} />
    </MemoryRouter>,
  );
  const region = screen.getByRole("region", { name: "Filtros de stacks" });
  return { ...view, region, onToggle };
}

describe("CatalogFilters", () => {
  it("preserva os três grupos e envia a opção acionada para o filtro", () => {
    const { onToggle } = renderFilters();
    expect(screen.getAllByRole("group")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Framework: React" }));
    expect(onToggle).toHaveBeenCalledWith("framework", "react");
  });

  it("esmaece somente as bordas com conteúdo oculto e acompanha o redimensionamento", () => {
    const { region, container } = renderFilters();
    Object.defineProperties(region, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 800 },
    });
    fireEvent.scroll(region);
    expect(container.querySelector(".bg-linear-to-r")).toBeNull();
    expect(container.querySelector(".bg-linear-to-l")).not.toBeNull();
    region.scrollLeft = 600;
    fireEvent.scroll(region);
    expect(container.querySelector(".bg-linear-to-r")).not.toBeNull();
    expect(container.querySelector(".bg-linear-to-l")).toBeNull();
    Object.defineProperty(region, "clientWidth", { value: 800 });
    region.scrollLeft = 0;
    act(() => resize());
    fireEvent.scroll(region);
    expect(container.querySelector(".bg-linear-to-r")).toBeNull();
    expect(container.querySelector(".bg-linear-to-l")).toBeNull();
  });

  it("permite navegar na faixa com as setas e libera o observer ao sair", () => {
    const { region, unmount } = renderFilters();
    const scrollBy = vi.fn();
    region.scrollBy = scrollBy;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: "smooth" });
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

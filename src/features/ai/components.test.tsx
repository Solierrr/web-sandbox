import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./components";
import { getFilters, resetFilters } from "./filters";

beforeEach(() => resetFilters());
afterEach(cleanup);

describe("FilterBar", () => {
  it("aplica na hora quando não é adiado", () => {
    render(<FilterBar period />);

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-01" } });

    expect(getFilters().from).toBe("2026-10-01");
  });

  it("adiado: só grava os filtros ao apertar o botão e depois avisa quem busca", () => {
    const onSubmit = vi.fn();
    const before = getFilters().from;
    render(<FilterBar deferred onSubmit={onSubmit} submitLabel="Buscar" />);

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-05" } });

    expect(getFilters().from).toBe(before);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(getFilters().from).toBe("2026-10-01");
    expect(getFilters().to).toBe("2026-10-05");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("adiado sem onSubmit mostra o botão Aplicar filtros", () => {
    render(<FilterBar deferred />);

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(getFilters().from).toBe("2026-09-01");
  });

  it("adiado: Limpar volta o rascunho para o padrão", () => {
    render(<FilterBar deferred />);

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpar os filtros" }));

    expect((screen.getByLabelText("Data inicial") as HTMLInputElement).value).toBe(getFilters().from);
  });
});

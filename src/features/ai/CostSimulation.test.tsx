import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CostSimulation } from "./CostSimulation";
import type { CostBasis } from "./cost";

afterEach(cleanup);

const basisOf = (overrides: Partial<CostBasis> = {}): CostBasis => ({
  from: "2026-10-01",
  to: "2026-10-14",
  conversations: 40,
  pricedConversations: 40,
  users: 10,
  costUsd: 2,
  costP50: 0.04,
  costP95: 0.12,
  weeks: 2,
  ...overrides,
});
const basis = basisOf();
const scenario = (users: number) => document.querySelector(`[data-scenario="${users}"]`) as HTMLElement | null;
const add = (value: string, how: "button" | "enter" = "button") => {
  const input = screen.getByLabelText("Novo cenário de usuários por semana");
  fireEvent.change(input, { target: { value } });
  if (how === "enter") fireEvent.keyDown(input, { key: "Enter" });
  else fireEvent.click(screen.getByRole("button", { name: "Adicionar este número de usuários como cenário" }));
};

describe("CostSimulation", () => {
  it("mostra sempre os cenários de 100 e 1000 usuários com o custo semanal e mensal", () => {
    render(<CostSimulation basis={basis} />);

    expect(scenario(100)).not.toBeNull();
    expect(scenario(1000)).not.toBeNull();
    // 100 usuários x 2 conversas por usuário por semana x US$ 0,05 = US$ 10 por semana
    expect(within(scenario(100)!).getByText("US$ 10.00")).toBeTruthy();
    expect(within(scenario(1000)!).getByText("US$ 100.00")).toBeTruthy();
    expect(within(scenario(100)!).queryByRole("button", { name: /Remover/ })).toBeNull();
    expect(within(scenario(1000)!).queryByRole("button", { name: /Remover/ })).toBeNull();
  });

  it("adiciona um cenário como 50 antes do 100 e deixa remover só esse", () => {
    render(<CostSimulation basis={basis} />);

    add("50");

    const order = [...document.querySelectorAll("[data-scenario]")].map((card) => card.getAttribute("data-scenario"));
    expect(order).toEqual(["50", "100", "1000"]);
    expect(within(scenario(50)!).getByText("US$ 5.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover o cenário de 50 usuários" }));

    expect(scenario(50)).toBeNull();
    expect(scenario(100)).not.toBeNull();
  });

  it("recusa número inválido e cenário repetido", () => {
    render(<CostSimulation basis={basis} />);

    add("0");
    expect(screen.getByRole("alert").textContent).toMatch(/inteiro de 1 a/);

    add("100", "enter");
    expect(screen.getByRole("alert").textContent).toMatch(/já está na lista/);
    expect(document.querySelectorAll("[data-scenario]")).toHaveLength(2);
  });

  it("muda os valores quando a premissa é editada e volta ao observado", () => {
    render(<CostSimulation basis={basis} />);

    fireEvent.change(screen.getByLabelText("Conversas por usuário por semana"), { target: { value: "4" } });
    expect(within(scenario(100)!).getByText("US$ 20.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Voltar às premissas calculadas com os dados do período" }));
    expect(within(scenario(100)!).getByText("US$ 10.00")).toBeTruthy();
  });

  it("sem usuários distintos suficientes parte de 1 conversa por usuário e avisa", () => {
    render(<CostSimulation basis={basisOf({ conversations: 30, pricedConversations: 30, users: 1, costUsd: 3, costP50: 0.1, costP95: 0.1, weeks: 1 })} />);

    expect((screen.getByLabelText("Conversas por usuário por semana") as HTMLInputElement).value).toBe("1");
    expect(screen.getByText(/não dá para medir, então o ponto de partida é 1 por semana/)).toBeTruthy();
    // 100 usuários x 1 conversa x US$ 0,10 = US$ 10
    expect(within(scenario(100)!).getByText("US$ 10.00")).toBeTruthy();
  });

  it("sem conversas no período pede o custo e mostra traço até informar", () => {
    render(<CostSimulation basis={basisOf({ conversations: 0, pricedConversations: 0, users: 0, costUsd: 0, costP50: 0, costP95: 0, weeks: 1 })} />);

    expect(screen.getAllByText(/Nenhuma conversa com custo registrado no período/).length).toBeGreaterThan(0);
    expect(within(scenario(100)!).getAllByText("-").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Custo médio por conversa"), { target: { value: "0.02" } });
    expect(within(scenario(100)!).getByText("US$ 2.00")).toBeTruthy();
  });

  it("avisa quando há poucos usuários distintos ou a leitura foi cortada", () => {
    render(<CostSimulation basis={{ ...basis, users: 5 }} truncated />);

    expect(screen.getByText(/Poucos usuários distintos/)).toBeTruthy();
    expect(screen.getByText(/leu só as conversas mais recentes/)).toBeTruthy();
  });

  it("mostra média, mediana e p95 nos botões de base do custo", () => {
    render(<CostSimulation basis={basisOf({ conversations: 50, pricedConversations: 40 })} />);

    expect(screen.getByRole("button", { name: "Usar a média como custo médio por conversa" }).textContent).toMatch(/Média US\$ 0\.0500/);
    expect(screen.getByRole("button", { name: "Usar a mediana como custo médio por conversa" }).textContent).toMatch(/Mediana US\$ 0\.0400/);
    expect(screen.getByRole("button", { name: "Usar o p95 como custo médio por conversa" }).textContent).toMatch(/p95 US\$ 0\.1200/);
  });

  it("deixa trocar o custo médio pela mediana ou pelo p95", () => {
    render(<CostSimulation basis={basis} />);
    const cost = () => (screen.getByLabelText("Custo médio por conversa") as HTMLInputElement).value;

    expect(cost()).toBe("0.05");
    fireEvent.click(screen.getByRole("button", { name: "Usar a mediana como custo médio por conversa" }));
    expect(cost()).toBe("0.04");
    // 100 usuários x 2 conversas x US$ 0,04
    expect(within(scenario(100)!).getByText("US$ 8.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Usar o p95 como custo médio por conversa" }));
    expect(cost()).toBe("0.12");
    fireEvent.click(screen.getByRole("button", { name: "Usar a média como custo médio por conversa" }));
    expect(cost()).toBe("0.05");
  });
});

import { describe, expect, it } from "vitest";
import { observedPremises, type CostBasis, parsePositive, parseScenario, periodWeeks, projectCost, scenarioList, WEEKS_PER_MONTH } from "./cost";

describe("periodWeeks", () => {
  it("conta o primeiro e o último dia do período", () => {
    expect(periodWeeks("2026-10-01", "2026-10-07")).toBe(1);
    expect(periodWeeks("2026-10-01", "2026-10-14")).toBe(2);
    expect(periodWeeks("2026-10-01", "2026-10-01")).toBeCloseTo(1 / 7);
  });

  it("período inválido ou invertido dá zero", () => {
    expect(periodWeeks("", "2026-10-07")).toBe(0);
    expect(periodWeeks("2026-10-10", "2026-10-01")).toBe(0);
  });
});

const basisOf = (overrides: Partial<CostBasis>): CostBasis => ({
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

describe("observedPremises", () => {
  it("calcula custo por conversa e conversas por usuário por semana", () => {
    const premises = observedPremises(basisOf({}));

    expect(premises.costPerConversation).toBeCloseTo(0.05);
    expect(premises.conversationsPerUserWeek).toBeCloseTo(2);
    expect(premises.observedUsers).toBe(10);
  });

  it("com menos de 2 usuários distintos não mede conversas por usuário", () => {
    const premises = observedPremises(basisOf({ conversations: 30, pricedConversations: 30, users: 1, costUsd: 3, weeks: 1 }));

    expect(premises.costPerConversation).toBeCloseTo(0.1);
    expect(premises.conversationsPerUserWeek).toBeNull();
  });

  it("sem conversas não há premissas", () => {
    const premises = observedPremises(basisOf({ conversations: 0, pricedConversations: 0, users: 0, costUsd: 0, costP50: 0, costP95: 0, weeks: 1 }));

    expect(premises.costPerConversation).toBeNull();
    expect(premises.conversationsPerUserWeek).toBeNull();
    expect(premises.origin.average).toBeNull();
    expect(premises.origin.median).toBeNull();
    expect(premises.origin.p95).toBeNull();
  });

  it("a média considera só as conversas com custo registrado", () => {
    const premises = observedPremises(basisOf({ conversations: 50, pricedConversations: 40, costUsd: 2 }));

    expect(premises.costPerConversation).toBeCloseTo(0.05);
    expect(premises.origin.average).toBeCloseTo(0.05);
    expect(premises.origin.averageAll).toBeCloseTo(0.04);
    expect(premises.origin.unpriced).toBe(10);
  });

  it("expõe a origem: período, totais, mediana e p95", () => {
    const { origin } = observedPremises(basisOf({}));

    expect(origin).toMatchObject({ from: "2026-10-01", to: "2026-10-14", conversations: 40, priced: 40, unpriced: 0, totalUsd: 2, median: 0.04, p95: 0.12 });
  });

  it("sem nenhuma conversa com custo não há média, mesmo havendo conversas", () => {
    const premises = observedPremises(basisOf({ conversations: 12, pricedConversations: 0, costUsd: 0, costP50: 0, costP95: 0 }));

    expect(premises.costPerConversation).toBeNull();
    expect(premises.origin.unpriced).toBe(12);
  });
});

describe("projectCost", () => {
  it("multiplica usuários, conversas por usuário e custo por conversa", () => {
    const result = projectCost(100, 3, 0.02);

    expect(result.perUserWeekly).toBeCloseTo(0.06);
    expect(result.weekly).toBeCloseTo(6);
    expect(result.monthly).toBeCloseTo(6 * WEEKS_PER_MONTH);
  });

  it("escala de forma linear de 100 para 1000 usuários", () => {
    expect(projectCost(1000, 2, 0.05).weekly).toBeCloseTo(projectCost(100, 2, 0.05).weekly * 10);
  });
});

describe("cenários", () => {
  it("só aceita inteiro de 1 a 1.000.000", () => {
    expect(parseScenario("50")).toBe(50);
    expect(parseScenario(" 1000000 ")).toBe(1_000_000);
    for (const invalid of ["", "0", "-5", "1.5", "abc", "1000001", "5e3"]) expect(parseScenario(invalid)).toBeNull();
  });

  it("100 e 1000 sempre estão na lista, junto dos extras, sem repetir e em ordem", () => {
    expect(scenarioList([])).toEqual([100, 1000]);
    expect(scenarioList([50, 100, 5000, 50])).toEqual([50, 100, 1000, 5000]);
  });

  it("aceita decimal com ponto ou vírgula nas premissas e recusa o resto", () => {
    expect(parsePositive("0,05")).toBeCloseTo(0.05);
    expect(parsePositive("2.5")).toBe(2.5);
    for (const invalid of ["", "0", "-1", "abc"]) expect(parsePositive(invalid)).toBeNull();
  });
});

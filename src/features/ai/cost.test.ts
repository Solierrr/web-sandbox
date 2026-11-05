import { describe, expect, it } from "vitest";
import { DEFAULT_HUMAN_COST_USD, GARTNER_ASSISTED_CONTACT_USD, observedPremises, type CostBasis, parsePositive, parseRate, parseScenario, periodWeeks, projectCost, projectReturn, scenarioList, WEEKS_PER_MONTH } from "./cost";

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
  resolvedConversations: 38,
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
    const premises = observedPremises(basisOf({ conversations: 30, pricedConversations: 30, resolvedConversations: 30, users: 1, costUsd: 3, weeks: 1 }));

    expect(premises.costPerConversation).toBeCloseTo(0.1);
    expect(premises.conversationsPerUserWeek).toBeNull();
  });

  it("sem conversas não há premissas", () => {
    const premises = observedPremises(basisOf({ conversations: 0, pricedConversations: 0, resolvedConversations: 0, users: 0, costUsd: 0, costP50: 0, costP95: 0, weeks: 1 }));

    expect(premises.costPerConversation).toBeNull();
    expect(premises.conversationsPerUserWeek).toBeNull();
    expect(premises.resolutionRate).toBeNull();
    expect(premises.costPerResolution).toBeNull();
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

describe("resolução", () => {
  it("calcula a taxa de resolução e o custo por resolução com o custo de todas as conversas", () => {
    const premises = observedPremises(basisOf({}));

    expect(premises.resolutionRate).toBeCloseTo(0.95);
    expect(premises.costPerResolution).toBeCloseTo(2 / 38);
    expect(premises.origin.resolved).toBe(38);
  });

  it("sem nenhuma resolução não há custo por resolução", () => {
    const premises = observedPremises(basisOf({ resolvedConversations: 0 }));

    expect(premises.resolutionRate).toBe(0);
    expect(premises.costPerResolution).toBeNull();
  });
});

describe("custo humano padrão", () => {
  it("é de US$ 2,00 por atendimento e fica bem abaixo da referência global do Gartner", () => {
    expect(DEFAULT_HUMAN_COST_USD).toBe(2);
    expect(GARTNER_ASSISTED_CONTACT_USD).toBe(13.5);
    expect(DEFAULT_HUMAN_COST_USD).toBeLessThan(GARTNER_ASSISTED_CONTACT_USD);
  });

  it("bate com a conta de baixo para cima de um atendente de chat no Brasil", () => {
    const salario = 1800;
    const custoTotal = salario * 1.7;
    const horasPagasPorMes = (37 * 52) / 12;
    const atendimentosPorHoraPaga = 0.55 * (60 / 11);
    const maoDeObra = custoTotal / horasPagasPorMes / atendimentosPorHoraPaga;
    const comEstrutura = maoDeObra * 1.4;
    const emDolar = comEstrutura / 5.15;

    expect(maoDeObra).toBeCloseTo(6.5, 0);
    expect(emDolar).toBeGreaterThan(1.6);
    expect(emDolar).toBeLessThan(2.2);
    expect(Math.round(emDolar)).toBe(DEFAULT_HUMAN_COST_USD);
  });
});

describe("projectReturn", () => {
  it("custo por resolução é o custo semanal dividido pelas resoluções", () => {
    const result = projectReturn(100, 2, 0.05, 0.8, null);

    expect(result.resolutionsWeekly).toBeCloseTo(160);
    expect(result.costPerResolution).toBeCloseTo(0.05 / 0.8);
    expect(result.roi).toBeNull();
  });

  it("ROI é o retorno das resoluções menos o custo da IA, dividido pelo custo da IA", () => {
    const result = projectReturn(100, 2, 0.05, 0.8, 2);

    expect(result.roi).toBeCloseTo((160 * 2 - 10) / 10);
  });

  it("ROI fica negativo quando o atendimento humano evitado custa menos que a IA", () => {
    expect(projectReturn(100, 2, 0.05, 0.8, 0.01).roi).toBeLessThan(0);
  });

  it("sem resoluções ou sem custo não há custo por resolução nem ROI", () => {
    expect(projectReturn(100, 2, 0.05, 0, 2).costPerResolution).toBeNull();
    expect(projectReturn(100, 2, 0, 0.8, 2).roi).toBeNull();
  });

  it("a taxa vem em porcentagem de 0 a 100", () => {
    expect(parseRate("95")).toBeCloseTo(0.95);
    expect(parseRate("0,5")).toBeCloseTo(0.005);
    for (const invalid of ["", "0", "101", "-1", "abc"]) expect(parseRate(invalid)).toBeNull();
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

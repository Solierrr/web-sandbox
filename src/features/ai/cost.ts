export const DEFAULT_SCENARIOS: readonly number[] = [100, 1000];
export const MAX_SCENARIO_USERS = 1_000_000;
export const WEEKS_PER_MONTH = 52 / 12;

/**
 * Custo padrão de um atendimento humano, em US$, para o ROI.
 *
 * Estimativa de baixo para cima para um atendente de chat/SAC no Brasil (2026):
 * - salário médio de atendente de telemarketing: R$ 1.800 por mês, jornada de 37 h por semana
 *   (CAGED, via Portal Salário);
 * - custo total para a empresa: x 1,7 de encargos e provisões do CLT (regra de bolso de 1,7 a 2,0),
 *   ou seja, cerca de R$ 19 por hora paga;
 * - 55% de ocupação (a Comm100 cita 50 a 60% como bom) e 11 minutos por chat (Comm100):
 *   cerca de 3 atendimentos por hora paga, o que dá cerca de R$ 6,50 só de mão de obra;
 * - mais 40% de supervisão, ferramentas e treinamento (premissa nossa, sem fonte): cerca de R$ 8,90;
 * - ao câmbio de cerca de R$ 5,15 por dólar: US$ 1,73, arredondado para US$ 2,00.
 *
 * Conferência: a planilha de custos do MDS (gov.br) lista "Chat - Atendimento humano" a R$ 9,99
 * por unidade. É uma estimativa para um atendimento de chat simples: um atendimento técnico mais
 * longo custa mais, e o valor é editável na tela.
 */
export const DEFAULT_HUMAN_COST_USD = 2;

/**
 * Mediana do Gartner para um contato assistido (telefone, chat ou e-mail) nos EUA, em US$.
 * Referência global, bem acima do Brasil por causa do custo da mão de obra.
 */
export const GARTNER_ASSISTED_CONTACT_USD = 13.5;
const DAY_MS = 86_400_000;

export interface CostBasis {
  from: string;
  to: string;
  conversations: number;
  pricedConversations: number;
  resolvedConversations: number;
  users: number;
  costUsd: number;
  costP50: number;
  costP95: number;
  weeks: number;
}

export interface CostOrigin {
  from: string;
  to: string;
  conversations: number;
  priced: number;
  unpriced: number;
  resolved: number;
  totalUsd: number;
  average: number | null;
  averageAll: number | null;
  median: number | null;
  p95: number | null;
}

export interface CostPremises {
  costPerConversation: number | null;
  resolutionRate: number | null;
  costPerResolution: number | null;
  conversationsPerUserWeek: number | null;
  observedUsers: number;
  origin: CostOrigin;
}

export interface CostProjection {
  weekly: number;
  monthly: number;
  perUserWeekly: number;
}

export function periodWeeks(from: string, to: string): number {
  const days = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
  return Number.isFinite(days) && days > 0 ? days / 7 : 0;
}

export function observedPremises(basis: CostBasis): CostPremises {
  const hasConversations = basis.conversations > 0 && basis.weeks > 0;
  const hasPriced = basis.pricedConversations > 0;
  const hasUsers = hasConversations && basis.users >= 2;
  return {
    costPerConversation: hasPriced ? basis.costUsd / basis.pricedConversations : null,
    resolutionRate: basis.conversations > 0 ? basis.resolvedConversations / basis.conversations : null,
    costPerResolution: basis.resolvedConversations > 0 ? basis.costUsd / basis.resolvedConversations : null,
    conversationsPerUserWeek: hasUsers ? basis.conversations / basis.users / basis.weeks : null,
    observedUsers: basis.users,
    origin: {
      from: basis.from,
      to: basis.to,
      conversations: basis.conversations,
      priced: basis.pricedConversations,
      unpriced: basis.conversations - basis.pricedConversations,
      resolved: basis.resolvedConversations,
      totalUsd: basis.costUsd,
      average: hasPriced ? basis.costUsd / basis.pricedConversations : null,
      averageAll: basis.conversations > 0 ? basis.costUsd / basis.conversations : null,
      median: hasPriced ? basis.costP50 : null,
      p95: hasPriced ? basis.costP95 : null,
    },
  };
}

export function projectCost(users: number, conversationsPerUserWeek: number, costPerConversation: number): CostProjection {
  const perUserWeekly = conversationsPerUserWeek * costPerConversation;
  const weekly = users * perUserWeekly;
  return { weekly, monthly: weekly * WEEKS_PER_MONTH, perUserWeekly };
}

export interface ReturnProjection {
  resolutionsWeekly: number;
  costPerResolution: number | null;
  roi: number | null;
}

export function projectReturn(
  users: number,
  conversationsPerUserWeek: number,
  costPerConversation: number,
  resolutionRate: number,
  humanCostPerResolution: number | null,
): ReturnProjection {
  const conversationsWeekly = users * conversationsPerUserWeek;
  const resolutionsWeekly = conversationsWeekly * resolutionRate;
  const weeklyCost = conversationsWeekly * costPerConversation;
  return {
    resolutionsWeekly,
    costPerResolution: resolutionsWeekly > 0 ? weeklyCost / resolutionsWeekly : null,
    roi: humanCostPerResolution !== null && weeklyCost > 0 ? (resolutionsWeekly * humanCostPerResolution - weeklyCost) / weeklyCost : null,
  };
}

export function parseRate(text: string): number | null {
  const value = parsePositive(text);
  return value !== null && value <= 100 ? value / 100 : null;
}

export function parseScenario(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value >= 1 && value <= MAX_SCENARIO_USERS ? value : null;
}

export function parsePositive(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

export function scenarioList(extra: readonly number[]): number[] {
  return [...new Set([...DEFAULT_SCENARIOS, ...extra])].sort((a, b) => a - b);
}

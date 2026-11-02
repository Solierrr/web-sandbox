export const DEFAULT_SCENARIOS: readonly number[] = [100, 1000];
export const MAX_SCENARIO_USERS = 1_000_000;
export const WEEKS_PER_MONTH = 52 / 12;
const DAY_MS = 86_400_000;

export interface CostBasis {
  from: string;
  to: string;
  conversations: number;
  pricedConversations: number;
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
  totalUsd: number;
  average: number | null;
  averageAll: number | null;
  median: number | null;
  p95: number | null;
}

export interface CostPremises {
  costPerConversation: number | null;
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
    conversationsPerUserWeek: hasUsers ? basis.conversations / basis.users / basis.weeks : null,
    observedUsers: basis.users,
    origin: {
      from: basis.from,
      to: basis.to,
      conversations: basis.conversations,
      priced: basis.pricedConversations,
      unpriced: basis.conversations - basis.pricedConversations,
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

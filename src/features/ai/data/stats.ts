import type { AssistantRow, ConversationSummary, DashboardData, DayPoint } from "./types";

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function npsOf(scores: (number | null)[]) {
  const answered = scores.filter((score): score is number => score !== null);
  if (!answered.length) return null;
  const promoters = answered.filter((score) => score >= 9).length;
  const detractors = answered.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) / answered.length) * 100);
}

const sum = (items: ConversationSummary[], pick: (item: ConversationSummary) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

export const MAX_CHART_DAYS = 92;

export function summarize(items: ConversationSummary[], from: string, to: string): DashboardData {
  const byDay: DayPoint[] = [];
  const end = Date.parse(to);
  const start = Math.max(Date.parse(from), end - (MAX_CHART_DAYS - 1) * 86400000);
  for (let time = start; time <= end; time += 86400000) {
    const key = new Date(time).toISOString().slice(0, 10);
    const rows = items.filter((item) => item.startedAt.slice(0, 10) === key);
    byDay.push({
      day: key,
      conversations: rows.length,
      costUsd: sum(rows, (item) => item.costUsd),
      p95Ms: percentile(rows.map((item) => item.latencyMs), 95),
      errors: rows.filter((item) => item.error).length,
    });
  }
  const byAssistant: AssistantRow[] = [...new Set(items.map((item) => item.assistant))].sort().map((assistant) => {
    const rows = items.filter((item) => item.assistant === assistant);
    return {
      assistant,
      conversations: rows.length,
      nps: npsOf(rows.map((item) => item.nps)),
      costUsd: sum(rows, (item) => item.costUsd),
      p95Ms: percentile(rows.map((item) => item.latencyMs), 95),
      errorRate: rows.filter((item) => item.error).length / rows.length,
    };
  });
  const pricedCosts = items.map((item) => item.costUsd).filter((cost) => cost > 0);
  return {
    totals: {
      conversations: items.length,
      users: new Set(items.map((item) => item.userId)).size,
      pricedConversations: pricedCosts.length,
      nps: npsOf(items.map((item) => item.nps)),
      costUsd: sum(items, (item) => item.costUsd),
      costP50: percentile(pricedCosts, 50),
      costP95: percentile(pricedCosts, 95),
      p50Ms: percentile(items.map((item) => item.latencyMs), 50),
      p95Ms: percentile(items.map((item) => item.latencyMs), 95),
      errorRate: items.length ? items.filter((item) => item.error).length / items.length : 0,
    },
    byDay,
    byAssistant,
  };
}

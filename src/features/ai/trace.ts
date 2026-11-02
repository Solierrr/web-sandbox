export interface DebugLlmCall {
  model: string | null;
  prompt: unknown;
  completion: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  error: string | null;
  node?: string | null;
  prompt_complete?: boolean;
}

export interface DebugTool {
  name: string;
  description?: string | null;
}

export interface DebugToolCall {
  name: string;
  input: unknown;
  output: unknown;
  duration_ms: number | null;
  status: string;
  error: string | null;
}

export interface DebugNode {
  order: number;
  node: string;
  started_at?: string;
  duration_ms: number | null;
  status: string;
  input: unknown;
  output: unknown;
  llm_calls: DebugLlmCall[];
  tools?: DebugTool[];
  tool_calls?: DebugToolCall[];
  error: string | null;
}

export interface DebugInfo {
  nodes: DebugNode[];
  llm_calls_outside_nodes?: DebugLlmCall[];
  tool_calls_outside_nodes?: DebugToolCall[];
  truncated?: boolean;
  duration_ms?: number;
  environment?: string;
  persisted?: boolean;
  dry_run?: boolean;
  turn?: number | null;
  run_id?: string;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export function asDebugInfo(value: unknown): DebugInfo | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DebugInfo>;
  if (!Array.isArray(candidate.nodes)) return null;
  return candidate as DebugInfo;
}

export function toolCallsOf(node: DebugNode): DebugToolCall[] {
  return Array.isArray(node.tool_calls) ? node.tool_calls.filter((call) => call && typeof call.name === "string") : [];
}

export function toolsOf(node: DebugNode): DebugTool[] {
  const listed = new Map<string, DebugTool>();
  for (const tool of Array.isArray(node.tools) ? node.tools : []) if (tool && typeof tool.name === "string") listed.set(tool.name, tool);
  for (const call of toolCallsOf(node)) if (!listed.has(call.name)) listed.set(call.name, { name: call.name });
  return [...listed.values()];
}

export function toolUsage(node: DebugNode): Map<string, number> {
  const usage = new Map<string, number>();
  for (const call of toolCallsOf(node)) usage.set(call.name, (usage.get(call.name) ?? 0) + 1);
  return usage;
}

export function turnToolCalls(debug: DebugInfo): DebugToolCall[] {
  const seen = new Set<string>();
  const calls: DebugToolCall[] = [];
  for (const call of [...debug.nodes.flatMap(toolCallsOf), ...(debug.tool_calls_outside_nodes ?? [])]) {
    const key = `${call.name}|${call.duration_ms}|${JSON.stringify(call.input) ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(call);
  }
  return calls;
}

export function nodeTokens(node: DebugNode) {
  return node.llm_calls.reduce(
    (total, call) => ({
      input: total.input + (call.tokens_in ?? 0),
      output: total.output + (call.tokens_out ?? 0),
    }),
    { input: 0, output: 0 },
  );
}

export function nodeModels(node: DebugNode): string[] {
  return [...new Set(node.llm_calls.map((call) => call.model).filter((model): model is string => Boolean(model)))];
}

export function totalTokens(debug: DebugInfo) {
  const calls = [...debug.nodes.flatMap((node) => node.llm_calls), ...(debug.llm_calls_outside_nodes ?? [])];
  return calls.reduce(
    (total, call) => ({
      input: total.input + (call.tokens_in ?? 0),
      output: total.output + (call.tokens_out ?? 0),
      calls: total.calls + 1,
    }),
    { input: 0, output: 0, calls: 0 },
  );
}

export function formatMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "-";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatJson(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

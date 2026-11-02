import { describe, expect, it } from "vitest";
import { asDebugInfo, formatMs, nodeTokens, toolCallsOf, toolsOf, toolUsage, totalTokens, turnToolCalls, type DebugNode, type DebugToolCall } from "./trace";

const call = (tokens_in: number | null, tokens_out: number | null) => ({
  model: "m", prompt: [], completion: "", tokens_in, tokens_out, latency_ms: 1, error: null,
});
const node = (llm_calls: DebugNode["llm_calls"]): DebugNode => ({
  order: 1, node: "n", duration_ms: 1, status: "ok", input: null, output: null, llm_calls, error: null,
});

describe("trace", () => {
  it("soma tokens ignorando valores ausentes", () => {
    expect(nodeTokens(node([call(10, 5), call(null, 2)]))).toEqual({ input: 10, output: 7 });
    const info = { nodes: [node([call(1, 1)])], llm_calls_outside_nodes: [call(2, 3)] };
    expect(totalTokens(info)).toEqual({ input: 3, output: 4, calls: 2 });
  });
  it("só aceita debug com lista de nós", () => {
    expect(asDebugInfo(null)).toBeNull();
    expect(asDebugInfo({ nodes: "x" })).toBeNull();
    expect(asDebugInfo({ nodes: [] })).toEqual({ nodes: [] });
  });
  it("formata duração", () => {
    expect(formatMs(null)).toBe("-");
    expect(formatMs(850.4)).toBe("850 ms");
    expect(formatMs(2500)).toBe("2.5 s");
  });
});

const toolCall = (name: string, input: unknown = { q: 1 }, duration_ms: number | null = 5): DebugToolCall => ({
  name, input, output: "ok", duration_ms, status: "ok", error: null,
});

describe("tools", () => {
  it("junta as tools disponíveis com as chamadas e conta o uso", () => {
    const item: DebugNode = {
      ...node([]),
      tools: [{ name: "buscar_tela", description: "Acha a tela." }, { name: "buscar_guia" }],
      tool_calls: [toolCall("buscar_tela"), toolCall("buscar_tela", { q: 2 }), toolCall("fora_da_lista")],
    };

    expect(toolsOf(item).map((tool) => tool.name)).toEqual(["buscar_tela", "buscar_guia", "fora_da_lista"]);
    expect(toolsOf(item)[0].description).toBe("Acha a tela.");
    expect(toolUsage(item).get("buscar_tela")).toBe(2);
    expect(toolUsage(item).has("buscar_guia")).toBe(false);
  });

  it("nó sem tools não quebra e ignora lixo", () => {
    expect(toolCallsOf(node([]))).toEqual([]);
    expect(toolsOf(node([]))).toEqual([]);
    expect(toolCallsOf({ ...node([]), tool_calls: [null as unknown as DebugToolCall, toolCall("a")] })).toHaveLength(1);
  });

  it("as chamadas do turno não se repetem quando o nó do agente e o passo interno têm a mesma", () => {
    const same = toolCall("minhas_ofertas");
    const info = {
      nodes: [
        { ...node([]), tool_calls: [same] },
        { ...node([]), tool_calls: [{ ...same }] },
      ],
      tool_calls_outside_nodes: [toolCall("solta", null, 1)],
    };

    expect(turnToolCalls(info).map((call) => call.name)).toEqual(["minhas_ofertas", "solta"]);
  });
});


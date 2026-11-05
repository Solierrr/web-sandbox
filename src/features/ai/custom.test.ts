import { describe, expect, it } from "vitest";
import { changedPrompts, editableMessageIndexes, isEditable, lastUserMessage, promptParts, rebuildPrompt } from "./custom";
import type { DebugNode } from "./trace";

const node = (prompt: unknown): DebugNode => ({
  order: 1, node: "router", status: "ok", duration_ms: 1, input: {}, output: {}, error: null,
  llm_calls: [{ model: null, prompt, completion: null, tokens_in: null, tokens_out: null, latency_ms: null, error: null }],
});

describe("custom", () => {
  it("entende prompt em texto, em mensagens e recusa outros formatos", () => {
    expect(promptParts("oi")).toEqual([{ type: "prompt", content: "oi" }]);
    expect(promptParts([{ type: "system", content: "a" }, { type: "human", content: "b" }])).toHaveLength(2);
    expect(promptParts([{ foo: 1 }])).toBeNull();
    expect(promptParts([])).toBeNull();
    expect(promptParts({ a: 1 })).toBeNull();
  });

  it("reconstrói no formato original", () => {
    expect(rebuildPrompt("oi", ["tchau"])).toEqual([{ type: "prompt", content: "tchau" }]);
    expect(rebuildPrompt([{ type: "system", content: "a" }, { type: "human", content: "b" }], ["x", "b"])).toEqual([
      { type: "system", content: "x" },
      { type: "human", content: "b" },
    ]);
  });

  it("só envia as chamadas que mudaram", () => {
    const base = node([{ type: "system", content: "a" }]);
    expect(changedPrompts(base, 0, {})).toEqual([]);
    expect(changedPrompts(base, 0, { "0:0": ["a"] })).toEqual([]);
    expect(changedPrompts(base, 0, { "0:0": ["b"] })).toEqual([{ call: 0, prompt: [{ type: "system", content: "b" }] }]);
    expect(changedPrompts(base, 1, { "0:0": ["b"] })).toEqual([]);
    const misto = node([{ type: "system", content: "a" }, { type: "human", content: "oi" }]);
    expect(changedPrompts(misto, 0, { "0:0": ["a", "mudou"] })).toEqual([
      { call: 0, prompt: [{ type: "system", content: "a" }, { type: "human", content: "mudou" }] },
    ]);
    expect(changedPrompts(node("texto"), 0, { "0:0": ["outro"] })).toEqual([]);
  });

  it("a marca editable do serviço manda; sem ela system, human e ai são editáveis e tool não", () => {
    expect(isEditable({ type: "human", content: "x", editable: true })).toBe(true);
    expect(isEditable({ type: "system", content: "x", editable: false })).toBe(false);
    expect(isEditable({ type: "system", content: "x" })).toBe(true);
    expect(isEditable({ type: "human", content: "x" })).toBe(true);
    expect(isEditable({ type: "ai", content: "x" })).toBe(true);
    expect(isEditable({ type: "tool", content: "x" })).toBe(false);
    const parts = promptParts([{ type: "human", content: "a", editable: true }]);
    expect(parts).toEqual([{ type: "human", content: "a", editable: true }]);
  });

  describe("lastUserMessage", () => {
    it("devolve a última mensagem do usuário e a posição dela", () => {
      const messages = [
        { role: "user", text: "primeira" },
        { role: "assistant", text: "resposta" },
        { role: "user", text: "segunda" },
        { role: "assistant", text: "outra" },
      ];
      expect(lastUserMessage(messages)).toEqual({ index: 2, text: "segunda" });
    });

    it("sem mensagem do usuário devolve null", () => {
      expect(lastUserMessage([])).toBeNull();
      expect(lastUserMessage([{ role: "assistant", text: "oi" }])).toBeNull();
    });
  });

  describe("editableMessageIndexes", () => {
    const conversa = [
      { role: "user", text: "o que voce faz ?" },
      { role: "assistant", text: "Sou o assistente." },
      { role: "user", text: "o que a solaria é?" },
      { role: "assistant", text: "resposta final do turno" },
    ];

    it("quando a posição bate com a do nó, todas as mensagens até a última do usuário são editáveis", () => {
      expect(editableMessageIndexes({ message_count: 3 }, conversa, false)).toEqual({ indexes: [0, 1, 2], lastIndex: 2 });
    });

    it("a resposta final do turno não faz parte da entrada do nó e nunca é editável", () => {
      expect(editableMessageIndexes({ message_count: 3 }, conversa, false).indexes).not.toContain(3);
    });

    it("sem message_count, ou com contagem diferente, só a última do usuário é editável", () => {
      expect(editableMessageIndexes({}, conversa, false)).toEqual({ indexes: [2], lastIndex: 2 });
      expect(editableMessageIndexes({ message_count: 2 }, conversa, false)).toEqual({ indexes: [2], lastIndex: 2 });
      expect(editableMessageIndexes(null, conversa, false)).toEqual({ indexes: [2], lastIndex: 2 });
    });

    it("com resumo da conversa, as posições não batem e só a última do usuário é editável", () => {
      expect(editableMessageIndexes({ message_count: 3 }, conversa, true)).toEqual({ indexes: [2], lastIndex: 2 });
    });

    it("sem mensagem do usuário não há o que editar", () => {
      expect(editableMessageIndexes({ message_count: 1 }, [{ role: "assistant", text: "oi" }], false)).toEqual({ indexes: [], lastIndex: null });
    });
  });

  it("o prompt do CNPJ (uma mensagem human editável) entra no pedido quando muda", () => {
    const cnpj = node([{ type: "human", content: "Analise os CNAEs", editable: true }]);
    expect(changedPrompts(cnpj, 0, { "0:0": ["Analise com mais rigor"] })).toEqual([
      { call: 0, prompt: [{ type: "human", content: "Analise com mais rigor", editable: true }] },
    ]);
  });
});

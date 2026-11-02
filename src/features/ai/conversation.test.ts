import { describe, expect, it } from "vitest";
import { nodeConversation } from "./conversation";

const history = [
  { role: "user" as const, text: "Oi" },
  { role: "assistant" as const, text: "Olá, como ajudo?" },
  { role: "user" as const, text: "Preciso de instalador em SP" },
];

describe("nodeConversation", () => {
  it("sem resumo mostra a conversa toda, com a mensagem do usuário no fim", () => {
    const result = nodeConversation({ message_count: 3, last_message: { type: "human", content: "Preciso de instalador em SP" } }, history);

    expect(result.summary).toBeNull();
    expect(result.messages).toEqual(history);
  });

  it("com resumo mostra o resumo e a mensagem do usuário, sem o resto da conversa", () => {
    const result = nodeConversation({ summary: "  Quer instalador em SP.  ", last_message: { type: "human", content: "Preciso de instalador em SP" } }, history);

    expect(result.summary).toBe("Quer instalador em SP.");
    expect(result.messages).toEqual([{ role: "user", text: "Preciso de instalador em SP" }]);
  });

  it("com resumo, a última mensagem vista pelo nó aparece depois da do usuário", () => {
    const result = nodeConversation({ summary: "Resumo", last_message: { type: "ai", content: "Achei 3 profissionais" } }, history);

    expect(result.messages).toEqual([
      { role: "user", text: "Preciso de instalador em SP" },
      { role: "assistant", text: "Achei 3 profissionais" },
    ]);
  });

  it("sem resumo, uma mensagem nova do nó é acrescentada à conversa", () => {
    const result = nodeConversation({ last_message: { type: "ai", content: "Parcial" } }, history);

    expect(result.messages).toEqual([...history, { role: "assistant", text: "Parcial" }]);
  });

  it("sem histórico usa a última mensagem do nó", () => {
    const result = nodeConversation({ last_message: { type: "human", content: "Oi" } }, []);

    expect(result.messages).toEqual([{ role: "user", text: "Oi" }]);
  });

  it("entrada inválida não quebra", () => {
    expect(nodeConversation(null, [])).toEqual({ summary: null, messages: [] });
    expect(nodeConversation({ summary: "", last_message: "x" }, history).messages).toEqual(history);
    expect(nodeConversation({ summary: 5 }, history).summary).toBeNull();
  });
});

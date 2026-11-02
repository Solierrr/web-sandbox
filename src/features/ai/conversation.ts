import type { PlaygroundMessage } from "./playground";

export interface NodeConversation {
  summary: string | null;
  messages: PlaygroundMessage[];
}

const roleOf = (type: unknown): PlaygroundMessage["role"] | null => {
  if (type === "human" || type === "user") return "user";
  if (type === "ai" || type === "assistant") return "assistant";
  return null;
};

const sameMessage = (a: PlaygroundMessage, b: PlaygroundMessage) => a.role === b.role && a.text === b.text;

function inputLastMessage(value: unknown): PlaygroundMessage | null {
  if (!value || typeof value !== "object") return null;
  const { type, content } = value as { type?: unknown; content?: unknown };
  const role = roleOf(type);
  return role && typeof content === "string" && content.trim() ? { role, text: content } : null;
}

export function nodeConversation(input: unknown, history: PlaygroundMessage[]): NodeConversation {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : null;
  const seen = inputLastMessage(data.last_message);
  const turnUser = [...history].reverse().find((message) => message.role === "user") ?? null;
  const base = summary ? (turnUser ? [turnUser] : []) : history;
  const messages = seen && !base.some((message) => sameMessage(message, seen)) ? [...base, seen] : base;
  return { summary, messages };
}

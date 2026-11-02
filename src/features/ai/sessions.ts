import { useSyncExternalStore } from "react";
import type { ConversationDetail, ConversationMessage } from "./data/types";
import type { PlaygroundRun } from "./playground";
import type { DebugOutcome } from "./debug.service";
import type { Replay } from "./replay";

export interface SimulatorTurn {
  userText: string;
  outcome: DebugOutcome;
  at: string;
  replay?: Replay;
}

export interface SimulatorSession {
  sessionId: string;
  run: Omit<PlaygroundRun, "messages" | "outcome" | "conversationId">;
  turns: SimulatorTurn[];
}

const sessions = new Map<string, SimulatorSession>();
const listeners = new Set<() => void>();
let version = 0;

export function recordSimulatorTurn(
  sessionId: string,
  run: Omit<PlaygroundRun, "messages" | "outcome" | "conversationId">,
  turn: SimulatorTurn,
) {
  const existing = sessions.get(sessionId);
  sessions.set(sessionId, { sessionId, run, turns: [...(existing?.turns ?? []), turn] });
  version++;
  for (const listener of listeners) listener();
}

export const getSimulatorSession = (sessionId: string) => sessions.get(sessionId);

export function clearSimulatorSessions() {
  sessions.clear();
  version++;
  for (const listener of listeners) listener();
}

export function useSimulatorSessionsVersion() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => version,
  );
}

export const answerText = (outcome: DebugOutcome) => {
  if (!outcome.ok) return outcome.message;
  if (typeof outcome.body.response === "string") return outcome.body.response;
  try {
    return JSON.stringify(outcome.body);
  } catch {
    return "";
  }
};

export function sessionDetail(session: SimulatorSession): ConversationDetail {
  const messages: ConversationMessage[] = session.turns.flatMap(({ userText, outcome, at, replay }) => {
    const agents = outcome.ok && Array.isArray(outcome.body.specialists_used) ? outcome.body.specialists_used.map(String) : [];
    return [
      { role: "user" as const, content: userText, at },
      {
        role: "assistant" as const,
        content: answerText(outcome),
        at,
        agent: agents.length ? agents[agents.length - 1] : undefined,
        trace: outcome.debug?.nodes ?? [],
        latencyMs: outcome.elapsed,
        costUsd: null,
        replay,
      },
    ];
  });
  const replies = messages.filter((message) => message.role === "assistant");
  return {
    sessionId: session.sessionId,
    userId: "sandbox",
    assistant: session.run.target.id,
    environment: session.run.environment,
    startedAt: session.turns[0]?.at ?? new Date().toISOString(),
    messageCount: messages.length,
    firstMessage: messages[0]?.content ?? "",
    nps: null,
    costUsd: 0,
    latencyMs: replies.reduce((total, message) => total + (message.latencyMs ?? 0), 0),
    error: session.turns.some((turn) => !turn.outcome.ok),
    messages,
    metadata: {},
    trace: replies[replies.length - 1]?.trace ?? [],
  };
}

import { useSyncExternalStore } from "react";
import type { DebugOutcome } from "./debug.service";
import type { Replay } from "./replay";
import type { AiTarget, EnvId } from "./targets";

export interface PlaygroundMessage {
  role: "user" | "assistant";
  text: string;
}

export interface PlaygroundRun {
  target: AiTarget;
  environment: EnvId;
  conversationId: string;
  messages: PlaygroundMessage[];
  outcome: DebugOutcome;
  demo: boolean;
  replay?: Replay;
  replayReason?: string;
  localUrl?: string;
  back?: { to: string; label: string };
}

let current: PlaygroundRun | null = null;
const listeners = new Set<() => void>();

export const getPlaygroundRun = () => current;

export function setPlaygroundRun(run: PlaygroundRun | null) {
  current = run;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlaygroundRun() {
  return useSyncExternalStore(subscribe, getPlaygroundRun);
}

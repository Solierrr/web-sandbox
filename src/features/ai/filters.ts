import { useSyncExternalStore } from "react";
import type { EnvId } from "./targets";

export interface AiFilters {
  environment: EnvId;
  assistant: string;
  from: string;
  to: string;
}

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

let current: AiFilters = { environment: "QA", assistant: "", from: day(-7), to: day(0) };
const listeners = new Set<() => void>();

export const getFilters = () => current;

export function setFilters(patch: Partial<AiFilters>) {
  current = { ...current, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFilters() {
  return useSyncExternalStore(subscribe, getFilters);
}

export function resetFilters() {
  current = { environment: "QA", assistant: "", from: day(-7), to: day(0) };
  for (const listener of listeners) listener();
}

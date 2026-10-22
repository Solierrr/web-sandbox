import { entries } from "./catalog";

export interface KeepaliveTarget {
  id: string;
  url: string;
}

export interface KeepaliveSet {
  id: string;
  label: string;
  ids: string[];
}

const ALWAYS_ON = new Set(["web-app", "web-sandbox", "lib-web"]);

export const targets: KeepaliveTarget[] = entries
  .filter((entry) => entry.kind === "service" && entry.qa && !ALWAYS_ON.has(entry.id))
  .map((entry) => ({ id: entry.id, url: entry.qa as string }));

const known = new Set(targets.map((target) => target.id));
const only = (ids: string[]) => ids.filter((id) => known.has(id));

export const keepaliveSets: KeepaliveSet[] = [
  { id: "essentials", label: "Essenciais", ids: only(["api-auth", "api-core", "api-messenger"]) },
  { id: "ai", label: "IA", ids: targets.map((target) => target.id).filter((id) => id.startsWith("ai-")) },
  { id: "all", label: "Todos", ids: targets.map((target) => target.id) },
].filter((set) => set.ids.length > 0);

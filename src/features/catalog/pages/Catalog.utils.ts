import { filterGroups, type CatalogEntry, type FilterGroupId } from "../../../config/catalog";

export interface CatalogStack {
  id: string;
  dimension: FilterGroupId;
  label: string;
  entries: CatalogEntry[];
}

export function groupByStack(entries: CatalogEntry[]): CatalogStack[] {
  const groups = new Map<string, CatalogStack>();
  for (const entry of entries) {
    const dimension = entry.frameworks.length ? "framework" : entry.language ? "language" : "kind";
    const id = entry.frameworks[0] ?? entry.language ?? entry.kind;
    const key = `${dimension}:${id}`;
    let group = groups.get(key);
    if (!group) {
      const label = filterGroups.find((item) => item.id === dimension)?.options.find((item) => item.id === id)?.label ?? id;
      group = { id, dimension, label, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()].sort((first, second) => {
    const rank = (group: CatalogStack) => group.dimension === "framework" ? group.id === "react" ? 0 : 1 : group.dimension === "language" ? 2 : 3;
    return rank(first) - rank(second) || first.label.localeCompare(second.label, "pt-BR");
  });
}

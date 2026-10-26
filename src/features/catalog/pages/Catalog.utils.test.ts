import { describe, expect, it } from "vitest";
import { entries, matches } from "../../../config/catalog";
import { groupByStack } from "./Catalog.utils";

describe("groupByStack", () => {
  it("agrupa os webs e a biblioteca React existentes", () => {
    const groups = groupByStack(entries);
    expect(groups[0].id).toBe("react");
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["lib-web", "web-app", "web-sandbox"]);
  });

  it("mantém cada repositório uma única vez mesmo com múltiplos frameworks", () => {
    const groups = groupByStack(entries);
    const ids = groups.flatMap((group) => group.entries.map((entry) => entry.id));
    expect(ids).toHaveLength(entries.length);
    expect(new Set(ids).size).toBe(entries.length);
    expect(groups.find((group) => group.id === "langchain")?.entries.map((entry) => entry.id)).toContain("ai-assistant");
    expect(groups.every((group) => group.label.length > 0)).toBe(true);
  });

  it("preserva filtros combinados e resultados vazios", () => {
    const filtered = entries.filter((entry) => matches(entry, { framework: "spring", language: "kotlin" }));
    const groups = groupByStack(filtered);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("spring");
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["api-auth"]);
    expect(groupByStack([])).toEqual([]);
  });
});

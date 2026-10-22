import { describe, expect, it } from "vitest";
import { keepaliveSets, targets } from "./keepalive";

describe("alvos do keepalive", () => {
  it("só inclui serviços que dormem e têm URL de QA", () => {
    const ids = targets.map((target) => target.id);
    expect(ids).toContain("api-auth");
    expect(ids).toContain("ai-assistant");
    expect(ids).toContain("api-google");
    expect(ids).not.toContain("docs-warehouse");
    expect(ids).not.toContain("web-app");
    expect(ids).not.toContain("web-sandbox");
    expect(ids).not.toContain("lib-web");
    expect(targets.every((target) => target.url.startsWith("https://"))).toBe(true);
  });

  it("define conjuntos predefinidos compostos apenas por alvos existentes", () => {
    const ids = new Set(targets.map((target) => target.id));
    expect(keepaliveSets.map((set) => set.id)).toEqual(["essentials", "ai", "all"]);
    for (const set of keepaliveSets) expect(set.ids.every((id) => ids.has(id))).toBe(true);
    expect(keepaliveSets.find((set) => set.id === "all")?.ids).toHaveLength(targets.length);
    expect(keepaliveSets.find((set) => set.id === "ai")?.ids.every((id) => id.startsWith("ai-"))).toBe(true);
  });
});

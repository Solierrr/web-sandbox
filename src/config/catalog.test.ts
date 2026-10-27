import { describe, expect, it } from "vitest";
import { entries, filterGroups, matches, storybooks, withPath } from "./catalog";

const find = (id: string) => entries.find((entry) => entry.id === id);
const ids = (filters: Parameters<typeof matches>[1]) =>
  entries.filter((entry) => matches(entry, filters)).map((entry) => entry.id);

describe("catálogo de repositórios", () => {
  it("lista os repositórios do Solaria sem os do Elos", () => {
    expect(find("api-core")).toBeDefined();
    expect(find("docs-warehouse")).toBeDefined();
    expect(entries.some((entry) => entry.id.startsWith("elos-"))).toBe(false);
  });

  it("filtra por framework, linguagem e tipo", () => {
    expect(ids({ framework: "spring" })).toEqual(["api-auth", "api-core", "api-messenger", "api-notify"]);
    expect(ids({ framework: "react" })).toEqual(["lib-web", "web-app", "web-sandbox"]);
    expect(ids({ framework: "fastapi" })).toEqual(
      expect.arrayContaining(["ai-assistant", "api-recommendation", "api-google"]),
    );
    expect(ids({ language: "kotlin" })).toEqual(expect.arrayContaining(["api-auth", "mobile-app"]));
    expect(ids({ kind: "docs" })).toEqual(expect.arrayContaining(["docs-warehouse", "docs-reports"]));
    expect(ids({ kind: "library" })).toEqual(["lib-ai", "lib-web"]);
  });

  it("combina os filtros", () => {
    expect(ids({ framework: "fastapi", language: "python", kind: "service" })).not.toContain("api-auth");
    expect(ids({ framework: "spring", language: "kotlin" })).toEqual(["api-auth"]);
    expect(ids({ framework: "spring", kind: "docs" })).toEqual([]);
  });

  it("oferece opções de framework, linguagem e tipo", () => {
    expect(filterGroups.map((group) => group.id)).toEqual(["framework", "language", "kind"]);
    expect(filterGroups.every((group) => group.options.length >= 4)).toBe(true);
  });

  it("usa o caminho de Swagger de cada tecnologia em QA e PROD", () => {
    const core = find("api-core");
    expect(withPath(core?.qa, core?.swaggerPath)).toBe("https://api-core-cqfn.onrender.com/swagger-ui/index.html");
    expect(withPath(core?.prod, core?.swaggerPath)).toBe("https://api-core.solarianetwork.site/swagger-ui/index.html");
    const assistant = find("ai-assistant");
    expect(withPath(assistant?.prod, assistant?.swaggerPath)).toBe("https://ai-assistant.solarianetwork.site/docs");
  });

  it("não inventa ambientes que não existem", () => {
    for (const id of ["lib-web", "docs-warehouse", "infra-platform", "mobile-app"]) {
      expect(find(id)?.qa).toBeUndefined();
      expect(find(id)?.prod).toBeUndefined();
    }
    expect(find("web-sandbox")?.prod).toBeUndefined();
    expect(find("mcp-database")?.prod).toBeUndefined();
    expect(find("web-app")?.prod).toBe("https://solarianetwork.site/");
    expect(find("web-app")?.qa).toBe("https://web-app-ldi0.onrender.com/");
  });

  it("aponta o Storybook para o GitHub Pages", () => {
    expect(storybooks.map((book) => book.href)).toEqual([
      "https://solierrr.github.io/web-app/",
      "https://solierrr.github.io/lib-web/",
    ]);
  });
});

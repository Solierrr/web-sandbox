import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiDoc } from "../../config/apis";

const api: ApiDoc = {
  id: "api-core",
  description: "",
  url: "https://qa.example.test/",
  specPath: "/v3/api-docs",
};
const document = {
  openapi: "3.1.0",
  info: { title: "Core", version: "1.2.3" },
  servers: [{ url: "http://localhost:8080" }],
  paths: {
    "/api/models": {
      get: { summary: "Lista modelos", tags: ["models"] },
      post: { tags: ["models"] },
      parameters: [],
    },
    "/api/offers/{id}": { delete: {}, patch: { summary: "Status" } },
  },
};
const session = (expiresAt: string) => ({
  accessToken: "access-old",
  refreshToken: "refresh-old",
  email: "qa@example.test",
  userId: "qa-user",
  accessTokenExpiresAt: expiresAt,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseSpec", () => {
  it("lista todas as operações, ignora chaves que não são método e aponta Servers para o ambiente", async () => {
    const { parseSpec } = await import("./openapi.service");
    const spec = parseSpec(api, document);
    expect(spec.title).toBe("Core");
    expect(spec.version).toBe("1.2.3");
    expect(spec.operations.map((item) => `${item.method} ${item.path}`)).toEqual([
      "get /api/models",
      "post /api/models",
      "patch /api/offers/{id}",
      "delete /api/offers/{id}",
    ]);
    expect(spec.operations[1].tag).toBe("models");
    expect(spec.operations[2].tag).toBe("default");
    expect(spec.document.servers).toEqual([
      { url: "https://qa.example.test", description: "Ambiente do portal" },
    ]);
  });

  it("recusa uma resposta que não é OpenAPI", async () => {
    const { parseSpec } = await import("./openapi.service");
    expect(() => parseSpec(api, { hello: "world" })).toThrow(/OpenAPI/);
  });
});

describe("loadSpec", () => {
  it("guarda a primeira busca em cache e refaz depois de uma falha", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValue(json(document));
    vi.stubGlobal("fetch", fetcher);
    const { loadSpec } = await import("./openapi.service");
    await expect(loadSpec(api)).rejects.toThrow(/Sem resposta/);
    await expect(loadSpec(api)).resolves.toMatchObject({ title: "Core" });
    await loadSpec(api);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("https://qa.example.test/v3/api-docs");
  });

  it("explica o 404 de documentação desativada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 404)));
    const { loadSpec } = await import("./openapi.service");
    await expect(loadSpec(api)).rejects.toThrow(/desativada/);
  });
});

describe("authorize (login único)", () => {
  it("não envia o token para outra origem", async () => {
    sessionStorage.setItem(
      "solaria.sandbox.session",
      JSON.stringify(session("2099-01-01T00:00:00Z")),
    );
    const { authorize, sameOrigin } = await import("./openapi.service");
    expect(sameOrigin("https://qa.example.test/x", api.url)).toBe(true);
    expect(sameOrigin("https://evil.example.test/x", api.url)).toBe(false);
    const foreign = { url: "https://evil.example.test/x", headers: {} as Record<string, string> };
    expect((await authorize(api, foreign)).headers.Authorization).toBeUndefined();
    const own = { url: "https://qa.example.test/api/models", headers: {} as Record<string, string> };
    expect((await authorize(api, own)).headers.Authorization).toBe("Bearer access-old");
  });

  it("segue sem Authorization quando não há login", async () => {
    const { authorize } = await import("./openapi.service");
    const request = { url: "https://qa.example.test/x", headers: {} as Record<string, string> };
    expect((await authorize(api, request)).headers.Authorization).toBeUndefined();
  });

  it("renova a sessão antes de expirar e usa o token novo", async () => {
    sessionStorage.setItem(
      "solaria.sandbox.session",
      JSON.stringify(session(new Date(Date.now() + 5000).toISOString())),
    );
    const renewed = { ...session("2099-01-01T00:00:00Z"), accessToken: "access-new" };
    const fetcher = vi.fn().mockResolvedValue(json(renewed));
    vi.stubGlobal("fetch", fetcher);
    const { authorize } = await import("./openapi.service");
    const request = { url: "https://qa.example.test/api/models", headers: {} as Record<string, string> };
    expect((await authorize(api, request)).headers.Authorization).toBe("Bearer access-new");
    expect(fetcher.mock.calls[0][0]).toContain("/auth/refresh");
  });

  it("renova em segundo plano quando a API responde 401, só na origem da API", async () => {
    sessionStorage.setItem(
      "solaria.sandbox.session",
      JSON.stringify(session("2099-01-01T00:00:00Z")),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ ...session("2099-01-01T00:00:00Z"), accessToken: "access-new" }));
    vi.stubGlobal("fetch", fetcher);
    const { renewOnUnauthorized } = await import("./openapi.service");
    renewOnUnauthorized(api, { url: "https://evil.example.test/x", status: 401 });
    renewOnUnauthorized(api, { url: "https://qa.example.test/x", status: 200 });
    expect(fetcher).not.toHaveBeenCalled();
    renewOnUnauthorized(api, { url: "https://qa.example.test/x", status: 401 });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toContain("/auth/refresh");
  });
});

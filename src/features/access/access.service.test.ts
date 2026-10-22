import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modo mock de autenticação", () => {
  it("aceita qualquer credencial sem chamar a API e mantém a sessão local", async () => {
    vi.stubEnv("VITE_MOCKS", "ALWAYS");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const auth = await import("./access.service");
    await auth.login("Qualquer@Teste.com", "x");
    expect(auth.getSession()?.email).toBe("qualquer@teste.com");
    expect(auth.getSession()?.mock).toBe(true);
    await auth.refresh();
    expect(auth.getSession()?.mock).toBe(true);
    await auth.logout();
    expect(auth.getSession()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("usa a API-auth quando o mock está desativado", async () => {
    vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const auth = await import("./access.service");
    await expect(auth.login("a@b.com", "x")).rejects.toThrow("E-mail ou senha inválidos.");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(auth.getSession()).toBeNull();
  });
});

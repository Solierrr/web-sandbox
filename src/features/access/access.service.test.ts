import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modo mock de autenticação", () => {
  it("restaura uma sessão pelo cookie depois de atualizar sem tokens em Storage", async () => {
    vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ accessToken: "access", userId: "id", email: "test@test.dev", accessTokenExpiresAt: "2099-01-01T00:00:00Z" })));
    vi.stubGlobal("fetch", fetcher);
    const auth = await import("./access.service");
    await Promise.all([auth.restoreSession(), auth.restoreSession()]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toContain("/auth/browser/refresh");
    expect(fetcher.mock.calls[0][1]?.credentials).toBe("include");
    expect(auth.getSession()?.email).toBe("test@test.dev");
    expect(auth.getSession()?.refreshToken).toBeUndefined();
  });
  it("não restaura após logout durante a inicialização", async () => {
    vi.stubEnv("VITE_MOCKS", "DEACTIVATED");
    let complete!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; })));
    const auth = await import("./access.service");
    const restoring = auth.restoreSession(); auth.clearSession();
    complete(new Response(JSON.stringify({ accessToken: "access", userId: "id", email: "test@test.dev", accessTokenExpiresAt: "2099-01-01T00:00:00Z" })));
    await restoring; expect(auth.getSession()).toBeNull();
  });
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

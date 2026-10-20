import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Service } from "../../../config/services";

const service: Service = {
  id: "api-core",
  description: "",
  url: "https://qa.example.test",
  health: "/health",
  kind: "core",
};
const session = {
  accessToken: "access-old",
  refreshToken: "refresh-old",
  email: "qa@example.test",
  userId: "qa-user",
  accessTokenExpiresAt: "2026-12-01T00:00:00Z",
};
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
});

describe("sessão e requests do QA", () => {
  it("armazena a sessão temporária e envia o JWT apenas nas operações autenticadas", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ status: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    const auth = await import("../../../features/access/access.service");
    const { request } = await import("./http.service");
    await auth.login("qa@example.test", "password");
    await request(service, "/api/models");
    await request(service, "/health", {}, false);
    expect(sessionStorage.getItem("solaria.sandbox.session")).toContain(
      "access-old",
    );
    expect(fetcher.mock.calls[1][1].headers.get("Authorization")).toBe(
      "Bearer access-old",
    );
    expect(fetcher.mock.calls[2][1].headers.has("Authorization")).toBe(false);
    expect(fetcher.mock.calls[1][1].redirect).toBe("error");
  });
  it("rejeita respostas de login incompatíveis sem criar sessão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ ...session, accessToken: "" })),
    );
    const auth = await import("../../../features/access/access.service");
    await expect(auth.login("qa@example.test", "password")).rejects.toThrow(
      "Resposta de autenticação inválida",
    );
    expect(auth.getSession()).toBe(null);
  });
  it("renova uma única vez para requests simultâneos", async () => {
    let renewals = 0;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/login")) return json(session);
      if (url.endsWith("/auth/refresh")) {
        renewals++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json({
          ...session,
          accessToken: "access-new",
          refreshToken: "refresh-new",
        });
      }
      return new Headers(init.headers).get("Authorization") ===
        "Bearer access-old"
        ? json({}, 401)
        : json({ done: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const auth = await import("../../../features/access/access.service");
    const { request } = await import("./http.service");
    await auth.login("qa@example.test", "password");
    const results = await Promise.all([
      request(service, "/api/models"),
      request(service, "/api/models"),
    ]);
    expect(renewals).toBe(1);
    expect(results.map((item) => item.status)).toEqual([200, 200]);
  });
  it("um 401 atrasado repete com o token já renovado sem renovar novamente", async () => {
    let renewals = 0;
    let release: (() => void) | undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/login")) return json(session);
        if (url.endsWith("/auth/refresh")) {
          renewals++;
          return json({ ...session, accessToken: "access-new" });
        }
        if (
          new Headers(init.headers).get("Authorization") === "Bearer access-old"
        ) {
          if (url.endsWith("/second")) await delayed;
          return json({}, 401);
        }
        return json({ done: true });
      }),
    );
    const auth = await import("../../../features/access/access.service");
    const { request } = await import("./http.service");
    await auth.login("qa@example.test", "password");
    const first = request(service, "/first");
    const second = request(service, "/second");
    await first;
    release?.();
    await second;
    expect(renewals).toBe(1);
  });
  it("encerra a sessão quando a renovação é recusada", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(session))
        .mockResolvedValueOnce(json({}, 401))
        .mockResolvedValueOnce(json({}, 401)),
    );
    const auth = await import("../../../features/access/access.service");
    const { request } = await import("./http.service");
    await auth.login("qa@example.test", "password");
    await expect(request(service, "/api/models")).rejects.toThrow(
      "sessão terminou",
    );
    expect(auth.getSession()).toBe(null);
    expect(sessionStorage.length).toBe(0);
  });
  it("não renova nem usa a conta nova ao chegar uma resposta da conta anterior", async () => {
    let release: (() => void) | undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/login")) return json(session);
        await delayed;
        return json({}, 401);
      }),
    );
    const auth = await import("../../../features/access/access.service");
    const { request } = await import("./http.service");
    await auth.login("qa@example.test", "password");
    const result = request(service, "/api/models");
    auth.clearSession();
    await auth.login("qa@example.test", "password");
    release?.();
    await expect(result).rejects.toThrow("sessão mudou");
    expect(auth.getSession()?.accessToken).toBe("access-old");
  });
  it("limpa a sessão imediatamente mesmo quando o logout remoto falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(session))
        .mockRejectedValueOnce(new Error("offline")),
    );
    const auth = await import("../../../features/access/access.service");
    await auth.login("qa@example.test", "password");
    const result = auth.logout();
    expect(auth.getSession()).toBe(null);
    await result;
    expect(sessionStorage.length).toBe(0);
  });
  it("retorna falhas de HTTP e texto sem substituir o resultado por mocks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Serviço indisponível", { status: 503 }),
        ),
    );
    const { request } = await import("./http.service");
    const result = await request(service, "/health", {}, false);
    expect(result.status).toBe(503);
    expect(result.body).toBe("Serviço indisponível");
  });
  it("bloqueia endpoints inválidos e apresenta falhas de rede isoladas", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const { request } = await import("./http.service");
    await expect(
      request(
        { ...service, url: "https://user:secret@example.test" },
        "/health",
        {},
        false,
      ),
    ).rejects.toThrow("Endpoint inválido");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(request(service, "/health", {}, false)).rejects.toThrow(
      "Não foi possível acessar este serviço",
    );
  });
});

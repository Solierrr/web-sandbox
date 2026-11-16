import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessToken, answerSwagger, openSwagger } from "./swagger.service";
import { getSession, getSessionGeneration, refresh, restoreSession } from "../access/access.service";

vi.mock("../access/access.service", () => ({ getSession: vi.fn(), getSessionGeneration: vi.fn(), refresh: vi.fn(), restoreSession: vi.fn() }));
const session = { accessToken: "user-jwt", refreshToken: "refresh", email: "qa@test", userId: "qa-user", accessTokenExpiresAt: new Date(Date.now() + 600000).toISOString() };
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.mocked(getSession).mockReturnValue(session); vi.mocked(getSessionGeneration).mockReturnValue(1); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Native Swagger session bridge", () => {
  it("reconnects a trusted Swagger tab after reloading the catalog", async () => {
    const tab = { closed: false, opener: window, location: { pathname: "/swagger.html", search: "?service=api-email" }, postMessage: vi.fn() };
    await answerSwagger(new MessageEvent("message", { origin: window.location.origin, source: tab as unknown as Window, data: { type: "solaria-swagger-auth", id: "api-email", requestId: "after-reload" } }));
    expect(tab.postMessage).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "user-jwt" }), window.location.origin);
    tab.closed = true;
  });
  it("opens the standalone HTML with no token in its address", () => {
    const tab = { closed: true, postMessage: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    openSwagger("api-email");
    expect(open).toHaveBeenCalledWith("/swagger.html?service=api-email", "_blank");
  });
  it("only returns a JWT to the registered tab, service and same origin", async () => {
    const tab = { closed: true, postMessage: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    openSwagger("api-email");
    const data = { type: "solaria-swagger-auth", id: "api-email", requestId: "nonce" };
    await answerSwagger(new MessageEvent("message", { origin: "https://evil.test", source: tab as unknown as Window, data }));
    await answerSwagger(new MessageEvent("message", { origin: window.location.origin, source: window, data }));
    await answerSwagger(new MessageEvent("message", { origin: window.location.origin, source: tab as unknown as Window, data: { ...data, id: "api-core" } }));
    expect(tab.postMessage).not.toHaveBeenCalled();
    await answerSwagger(new MessageEvent("message", { origin: window.location.origin, source: tab as unknown as Window, data }));
    expect(tab.postMessage).toHaveBeenCalledWith({ type: "solaria-swagger-auth-result", requestId: "nonce", accessToken: "user-jwt" }, window.location.origin);
  });
  it("does not expose the session to unregistered services or blocked windows", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => openSwagger("unknown")).toThrow("Serviço");
    expect(() => openSwagger("api-email")).toThrow("nova aba");
  });
  it("rejects mocks and ended sessions", async () => {
    vi.mocked(getSession).mockReturnValueOnce({ ...session, mock: true }).mockReturnValue(null);
    await expect(accessToken()).rejects.toThrow("QA");
    await expect(accessToken()).rejects.toThrow("QA");
  });
  it("waits for cookie restoration before authorizing a child tab", async () => {
    vi.mocked(getSession).mockReturnValueOnce(null).mockReturnValue(session);
    await expect(accessToken()).resolves.toBe("user-jwt");
    expect(restoreSession).toHaveBeenCalledOnce();
  });
  it("renews the access token before expiry", async () => {
    vi.mocked(getSession).mockReturnValueOnce({ ...session, accessTokenExpiresAt: new Date().toISOString() }).mockReturnValue(session);
    await expect(accessToken()).resolves.toBe("user-jwt");
    expect(refresh).toHaveBeenCalled();
  });
  it("refuses a session replaced while refreshing", async () => {
    vi.mocked(getSession).mockReturnValueOnce({ ...session, accessTokenExpiresAt: new Date().toISOString() }).mockReturnValue(session);
    vi.mocked(getSessionGeneration).mockReturnValueOnce(1).mockReturnValue(2);
    await expect(accessToken()).rejects.toThrow("sessão terminou");
  });
});

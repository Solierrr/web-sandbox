import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeRequest, loadSpec } from "./documentation.service";
import { getSession, refresh } from "../access/access.service";

vi.mock("../access/access.service", () => ({ getSession: vi.fn(), refresh: vi.fn() }));
const session = { accessToken: "user-jwt", refreshToken: "refresh", email: "qa@test", userId: "qa-user", accessTokenExpiresAt: new Date(Date.now() + 600000).toISOString() };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSession).mockReturnValue(session); });
describe("Swagger request authentication", () => {
  it("adds user JWT only to the selected same-origin proxy", async () => {
    const request = await authorizeRequest("api-email", { url: "/api/qa/api-email/proxy/emails", headers: {} as Record<string, string> });
    expect(request.headers.Authorization).toBe("Bearer user-jwt");
  });
  it.each(["https://external.test/api/qa/api-email/proxy/emails", "/api/qa/api-core/proxy/users"])("rejects %s before attaching credentials", async url => {
    await expect(authorizeRequest("api-email", { url, headers: {} })).rejects.toThrow("proxy");
  });
  it("rejects mock sessions", async () => {
    vi.mocked(getSession).mockReturnValue({ ...session, mock: true });
    await expect(authorizeRequest("api-email", { url: "/api/qa/api-email/proxy/emails", headers: {} })).rejects.toThrow("mock");
  });
  it("renews an expiring session before a request", async () => {
    vi.mocked(getSession).mockReturnValueOnce({ ...session, accessTokenExpiresAt: new Date().toISOString() }).mockReturnValue(session);
    await authorizeRequest("api-email", { url: "/api/qa/api-email/proxy/emails", headers: {} });
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("reports server errors without repeating the request", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"message":"Sessão expirada"}', { status: 401 }));
    await expect(loadSpec("api-email", new AbortController().signal)).rejects.toThrow("Sessão expirada");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

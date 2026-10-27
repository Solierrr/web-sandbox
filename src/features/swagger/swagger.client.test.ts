import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeRequest, requestToken, startSwagger } from "./swagger.client";

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mockOpener() {
  const opener = { closed: false, postMessage: vi.fn((message: { requestId: string }) => {
    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: opener as unknown as Window, data: { type: "solaria-swagger-auth-result", requestId: message.requestId, accessToken: "qa-user-jwt" } }));
  }) };
  vi.stubGlobal("opener", opener);
  return opener;
}
describe("Standalone Swagger", () => {
  it("requires the catalog tab", async () => {
    vi.stubGlobal("opener", null);
    await expect(requestToken("api-email")).rejects.toThrow("catálogo");
  });
  it("blocks foreign targets before requesting a token", async () => {
    const opener = mockOpener();
    await expect(authorizeRequest("api-email", { url: "https://evil.test/api/qa/api-email/proxy/emails", headers: {} })).rejects.toThrow("Destino");
    expect(opener.postMessage).not.toHaveBeenCalled();
  });
  it("ignores spoofed authorization messages", async () => {
    const opener = { closed: false, postMessage: vi.fn<(message: { requestId: string }) => void>() };
    vi.stubGlobal("opener", opener);
    const result = requestToken("api-email");
    const requestId = opener.postMessage.mock.calls[0][0].requestId;
    const data = { type: "solaria-swagger-auth-result", requestId, accessToken: "user-jwt" };
    let completed = false;
    void result.then(() => { completed = true; });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.test", source: opener as unknown as Window, data }));
    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: window, data }));
    await Promise.resolve();
    expect(completed).toBe(false);
    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: opener as unknown as Window, data }));
    await expect(result).resolves.toBe("user-jwt");
  });
  it("authenticates requests without cookies or a service key in the browser", async () => {
    mockOpener();
    const request = await authorizeRequest("api-email", { url: "/api/qa/api-email/proxy/emails", headers: {} });
    expect(request.headers.Authorization).toBe("Bearer qa-user-jwt");
    expect(request.credentials).toBe("omit");
  });
  it("renders the real native UI without Solaria containers", async () => {
    mockOpener();
    vi.stubGlobal("scrollTo", vi.fn());
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify({ openapi: "3.0.3", info: { title: "Native Email API", version: "1" }, paths: {} })));
    const root = document.createElement("div"); document.body.append(root);
    await startSwagger(root, "api-email");
    await vi.waitFor(() => expect(root.querySelector(".swagger-ui")).not.toBeNull());
    expect(root.textContent).toContain("Native Email API");
    expect(root.querySelector("aside,nav,.swagger-scroll")).toBeNull();
  });
});

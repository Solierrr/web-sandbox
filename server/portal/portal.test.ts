// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { portalSpec, services, targetUrl, upstreamHeaders } from "./portal.service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); vi.unstubAllEnvs(); });
const email = services.find(service => service.id === "api-email")!;
const auth = { authorization: "Bearer signed-test-token" };
const verify = async (token: string) => { if (token !== "signed-test-token") throw new Error("Invalid JWT"); };
function setup(fetcher: typeof fetch) { const app = createApp({ verify, fetch: fetcher }); apps.push(app); return app; }

describe("QA portal", () => {
  it("requires a verified session, including before serving specifications", async () => {
    const upstream = vi.fn(); const app = setup(upstream);
    expect((await app.inject("/api/qa/api-email/spec")).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/qa/api-email/spec", headers: { authorization: "Bearer mock-access-123" } })).statusCode).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("allows every valid QA account without requiring an admin role", async () => {
    const app = setup(vi.fn());
    expect((await app.inject({ url: "/api/qa/services", headers: auth })).statusCode).toBe(200);
  });
  it("injects the server key and preserves the raw JSON payload", async () => {
    vi.stubEnv("SERVICE_KEY_API_EMAIL", "server-secret-1234");
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"sent"}', { headers: { "content-type": "application/json" } }));
    const app = setup(upstream);
    const response = await app.inject({ method: "POST", url: "/api/qa/api-email/proxy/emails", headers: { ...auth, "content-type": "application/json", "x-api-key": "attacker-key" }, payload: '{"template":"verification"}' });
    expect(response.statusCode).toBe(200);
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toBe(`${email.url}/emails`);
    expect(new Headers(options?.headers).get("x-api-key")).toBe("server-secret-1234");
    expect(Buffer.from(options?.body as Uint8Array).toString()).toBe('{"template":"verification"}');
    expect(response.body).not.toContain("server-secret");
  });
  it("fails closed when a key is missing", () => {
    expect(() => upstreamHeaders(email, "/emails", "jwt", undefined, {})).toThrow("Credencial");
  });
  it.each(["//evil.test/path", "/../path", "/%252e%252e/path", "/%5cevil.test/path", "/internal/keys"])("rejects unsafe destination %s", path => {
    expect(() => targetUrl(email, path)).toThrow();
  });
  it("blocks credential-delivery endpoints", () => {
    const google = services.find(service => service.id === "api-google")!;
    expect(() => targetUrl(google, "/v1/llm/keys")).toThrow("Credenciais");
  });
  it("does not follow upstream redirects or expose injected credentials", async () => {
    vi.stubEnv("SERVICE_KEY_API_EMAIL", "server-secret-1234");
    const upstream = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://evil.test" } })).mockResolvedValueOnce(new Response('{"key":"server-secret-1234"}'));
    const app = setup(upstream);
    expect((await app.inject({ url: "/api/qa/api-email/proxy/emails", headers: auth })).statusCode).toBe(502);
    expect((await app.inject({ url: "/api/qa/api-email/proxy/emails", headers: auth })).statusCode).toBe(502);
    expect(upstream.mock.calls[0][1]?.redirect).toBe("manual");
  });
  it("rewrites servers and removes browser authorization configuration", () => {
    const spec = portalSpec({ openapi: "3.0.3", servers: [{ url: "https://prod.test" }], security: [{ Key: [] }], paths: { "/emails": { post: { servers: [{ url: "https://evil.test" }], security: [{ Key: [] }] } } }, components: { securitySchemes: { Key: {} } } }, "api-email");
    expect(spec.servers).toEqual([{ url: "/api/qa/api-email/proxy" }]);
    expect(JSON.stringify(spec)).not.toContain("prod.test");
    expect(JSON.stringify(spec)).not.toContain("security");
  });
  it("rejects external schema references", () => {
    expect(() => portalSpec({ openapi: "3.0.3", components: { schemas: { External: { $ref: "https://evil.test/schema" } } } }, "api-email")).toThrow("externas");
  });
  it("preserves multipart uploads without parsing or losing the boundary", async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}")); const app = setup(upstream);
    const payload = "--boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.pdf\"\r\n\r\nbytes\r\n--boundary--\r\n";
    const response = await app.inject({ method: "POST", url: "/api/qa/api-core/proxy/upload", headers: { ...auth, "content-type": "multipart/form-data; boundary=boundary" }, payload });
    expect(response.statusCode).toBe(200);
    expect(Buffer.from(upstream.mock.calls[0][1]?.body as Uint8Array).toString()).toBe(payload);
  });
});

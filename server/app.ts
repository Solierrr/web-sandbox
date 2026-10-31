import Fastify from "fastify";
import { verifyQaToken } from "./portal/portal.auth.js";
import { boundedBody, PortalError, portalSpec, services, targetUrl, upstreamHeaders } from "./portal/portal.service.js";

export function createApp(options: { verify?: (token: string) => Promise<void>; fetch?: typeof fetch; access?: (token: string) => Promise<void> } = {}) {
  const app = Fastify({ bodyLimit: 10 * 1024 * 1024, logger: false });
  const upstream = options.fetch ?? fetch;
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof PortalError ? error.status : (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 413 ? 413 : 502);
    reply.code(status).send({ message: error instanceof PortalError ? error.message : "Serviço temporariamente indisponível." });
  });
  // Atrás do Cloudflare Access: toda rota, exceto a sonda de saúde do Render, exige o JWT do Access.
  if (options.access) {
    const verifyAccess = options.access;
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/health") return;
      const token = request.headers["cf-access-jwt-assertion"];
      try { await verifyAccess(typeof token === "string" ? token : ""); }
      catch { return reply.code(403).header("Cache-Control", "no-store").send({ message: "Acesso permitido somente pelo Cloudflare Access." }); }
    });
  }
  app.get("/health", async () => ({ status: "ok" }));
  app.register(async portal => {
    portal.addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const token = request.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!token) throw new PortalError(401, "Entre com uma conta de QA.");
      try { await (options.verify ?? verifyQaToken)(token); }
      catch { throw new PortalError(401, "Sessão inválida ou expirada. Entre novamente."); }
    });
    portal.get("/services", async () => services.map(({ id }) => ({ id })));
    portal.get<{ Params: { id: string } }>("/:id/spec", async (request, reply) => {
      const service = services.find(s => s.id === request.params.id);
      if (!service) throw new PortalError(404, "Serviço não encontrado.");
      const response = await upstream(new URL(service.spec, service.url), { redirect: "manual", signal: AbortSignal.timeout(90000) });
      if (!response.ok) { await response.body?.cancel(); throw new PortalError(502, "Não foi possível carregar o OpenAPI deste serviço."); }
      const data = await boundedBody(response);
      return reply.send(portalSpec(JSON.parse(data.toString()), service.id));
    });
    portal.route<{ Params: { id: string; "*": string } }>({
      method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], url: "/:id/proxy/*",
      handler: async (request, reply) => {
        const service = services.find(s => s.id === request.params.id);
        if (!service) throw new PortalError(404, "Serviço não encontrado.");
        const prefix = `/api/qa/${service.id}/proxy`;
        const path = request.raw.url!.slice(prefix.length);
        const url = targetUrl(service, path);
        const token = request.headers.authorization!.slice(7);
        const headers = upstreamHeaders(service, path, token, request.headers["content-type"]);
        const response = await upstream(url, {
          method: request.method, headers, redirect: "manual", signal: AbortSignal.timeout(90000),
          body: ["GET", "HEAD"].includes(request.method) || !request.body ? undefined : Uint8Array.from(request.body as Buffer).buffer,
        });
        if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new PortalError(502, "Redirecionamento externo bloqueado."); }
        const body = await boundedBody(response);
        // Impede respostas de diagnóstico que reflitam tokens ou a chave injetada.
        for (const [name, value] of headers) if ((name === "authorization" || name.includes("key")) && value.length > 8) {
          const secret = value.replace(/^Bearer /, "");
          if (body.includes(Buffer.from(secret))) throw new PortalError(502, "Resposta contém credenciais e foi bloqueada.");
        }
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Content-Security-Policy", "sandbox; default-src 'none'");
        reply.type(response.headers.get("content-type") || "application/octet-stream");
        return reply.code(response.status).send(body);
      },
    });
  }, { prefix: "/api/qa" });
  return app;
}

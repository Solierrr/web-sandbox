import services from "../../shared/qa-services.json" with { type: "json" };

export { services };
export type QaService = (typeof services)[number];

export class PortalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function targetUrl(service: QaService, path: string) {
  // Decodificação repetida também bloqueia escapes duplos e segmentos de travessia.
  let decoded = path;
  for (let i = 0; i < 4; i++) {
    if (decoded.includes("\\") || decoded.includes("#") || decoded.startsWith("//") || decoded.split(/[/?]/).some(p => p === "." || p === "..")) {
      throw new PortalError(400, "Caminho inválido.");
    }
    let next: string;
    try { next = decodeURIComponent(decoded); } catch { throw new PortalError(400, "Caminho inválido."); }
    if (next === decoded) break;
    decoded = next;
  }
  if (!path.startsWith("/") || /%[0-9a-f]{2}/i.test(decoded) || decoded.includes("\\") || decoded.includes("#") || decoded.startsWith("//") || decoded.split(/[/?]/).some(p => p === "." || p === "..")) throw new PortalError(400, "Caminho inválido.");
  // Este endpoint entrega credenciais de provedores, não dados para o usuário do portal.
  if (service.id === "api-google" && /^\/v1\/llm(?:\/|\?|$)/i.test(decoded)) throw new PortalError(403, "Credenciais de provedores não estão disponíveis no portal.");
  if (/^\/(?:internal|actuator|\.well-known)(?:\/|\?|$)/i.test(decoded)) throw new PortalError(403, "Rota interna indisponível no portal.");
  const url = new URL(path, service.url);
  if (url.origin !== service.url || url.username || url.password) throw new PortalError(400, "Destino inválido.");
  return url;
}

export function upstreamHeaders(service: QaService, path: string, token: string, contentType?: string, env = process.env) {
  const headers = new Headers({ accept: "application/json", authorization: `Bearer ${token}` });
  if (contentType) headers.set("content-type", contentType);
  const setKey = (header: string, names: string[], bearer = false) => {
    const key = names.map(name => env[name]).find(Boolean);
    if (!key) throw new PortalError(503, "Credencial deste serviço não configurada no servidor.");
    headers.set(header, bearer ? `Bearer ${key}` : key);
  };
  if (service.id === "api-email") setKey("X-API-Key", ["SERVICE_KEY_API_EMAIL"]);
  if (service.id === "api-google") setKey("Authorization", ["REGISTRY_CONSUMER_TOKEN"], true);
  if (service.id === "ai-validation" && path.startsWith("/api/v1/professionals/validate")) setKey("Authorization", ["VALIDATION_SERVICE_TOKEN"], true);
  if (service.id === "api-recommendation") {
    if (/\/sync(?:\/|\?|$)/.test(path)) setKey("X-Sync-Key", ["SYNC_API_KEY", "RECOMMENDATION_SYNC_API_KEY"]);
    else {
      setKey("X-API-Key", ["SERVICE_KEY_API_RECOMMENDATION"]);
      setKey("X-Recommendation-Key", ["RECOMMENDATION_API_KEY", "SERVICE_KEY_API_RECOMMENDATION"]);
    }
  }
  return headers;
}

export async function boundedBody(response: Response, limit = 10 * 1024 * 1024) {
  if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new PortalError(502, "Resposta excede o limite do portal."); }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (reader) try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new PortalError(502, "Resposta excede o limite do portal."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function portalSpec(value: unknown, id: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("openapi" in value)) throw new PortalError(502, "OpenAPI inválido.");
  const spec = value as Record<string, unknown>;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const item = node as Record<string, unknown>;
    if (typeof item.$ref === "string" && !item.$ref.startsWith("#/")) throw new PortalError(502, "Referências OpenAPI externas não são permitidas.");
    delete item.externalDocs;
    for (const child of Object.values(item)) visit(child);
  };
  visit(spec);
  const paths = spec.paths as Record<string, unknown> | undefined;
  const cleanOperation = (node: unknown) => {
    if (node && typeof node === "object") {
      delete (node as Record<string, unknown>).servers;
      delete (node as Record<string, unknown>).security;
    }
  };
  cleanOperation(spec);
  for (const path of Object.values(paths ?? {})) {
    cleanOperation(path);
    if (path && typeof path === "object") for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) cleanOperation((path as Record<string, unknown>)[method]);
  }
  if (paths && id === "api-google") for (const path of Object.keys(paths)) if (path.startsWith("/v1/llm")) delete paths[path];
  spec.servers = [{ url: `/api/qa/${id}/proxy` }];
  delete spec.webhooks;
  const components = spec.components as Record<string, unknown> | undefined;
  if (components) delete components.securitySchemes;
  return spec;
}

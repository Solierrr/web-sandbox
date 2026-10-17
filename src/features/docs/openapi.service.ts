import type { ApiDoc } from "../../config/apis";
import {
  getSession,
  refresh,
} from "../access/access.service";

export const methods = ["get", "post", "put", "patch", "delete"] as const;
export type Method = (typeof methods)[number];

export interface Operation {
  api: string;
  method: Method;
  path: string;
  summary: string;
  tag: string;
}

export interface Spec {
  document: Record<string, unknown>;
  title: string;
  version: string;
  operations: Operation[];
}

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; spec: Spec }
  | { status: "error"; message: string };

const cache = new Map<string, Promise<Spec>>();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
export function parseSpec(api: ApiDoc, raw: unknown): Spec {
  const document = record(raw);
  if (!document.openapi && !document.swagger)
    throw new Error("A resposta não é um documento OpenAPI.");
  const info = record(document.info);
  const operations: Operation[] = [];
  for (const [path, item] of Object.entries(record(document.paths)))
    for (const method of methods) {
      const found = record(item)[method];
      if (!found || typeof found !== "object") continue;
      const operation = record(found);
      const tags = Array.isArray(operation.tags) ? operation.tags : [];
      operations.push({
        api: api.id,
        method,
        path,
        summary:
          typeof operation.summary === "string" ? operation.summary : "",
        tag: typeof tags[0] === "string" ? tags[0] : "default",
      });
    }
  return {
    document: {
      ...document,
      servers: [{ url: api.url.replace(/\/$/, ""), description: "Ambiente do portal" }],
    },
    title: typeof info.title === "string" ? info.title : api.id,
    version: typeof info.version === "string" ? info.version : "",
    operations,
  };
}

async function download(api: ApiDoc): Promise<Spec> {
  let response: Response;
  try {
    response = await fetch(`${api.url.replace(/\/$/, "")}${api.specPath}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(90000),
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    throw new Error(
      "Sem resposta da API (pode estar acordando, fora do ar ou sem CORS para este endereço).",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Documentação desativada ou em outro caminho (HTTP 404)."
        : `A API respondeu HTTP ${response.status}.`,
    );
  try {
    return parseSpec(api, await response.json());
  } catch (failure) {
    throw failure instanceof Error
      ? failure
      : new Error("Documento OpenAPI inválido.");
  }
}
export function loadSpec(api: ApiDoc): Promise<Spec> {
  let pending = cache.get(api.id);
  if (!pending) {
    pending = download(api);
    cache.set(api.id, pending);
    pending.catch(() => {
      if (cache.get(api.id) === pending) cache.delete(api.id);
    });
  }
  return pending;
}

export function forgetSpec(apiId: string) {
  cache.delete(apiId);
}
export function sameOrigin(requestUrl: string, apiUrl: string) {
  try {
    return new URL(requestUrl).origin === new URL(apiUrl).origin;
  } catch {
    return false;
  }
}

const expiresSoon = (iso: string) => Date.parse(iso) - Date.now() < 30000;

export interface InterceptedRequest {
  url: string;
  headers: Record<string, string>;
}
export async function authorize<T extends InterceptedRequest>(
  api: ApiDoc,
  request: T,
): Promise<T> {
  if (!sameOrigin(request.url, api.url)) return request;
  let session = getSession();
  if (!session) return request;
  if (expiresSoon(session.accessTokenExpiresAt)) {
    try {
      await refresh();
    } catch {
      return request;
    }
    session = getSession();
    if (!session) return request;
  }
  request.headers.Authorization = `Bearer ${session.accessToken}`;
  return request;
}
export function renewOnUnauthorized(api: ApiDoc, response: { url: string; status: number }) {
  if (response.status === 401 && sameOrigin(response.url, api.url) && getSession())
    void refresh().catch(() => undefined);
}

import { getSession, refresh } from "../access/access.service";

export async function accessHeaders() {
  let session = getSession();
  if (!session || session.mock) throw new Error("Use uma conta autenticada no QA para testar APIs reais. Sessões de mock não acessam service keys.");
  if (Date.parse(session.accessTokenExpiresAt) - Date.now() < 30000) {
    await refresh();
    session = getSession();
  }
  if (!session || session.mock) throw new Error("Sua sessão expirou. Entre novamente.");
  return { Authorization: `Bearer ${session.accessToken}` };
}

export async function loadSpec(id: string, signal: AbortSignal) {
  const response = await fetch(`/api/qa/${encodeURIComponent(id)}/spec`, {
    headers: await accessHeaders(), signal, credentials: "omit", redirect: "error",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Não foi possível carregar a documentação. Confira se o servidor do sandbox está rodando.");
  }
  return response.json();
}

export interface SwaggerRequest { url: string; headers: Record<string, string>; credentials?: string }
export async function authorizeRequest<T extends SwaggerRequest>(id: string, request: T): Promise<T> {
  const url = new URL(request.url, window.location.origin);
  const prefix = `/api/qa/${encodeURIComponent(id)}/proxy/`;
  if (url.origin !== window.location.origin || !url.pathname.startsWith(prefix)) throw new Error("O Swagger só pode acessar o proxy de QA deste serviço.");
  // Não repetimos mutações automaticamente caso a sessão expire durante a chamada.
  request.headers = { ...request.headers, ...await accessHeaders() };
  request.credentials = "omit";
  return request;
}

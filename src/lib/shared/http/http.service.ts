import {
  getSession,
  getSessionGeneration,
  refresh,
  clearSession,
} from "../../../features/access/access.service";
import type { Service } from "../../../config/services";
export interface Result {
  status: number;
  duration: number;
  body: unknown;
}
export async function request(
  service: Service,
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<Result> {
  let endpoint: URL;
  try {
    endpoint = new URL(service.url);
  } catch {
    throw new Error("Endpoint não configurado.");
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    !path.startsWith("/") ||
    path.startsWith("//")
  )
    throw new Error("Endpoint inválido.");
  const start = performance.now();
  const generation = getSessionGeneration();
  let sentToken: string | undefined;
  const checkSession = () => {
    if (
      authenticated &&
      (getSessionGeneration() !== generation || !getSession())
    )
      throw new Error("Sua sessão mudou. Execute a solicitação novamente.");
  };
  const send = async () => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (authenticated) {
      checkSession();
      const session = getSession()!;
      sentToken = session.accessToken;
      headers.set("Authorization", `Bearer ${sentToken}`);
    }
    return fetch(`${service.url.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(90000),
      credentials: "omit",
      redirect: "error",
    });
  };
  let response: Response;
  try {
    response = await send();
    checkSession();
    if (response.status === 401 && authenticated) {
      if (getSession()?.accessToken === sentToken) await refresh();
      response = await send();
      checkSession();
      if (response.status === 401 && getSession()?.accessToken === sentToken)
        clearSession();
    }
  } catch (error) {
    if (error instanceof Error && /sessão/.test(error.message)) throw error;
    throw new Error(
      "Não foi possível acessar este serviço. Confira URL, conexão, disponibilidade e CORS do QA.",
      { cause: error },
    );
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text || null;
  }
  return {
    status: response.status,
    duration: Math.round(performance.now() - start),
    body,
  };
}

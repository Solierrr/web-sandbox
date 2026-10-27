import SwaggerUI from "swagger-ui-dist/swagger-ui-bundle.js";
import services from "../../../shared/qa-services.json";
import "swagger-ui-dist/swagger-ui.css";

export interface SwaggerRequest { url: string; headers: Record<string, string>; credentials?: string }

export function requestToken(id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const opener = window.opener;
    if (!opener || opener.closed) { reject(new Error("Abra este Swagger pelo ícone do serviço no catálogo do sandbox e mantenha essa aba aberta.")); return; }
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => finish(new Error("A sessão do sandbox não respondeu. Abra o Swagger novamente pelo catálogo.")), 95000);
    function finish(result: string | Error) {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (result instanceof Error) reject(result); else resolve(result);
    }
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== opener || event.data?.type !== "solaria-swagger-auth-result" || event.data.requestId !== requestId) return;
      if (typeof event.data.accessToken === "string") finish(event.data.accessToken);
      else finish(new Error(typeof event.data.error === "string" ? event.data.error : "Sessão inválida."));
    }
    window.addEventListener("message", receive);
    opener.postMessage({ type: "solaria-swagger-auth", id, requestId }, window.location.origin);
  });
}

export async function authorizeRequest(id: string, request: SwaggerRequest) {
  const url = new URL(request.url, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(`/api/qa/${encodeURIComponent(id)}/proxy/`)) throw new Error("Destino fora do proxy de QA deste serviço.");
  request.headers = { ...request.headers, Authorization: `Bearer ${await requestToken(id)}` };
  request.credentials = "omit";
  return request;
}

export async function startSwagger(root: HTMLElement, id: string) {
  if (!services.some(service => service.id === id)) throw new Error("Selecione um serviço pelo catálogo do sandbox.");
  document.title = `${id} · Swagger UI`;
  const response = await fetch(`/api/qa/${encodeURIComponent(id)}/spec`, {
    headers: { Authorization: `Bearer ${await requestToken(id)}` }, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(95000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Não foi possível carregar o OpenAPI. Abra novamente pelo catálogo.");
  }
  SwaggerUI({
    domNode: root, spec: await response.json(), docExpansion: "list", filter: true,
    validatorUrl: null, queryConfigEnabled: false, persistAuthorization: false, withCredentials: false,
    requestInterceptor: request => authorizeRequest(id, request),
  });
}

const root = document.getElementById("swagger-ui");
if (root) {
  const id = new URLSearchParams(window.location.search).get("service") || "";
  void startSwagger(root, id).catch((error: unknown) => {
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = error instanceof Error ? error.message : "Swagger indisponível.";
    root.replaceChildren(message);
  });
}

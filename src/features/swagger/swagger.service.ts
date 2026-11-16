import { getSession, getSessionGeneration, refresh, restoreSession } from "../access/access.service";
import services from "../../../shared/qa-services.json";

const tabs = new Map<Window, string>();
let cleanup: ReturnType<typeof setInterval> | undefined;

export async function accessToken() {
  let session = getSession();
  if (!session) { await restoreSession(); session = getSession(); }
  if (!session || session.mock) throw new Error("Entre com uma conta de QA no sandbox para testar as APIs reais.");
  const generation = getSessionGeneration();
  if (Date.parse(session.accessTokenExpiresAt) - Date.now() < 30000) {
    await refresh();
    session = getSession();
  }
  if (!session || session.mock || getSessionGeneration() !== generation) throw new Error("Sua sessão terminou. Entre novamente no sandbox.");
  return session.accessToken;
}

export async function answerSwagger(event: MessageEvent) {
  if (event.origin !== window.location.origin || !event.source) return;
  const { type, id, requestId } = event.data ?? {};
  if (type !== "solaria-swagger-auth" || typeof requestId !== "string" || requestId.length > 100) return;
  const source = event.source as Window;
  if (!tabs.has(source)) {
    // A referência da aba filha continua válida quando o catálogo é recarregado.
    try {
      if (source.opener !== window || source.location.pathname !== "/swagger.html" || new URLSearchParams(source.location.search).get("service") !== id || !services.some(service => service.id === id)) return;
      trackTab(source, id);
    } catch { return; }
  }
  if (id !== tabs.get(source)) return;
  try {
    const generation = getSessionGeneration();
    const token = await accessToken();
    if (getSessionGeneration() !== generation || !tabs.has(source)) return;
    source.postMessage({ type: "solaria-swagger-auth-result", requestId, accessToken: token }, window.location.origin);
  } catch (error) {
    source.postMessage({ type: "solaria-swagger-auth-result", requestId, error: error instanceof Error ? error.message : "Sessão indisponível." }, window.location.origin);
  }
}

export function openSwagger(id: string) {
  if (!services.some(service => service.id === id)) throw new Error("Serviço não encontrado.");
  const tab = window.open(`/swagger.html?service=${encodeURIComponent(id)}`, "_blank");
  if (!tab) throw new Error("Permita abrir uma nova aba para acessar o Swagger.");
  trackTab(tab, id);
}

function trackTab(tab: Window, id: string) {
  tabs.set(tab, id);
  if (!cleanup) {
    cleanup = setInterval(() => {
      for (const tab of tabs.keys()) if (tab.closed) tabs.delete(tab);
      if (!tabs.size) {
        clearInterval(cleanup);
        cleanup = undefined;
      }
    }, 5000);
  }
}

window.addEventListener("message", answerSwagger);

import { getSession, getSessionGeneration, refresh } from "../access/access.service";
import services from "../../../shared/qa-services.json";

const tabs = new Map<Window, string>();
let cleanup: ReturnType<typeof setInterval> | undefined;

export async function accessToken() {
  let session = getSession();
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
  if (event.origin !== window.location.origin || !event.source || !tabs.has(event.source as Window)) return;
  const { type, id, requestId } = event.data ?? {};
  if (type !== "solaria-swagger-auth" || id !== tabs.get(event.source as Window) || typeof requestId !== "string" || requestId.length > 100) return;
  const source = event.source as Window;
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
  tabs.set(tab, id);
  if (!cleanup) {
    window.addEventListener("message", answerSwagger);
    cleanup = setInterval(() => {
      for (const tab of tabs.keys()) if (tab.closed) tabs.delete(tab);
      if (!tabs.size) {
        clearInterval(cleanup);
        cleanup = undefined;
        window.removeEventListener("message", answerSwagger);
      }
    }, 5000);
  }
}

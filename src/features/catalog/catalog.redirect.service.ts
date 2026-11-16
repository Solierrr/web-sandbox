import { notify } from "@solaria.network/web-lib";
import { getSession, refresh } from "../access/access.service";

export async function openRenderService(href: string, id: string) {
  const target = window.open("", "_blank");
  if (!target) { notify("Permita abrir uma nova aba para acessar o serviço."); return; }
  target.opener = null;
  target.document.title = "Verificando serviço…";
  target.document.body.textContent = "Verificando se o serviço está acordado…";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;
  try {
    let session = getSession();
    if (!session || session.mock) throw new Error("Entre com uma conta de QA para verificar o serviço.");
    if (Date.parse(session.accessTokenExpiresAt) - Date.now() < 30000) { await refresh(); session = getSession(); }
    if (!session) throw new Error("Sua sessão terminou. Entre novamente.");
    timer = setTimeout(() => {
      warned = true;
      notify(`${id} ainda não respondeu. Tentando acordar o serviço…`);
      if (!target.closed) target.document.body.textContent = "O serviço está acordando. Aguarde…";
    }, 2000);
    const response = await fetch(`/api/qa/${encodeURIComponent(id)}/wake`, {
      method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, signal: AbortSignal.timeout(10000), credentials: "omit", redirect: "error",
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Sua sessão terminou. Entre novamente." : "Não foi possível verificar o serviço. Abrindo o endereço…");
    const status = await response.json();
    if (!status.awake && !warned) notify(`${id} ainda não está disponível. O acesso tentará acordá-lo.`);
    if (!target.closed) target.location.replace(href);
  } catch (error) {
    notify(error instanceof Error ? error.message : "Não foi possível verificar o serviço.");
    if (!target.closed) target.location.replace(href);
  } finally { clearTimeout(timer); }
}

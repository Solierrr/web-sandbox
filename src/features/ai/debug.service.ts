import { getSession, refresh } from "../access/access.service";
import { baseUrl, type AiTarget, type EnvId } from "./targets";
import { asDebugInfo, type DebugInfo } from "./trace";

export const DEBUG_TIMEOUT_MS = 180000;

export type DebugInput =
  | { kind: "chat"; conversationId: string; message: string; persona?: string; custom?: CustomRun }
  | { kind: "certificates"; nr10Url: string; nr35Url: string; custom?: CustomRun }
  | { kind: "cnpj"; cnpj: string; custom?: CustomRun }
  | { kind: "image"; file: File; purpose: string; contextTitle?: string }
  | { kind: "image-stage"; custom: CustomRun };

type PromptItem = { call: number; prompt: { type: string; content: string }[] };

export interface CustomRun {
  turn?: number;
  runId?: string;
  node: string;
  occurrence: number;
  prompts: { call: number; prompt: { type: string; content: string; editable?: boolean }[] }[];
}

export type FailureReason =
  | "no-url"
  | "mock-session"
  | "disabled"
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "server"
  | "network"
  | "timeout"
  | "aborted";

export type DebugOutcome =
  | { ok: true; status: number; body: Record<string, unknown>; debug: DebugInfo | null; elapsed: number }
  | { ok: false; status: number; reason: FailureReason; message: string; debug: DebugInfo | null; elapsed: number };

const cleanPrompts = (prompts: CustomRun["prompts"]): PromptItem[] =>
  prompts.map(({ call, prompt }) => ({ call, prompt: prompt.map(({ type, content }) => ({ type, content })) }));

function customBody(input: CustomRun, extra: Record<string, unknown>) {
  return {
    ...extra,
    node: input.node,
    occurrence: input.occurrence,
    stop_after_node: true,
    prompts: cleanPrompts(input.prompts),
  };
}

function request(input: DebugInput): { body: BodyInit; headers: Record<string, string> } {
  const json = { "Content-Type": "application/json" };
  switch (input.kind) {
    case "chat":
      return {
        headers: json,
        body: JSON.stringify({
          conversation_id: input.conversationId,
          message: input.message,
          ...(input.persona ? { persona: input.persona } : {}),
          ...(input.custom ? { custom: customBody(input.custom, { turn: input.custom.turn ?? 0 }) } : {}),
        }),
      };
    case "certificates":
      return {
        headers: json,
        body: JSON.stringify({
          cert_nr10_url: input.nr10Url,
          cert_nr35_url: input.nr35Url,
          ...(input.custom ? { custom: customBody(input.custom, { run_id: input.custom.runId }) } : {}),
        }),
      };
    case "cnpj":
      return {
        headers: json,
        body: JSON.stringify({ cnpj: input.cnpj, ...(input.custom ? { custom: customBody(input.custom, {}) } : {}) }),
      };
    case "image-stage":
      return { headers: json, body: JSON.stringify(customBody(input.custom, { run_id: input.custom.runId })) };
    case "image": {
      const form = new FormData();
      form.append("image", input.file);
      form.append("purpose", input.purpose);
      if (input.contextTitle) form.append("context_title", input.contextTitle);
      return { headers: {}, body: form };
    }
  }
}

function detailOf(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : ""))
      .filter(Boolean)
      .join("; ") || fallback;
  return fallback;
}

function failureFor(status: number, body: unknown): { reason: FailureReason; message: string } {
  switch (status) {
    case 404:
      return {
        reason: "disabled",
        message:
          "Debug desligado neste serviço e ambiente: falta DEBUG_ADMIN_SUBS, o ambiente não é permitido ou a rota ainda não foi publicada.",
      };
    case 401:
      return { reason: "unauthorized", message: "O serviço recusou o token (inválido ou expirado)." };
    case 403:
      return { reason: "forbidden", message: "Sua conta não está em DEBUG_ADMIN_SUBS neste serviço." };
    case 400:
    case 413:
    case 422:
      return { reason: "invalid", message: detailOf(body, `Requisição recusada (HTTP ${status}).`) };
    default:
      return { reason: "server", message: detailOf(body, `O serviço falhou (HTTP ${status}).`) };
  }
}

async function send(url: string, input: DebugInput, token: string, signal: AbortSignal) {
  const { body, headers } = request(input);
  return fetch(url, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${token}` },
    body,
    signal,
    credentials: "omit",
    redirect: "error",
  });
}

export function localBase(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return local && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export async function runDebug(
  target: AiTarget,
  environment: EnvId,
  input: DebugInput,
  signal?: AbortSignal,
  localServer?: string,
): Promise<DebugOutcome> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const fail = (reason: FailureReason, message: string, status = 0, debug: DebugInfo | null = null): DebugOutcome => ({
    ok: false,
    reason,
    message,
    status,
    debug,
    elapsed: elapsed(),
  });

  const base = localServer === undefined ? baseUrl(target, environment) : localBase(localServer);
  if (!base)
    return fail(
      "no-url",
      localServer === undefined ? `Sem URL de ${environment} para ${target.service}.` : "O servidor local precisa ser localhost ou 127.0.0.1.",
    );
  let session = getSession();
  if (!session) return fail("unauthorized", "Sua sessão terminou. Entre novamente.");
  if (session.mock)
    return fail(
      "mock-session",
      "A sessão é de mock e os serviços não aceitam esse token. Use VITE_MOCKS=DEACTIVATED e entre com a conta de QA.",
    );

  const timeout = AbortSignal.timeout(DEBUG_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const path = input.kind === "image-stage" ? target.stagePath : target.path;
  if (!path) return fail("invalid", `${target.service} não tem rota de execução personalizada.`);
  const url = `${base}${path}`;
  try {
    let response = await send(url, input, session.accessToken, combined);
    if (response.status === 401) {
      await refresh();
      session = getSession();
      if (!session) return fail("unauthorized", "Sua sessão terminou. Entre novamente.", 401);
      response = await send(url, input, session.accessToken, combined);
    }
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const debug = asDebugInfo(record.debug);
    if (!response.ok) {
      const { reason, message } = failureFor(response.status, parsed);
      return fail(reason, message, response.status, debug);
    }
    const { debug: _debug, ...body } = record;
    void _debug;
    return { ok: true, status: response.status, body, debug, elapsed: elapsed() };
  } catch (error) {
    if (signal?.aborted) return fail("aborted", "Execução cancelada.");
    if (timeout.aborted)
      return fail("timeout", "O serviço não respondeu a tempo. Se estiver no plano gratuito, ele pode estar acordando.");
    if (error instanceof Error && error.message === "Sua sessão terminou. Entre novamente.")
      return fail("unauthorized", error.message, 401);
    return fail("network", "Não foi possível acessar o serviço. Confira a conexão, o CORS e se o serviço está no ar.");
  }
}

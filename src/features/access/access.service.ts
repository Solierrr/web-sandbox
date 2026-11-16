import { authUrl } from "../../config/services";

export interface Session {
  accessToken: string;
  refreshToken?: string;
  email: string;
  accessTokenExpiresAt: string;
  userId: string;
  mock?: true;
}
const MOCK_SESSION_MS = 60 * 60 * 1000;
const MOCK_KEY = "solaria.sandbox.mock.session";
const SIGNED_OUT_KEY = "solaria.sandbox.signedOut";
const mockMode = () =>
  import.meta.env.DEV && import.meta.env.VITE_MOCKS === "ALWAYS";
function mockSession(email: string): Session {
  const normalized = email.trim().toLowerCase();
  return {
    accessToken: `mock-access-${crypto.randomUUID()}`,
    refreshToken: `mock-refresh-${crypto.randomUUID()}`,
    email: normalized,
    userId: `mock:${normalized}`,
    accessTokenExpiresAt: new Date(Date.now() + MOCK_SESSION_MS).toISOString(),
    mock: true,
  };
}
const listeners = new Set<() => void>();
let session: Session | null = restoreMockSession();
let renewal: Promise<void> | null = null;
let generation = 0;
function valid(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  return (
    [
      "accessToken",
      "email",
      "accessTokenExpiresAt",
      "userId",
    ].every(
      (field) =>
        typeof (value as Record<string, unknown>)[field] === "string" &&
        String((value as Record<string, unknown>)[field]).trim().length > 0,
    ) &&
    Number.isFinite(
      Date.parse(
        String((value as Record<string, unknown>).accessTokenExpiresAt),
      ),
    )
  );
}
export const getSession = () => session;
export const getSessionGeneration = () => generation;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function update(value: Session | null) {
  session = value;
  try {
    if (value) sessionStorage.removeItem(SIGNED_OUT_KEY);
    if (mockMode() && value?.mock) sessionStorage.setItem(MOCK_KEY, JSON.stringify({ email: value.email }));
    else sessionStorage.removeItem(MOCK_KEY);
  } catch { /* O modo mock continua disponível sem Storage. */ }
  for (const listener of listeners) listener();
}
function restoreMockSession(): Session | null {
  if (!mockMode()) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(MOCK_KEY) || "null");
    return typeof saved?.email === "string" ? mockSession(saved.email) : null;
  } catch { return null; }
}
export function clearSession() {
  generation++;
  update(null);
}
async function exchangeUnlocked(path: string, body?: object): Promise<Session | null> {
  let response: Response;
  try {
    response = await fetch(`${authUrl.replace(/\/$/, "")}/auth/browser${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Solaria-Session": "1" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(90000),
      credentials: "include",
      redirect: "error",
    });
  } catch {
    throw new Error(
      "Não foi possível entrar agora. Tente novamente em instantes.",
    );
  }
  if (path === "/refresh" && response.status === 401) return null;
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "E-mail ou senha inválidos."
        : `Autenticação indisponível (HTTP ${response.status}).`,
    );
  if (response.status === 204) return null;
  const result: unknown = await response.json();
  if (!valid(result)) throw new Error("Resposta de autenticação inválida.");
  return { accessToken: result.accessToken, email: result.email, userId: result.userId, accessTokenExpiresAt: result.accessTokenExpiresAt };
}
const exchange = (path: string, body?: object) => navigator.locks
  ? navigator.locks.request("solaria.browser.session", () => exchangeUnlocked(path, body))
  : exchangeUnlocked(path, body);
export async function login(email: string, password: string) {
  const initial = generation;
  if (mockMode()) {
    generation++;
    update(mockSession(email));
    return;
  }
  const next = await exchange("/login", { email, password });
  if (!next) throw new Error("Resposta de autenticação inválida.");
  if (initial !== generation) return;
  generation++;
  update(next);
}
export async function refresh() {
  if (!renewal) {
    const current = session;
    const initial = generation;
    renewal = (async () => {
      if (current?.mock) {
        update(mockSession(current.email));
        return;
      }
      try {
        const next = await exchange("/refresh");
        if (session === current && generation === initial) update(next);
      } catch {
        throw new Error("Não foi possível renovar a sessão agora. Tente novamente.");
      }
    })().finally(() => {
      renewal = null;
    });
  }
  return renewal;
}
export async function logout() {
  const current = session;
  try { sessionStorage.setItem(SIGNED_OUT_KEY, "1"); } catch { /* Sessão local ainda será encerrada. */ }
  clearSession();
  if (!current?.mock) await exchange("/logout");
}

let restoration: Promise<void> | null = null;
export function restoreSession() {
  try { if (sessionStorage.getItem(SIGNED_OUT_KEY) === "1") return Promise.resolve(); } catch { /* Cookie continua sendo a fonte real de sessão. */ }
  if (mockMode() || session) return Promise.resolve();
  restoration ??= refresh().finally(() => { restoration = null; });
  return restoration;
}

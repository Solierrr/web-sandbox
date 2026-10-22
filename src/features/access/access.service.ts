import { authUrl } from "../../config/services";

export interface Session {
  accessToken: string;
  refreshToken: string;
  email: string;
  accessTokenExpiresAt: string;
  userId: string;
  mock?: true;
}
const MOCK_SESSION_MS = 60 * 60 * 1000;
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
let session: Session | null = null;
let renewal: Promise<void> | null = null;
let generation = 0;
function valid(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  return (
    [
      "accessToken",
      "refreshToken",
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
  for (const listener of listeners) listener();
}
export function clearSession() {
  generation++;
  update(null);
}
async function exchange(path: string, body: object) {
  let response: Response;
  try {
    response = await fetch(`${authUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    throw new Error(
      "Não foi possível acessar a autenticação de QA. Confira a conexão e o CORS.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "E-mail ou senha inválidos."
        : `Autenticação indisponível (HTTP ${response.status}).`,
    );
  const result: unknown = await response.json();
  if (!valid(result)) throw new Error("Resposta de autenticação inválida.");
  return result;
}
export async function login(email: string, password: string) {
  const initial = generation;
  if (mockMode()) {
    generation++;
    update(mockSession(email));
    return;
  }
  const next = await exchange("/auth/login", { email, password });
  if (initial !== generation) return;
  generation++;
  update(next);
}
export async function refresh() {
  if (!renewal) {
    const current = session;
    renewal = (async () => {
      if (!current) throw new Error("Sua sessão terminou. Entre novamente.");
      if (current.mock) {
        update(mockSession(current.email));
        return;
      }
      try {
        const next = await exchange("/auth/refresh", {
          refreshToken: current.refreshToken,
        });
        if (session === current) update(next);
      } catch {
        if (session === current) clearSession();
        throw new Error("Sua sessão terminou. Entre novamente.");
      }
    })().finally(() => {
      renewal = null;
    });
  }
  return renewal;
}
export async function logout() {
  const current = session;
  clearSession();
  if (current && !current.mock)
    await fetch(`${authUrl.replace(/\/$/, "")}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
      signal: AbortSignal.timeout(10000),
      credentials: "omit",
      redirect: "error",
    }).catch(() => undefined);
}

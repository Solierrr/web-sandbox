import { services } from "./portal.service.js";

const targets = [...services, { id: "api-auth", url: "https://api-auth-xw6o.onrender.com" }, { id: "mcp-database", url: "https://api-mcp-wey6.onrender.com" }];

export async function probeService(id: string, upstream: typeof fetch) {
  const service = targets.find(item => item.id === id);
  if (!service) return null;
  const path = id === "api-auth" ? "/.well-known/jwks.json" : id.startsWith("api-") && ["api-core", "api-messenger", "api-notify"].includes(id) ? "/actuator/health" : "/health";
  try {
    const response = await upstream(new URL(path, service.url), { redirect: "manual", signal: AbortSignal.timeout(4000) });
    await response.body?.cancel();
    return { awake: response.status < 500, httpStatus: response.status };
  } catch { return { awake: false }; }
}

export interface Service {
  id: string;
  description: string;
  url: string;
  swagger?: string;
  health: string;
  kind:
    | "core"
    | "chat"
    | "validation"
    | "accessibility"
    | "messenger"
    | "recommendation"
    | "internal";
}
const env = import.meta.env;
export const authUrl =
  env.VITE_API_AUTH || "https://api-auth-xw6o.onrender.com";
export const services: Service[] = [
  {
    id: "api-core",
    description: "Cadastros centrais: modelos de placas solares.",
    url: env.VITE_API_CORE || "https://api-core-cqfn.onrender.com",
    swagger: "/swagger-ui/index.html",
    health: "/actuator/health",
    kind: "core",
  },
  {
    id: "api-messenger",
    description: "Conversas e histórico de mensagens do usuário.",
    url: env.VITE_API_MESSENGER || "https://api-messenger-5g2n.onrender.com",
    swagger: "/swagger-ui/index.html",
    health: "/actuator/health",
    kind: "messenger",
  },
  {
    id: "api-recommendation",
    description: "Recomendações de ofertas e fornecedores.",
    url:
      env.VITE_API_RECOMMENDATION ||
      "https://api-recommendation-qlml.onrender.com",
    swagger: "/docs",
    health: "/health/live",
    kind: "recommendation",
  },
  {
    id: "ai-assistant",
    description:
      "Assistente multiagente para encontrar profissionais e ofertas.",
    url: env.VITE_AI_ASSISTANT || "https://ai-assistant-5ljd.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "chat",
  },
  {
    id: "ai-geographic",
    description: "Rotas, deslocamentos e contexto geográfico.",
    url: env.VITE_AI_GEOGRAPHIC || "https://ai-geographic.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "chat",
  },
  {
    id: "ai-operational",
    description: "Assistente para operações do sistema.",
    url: env.VITE_AI_OPERATIONAL || "https://ai-operational.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "chat",
  },
  {
    id: "ai-accessibility",
    description: "Análise de imagens e descrições acessíveis.",
    url: env.VITE_AI_ACCESSIBILITY || "https://ai-accessibility.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "accessibility",
  },
  {
    id: "ai-validation",
    description: "Validação de empresas e certificados NR-10/NR-35.",
    url: env.VITE_AI_VALIDATION || "https://ai-validation-jjb7.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "validation",
  },
  {
    id: "api-email",
    description: "Templates e envio de e-mails. Integração interna pendente.",
    url: env.VITE_API_EMAIL || "",
    health: "/health",
    kind: "internal",
  },
  {
    id: "google-registry",
    description: "Integrações Google. Operações exigem credenciais internas.",
    url: env.VITE_GOOGLE_REGISTRY || "https://google-registry.onrender.com",
    swagger: "/docs",
    health: "/health",
    kind: "internal",
  },
];
export const tools = [
  {
    name: "Grafana",
    description: "Métricas, logs e traces.",
    url: env.VITE_GRAFANA_URL || "",
  },
  {
    name: "Argo CD",
    description: "Aplicações e sincronização GitOps.",
    url: env.VITE_ARGO_URL || "",
  },
];
export function externalUrl(value: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

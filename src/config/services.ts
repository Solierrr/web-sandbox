export interface Service {
  id: string;
  description: string;
  url: string;
}
const env = import.meta.env;
export const authUrl =
  env.VITE_API_AUTH || "https://api-auth-xw6o.onrender.com";
export const services: Service[] = [
  {
    id: "api-core",
    description: "Cadastros centrais: modelos de placas solares.",
    url: env.VITE_API_CORE || "https://api-core-cqfn.onrender.com",
  },
  {
    id: "api-messenger",
    description: "Conversas e histórico de mensagens do usuário.",
    url: env.VITE_API_MESSENGER || "https://api-messenger-5g2n.onrender.com",
  },
  {
    id: "api-recommendation",
    description: "Recomendações de ofertas e fornecedores.",
    url:
      env.VITE_API_RECOMMENDATION ||
      "https://api-recommendation-qlml.onrender.com",
  },
  {
    id: "ai-assistant",
    description:
      "Assistente multiagente para encontrar profissionais e ofertas.",
    url: env.VITE_AI_ASSISTANT || "https://ai-assistant-5ljd.onrender.com",
  },
  {
    id: "ai-geographic",
    description: "Rotas, deslocamentos e contexto geográfico.",
    url: env.VITE_AI_GEOGRAPHIC || "https://ai-geographic.onrender.com",
  },
  {
    id: "ai-operational",
    description: "Assistente para operações do sistema.",
    url: env.VITE_AI_OPERATIONAL || "https://ai-operational.onrender.com",
  },
  {
    id: "ai-accessibility",
    description: "Análise de imagens e descrições acessíveis.",
    url: env.VITE_AI_ACCESSIBILITY || "https://ai-accessibility.onrender.com",
  },
  {
    id: "ai-validation",
    description: "Validação de empresas e certificados NR-10/NR-35.",
    url: env.VITE_AI_VALIDATION || "https://ai-validation-jjb7.onrender.com",
  },
  {
    id: "api-email",
    description: "Templates e envio de e-mails. Integração interna pendente.",
    url: env.VITE_API_EMAIL || "",
  },
  {
    id: "api-google",
    description: "Integrações Google. Operações exigem credenciais internas.",
    url: env.VITE_GOOGLE_REGISTRY || "https://google-registry.onrender.com",
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

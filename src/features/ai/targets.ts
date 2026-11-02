import { prodUrl, qaUrl } from "../../config/catalog";

export type EnvId = "QA" | "PROD";
export type TargetKind = "chat" | "certificates" | "cnpj" | "image";

export interface AiTarget {
  id: string;
  label: string;
  description: string;
  service: string;
  kind: TargetKind;
  path: string;
  stagePath?: string;
  personas?: readonly string[];
}

export const environments: readonly { id: EnvId; label: string }[] = [
  { id: "QA", label: "QA" },
  { id: "PROD", label: "PROD" },
];

export const imagePurposes = [
  ["Produto", "product"],
  ["Perfil de empresa", "company_profile"],
  ["Perfil de profissional", "professional_profile"],
  ["Outro", "other"],
] as const;

export const aiTargets: readonly AiTarget[] = [
  {
    id: "assistant",
    label: "Assistente (chat)",
    description: "ai-assistant: conversa multiagente para encontrar profissionais e ofertas.",
    service: "ai-assistant",
    kind: "chat",
    path: "/debug/chat",
    personas: ["demandante", "profissional"],
  },
  {
    id: "operational",
    label: "Operacional (chat)",
    description: "ai-operational: operações do sistema. Ações de escrita rodam em modo simulado.",
    service: "ai-operational",
    kind: "chat",
    path: "/debug/chat",
  },
  {
    id: "geographic",
    label: "Geográfico (chat)",
    description: "ai-geographic: rotas, deslocamentos e contexto geográfico.",
    service: "ai-geographic",
    kind: "chat",
    path: "/debug/chat",
  },
  {
    id: "certificates",
    label: "Validação de certificados",
    description: "ai-validation: NR-10 e NR-35 a partir de duas URLs de imagem.",
    service: "ai-validation",
    kind: "certificates",
    path: "/debug/certificates/validate",
  },
  {
    id: "cnpj",
    label: "Validação de CNPJ",
    description: "ai-validation: consulta o CNPJ e o agente avalia os CNAEs.",
    service: "ai-validation",
    kind: "cnpj",
    path: "/debug/companies/validate-cnpj",
  },
  {
    id: "image",
    label: "Análise de imagem",
    description: "ai-accessibility: texto alternativo e moderação de uma imagem.",
    service: "ai-accessibility",
    kind: "image",
    path: "/debug/images/analyze",
    stagePath: "/debug/images/stage",
  },
];

export function baseUrl(target: AiTarget, environment: EnvId): string | undefined {
  const url = environment === "QA" ? qaUrl(target.service) : prodUrl(target.service);
  return url?.replace(/\/$/, "");
}

export function targetById(id: string | undefined): AiTarget | undefined {
  return aiTargets.find((target) => target.id === id);
}

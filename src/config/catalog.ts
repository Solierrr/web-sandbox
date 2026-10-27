import repositories from "./repositories.json";
import { authUrl, externalUrl, services } from "./services";

export type FrameworkId = "spring" | "langchain" | "fastapi" | "react";
export type LanguageId = "python" | "kotlin" | "java" | "typescript" | "terraform";
export type KindId = "service" | "library" | "infra" | "data" | "docs" | "mobile";
export type FilterGroupId = "framework" | "language" | "kind";
export type CatalogFilters = Partial<Record<FilterGroupId, string>>;

export interface CatalogEntry {
  id: string;
  description: string;
  github: string;
  kind: KindId;
  language?: LanguageId;
  frameworks: FrameworkId[];
  qa?: string;
  prod?: string;
  swaggerPath?: string;
  qaLabel?: string;
  gallery?: string;
  interfaces?: { kind: "swagger" | "mailpit"; qa?: string; prod?: string }[];
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterGroup {
  id: FilterGroupId;
  label: string;
  options: FilterOption[];
}

export interface StorybookLink {
  label: string;
  href?: string;
}

const env = import.meta.env;
const SPRING_DOCS = "/swagger-ui/index.html";
const FASTAPI_DOCS = "/docs";
const PROD_DOMAIN = "solarianetwork.site";
const GITHUB = "https://github.com/Solierrr";
const RENDER_QA: Record<string, string> = {
  "web-app": "https://web-app-ldi0.onrender.com",
  "web-sandbox": "https://web-sandbox-qa.onrender.com",
  "api-email": "https://api-email-6swz.onrender.com",
  "mcp-database": "https://api-mcp-wey6.onrender.com",
  "api-notify": "https://api-notify-i637.onrender.com",
};
const PROD_HOSTS: Record<string, string> = {
  "web-app": `https://${PROD_DOMAIN}`,
};
const NO_PROD = new Set(["web-sandbox", "mcp-database"]);

const FRAMEWORKS: Record<FrameworkId, string[]> = {
  spring: ["api-auth", "api-core", "api-messenger", "api-notify"],
  langchain: ["ai-assistant", "ai-geographic", "ai-operational", "ai-validation", "ai-accessibility"],
  fastapi: [
    "ai-assistant",
    "ai-geographic",
    "ai-operational",
    "ai-validation",
    "ai-accessibility",
    "api-recommendation",
    "api-google",
  ],
  react: ["web-app", "web-sandbox", "lib-web"],
};

const LANGUAGES: Record<string, LanguageId> = {
  Python: "python",
  Kotlin: "kotlin",
  Java: "java",
  TypeScript: "typescript",
  HCL: "terraform",
};

export const filterGroups: FilterGroup[] = [
  {
    id: "framework",
    label: "Framework",
    options: [
      { id: "spring", label: "Spring" },
      { id: "langchain", label: "LangChain" },
      { id: "fastapi", label: "FastAPI" },
      { id: "react", label: "React" },
    ],
  },
  {
    id: "language",
    label: "Linguagem",
    options: [
      { id: "python", label: "Python" },
      { id: "kotlin", label: "Kotlin" },
      { id: "java", label: "Java" },
      { id: "typescript", label: "TypeScript" },
      { id: "terraform", label: "Terraform" },
    ],
  },
  {
    id: "kind",
    label: "Tipo",
    options: [
      { id: "service", label: "Serviços" },
      { id: "library", label: "Bibliotecas" },
      { id: "infra", label: "Infraestrutura" },
      { id: "data", label: "Dados" },
      { id: "docs", label: "Documentação" },
      { id: "mobile", label: "Mobile" },
    ],
  },
];

function envName(id: string, kind: "QA" | "PROD") {
  return `VITE_${kind}_${id.toUpperCase().replace(/-/g, "_")}`;
}

function kindOf(id: string): KindId {
  if (id.startsWith("lib-")) return "library";
  if (id.startsWith("infra-")) return "infra";
  if (id.startsWith("database-") || id.startsWith("databricks-")) return "data";
  if (id.startsWith("docs-") || id.startsWith("mocks-") || id === ".github" || id === "generic-template") return "docs";
  if (id.startsWith("mobile-")) return "mobile";
  return "service";
}

function qaUrl(id: string) {
  const configured = id === "api-auth" ? authUrl : services.find((service) => service.id === id)?.url;
  return externalUrl(env[envName(id, "QA")] || configured || RENDER_QA[id] || "");
}

function prodUrl(id: string) {
  if (NO_PROD.has(id)) return undefined;
  return externalUrl(env[envName(id, "PROD")] || PROD_HOSTS[id] || `https://${id}.${PROD_DOMAIN}`);
}

function toEntry(repo: (typeof repositories)[number]): CatalogEntry {
  const id = repo.name;
  const kind = kindOf(id);
  const frameworks = (Object.keys(FRAMEWORKS) as FrameworkId[]).filter((framework) => FRAMEWORKS[framework].includes(id));
  const qa = kind === "service" || id === "web-sandbox" ? qaUrl(id) : undefined;
  const deployed = kind === "service" && qa !== undefined;
  return {
    id,
    description: repo.description || services.find((service) => service.id === id)?.description || "",
    github: `${GITHUB}/${id}`,
    kind,
    language: LANGUAGES[repo.language],
    frameworks,
    qa,
    prod: deployed ? prodUrl(id) : undefined,
    swaggerPath: frameworks.includes("spring") ? SPRING_DOCS : frameworks.includes("fastapi") ? FASTAPI_DOCS : undefined,
    qaLabel: id === "web-sandbox" ? "Sandbox" : undefined,
    gallery: id === "api-email" ? externalUrl(env.VITE_EMAIL_GALLERY || "https://solierrr.github.io/api-email/") : undefined,
    interfaces: id === "api-email" ? [
      { kind: "swagger", qa: externalUrl(env.VITE_QA_API_EMAIL_SWAGGER || ""), prod: externalUrl(env.VITE_PROD_API_EMAIL_SWAGGER || "") },
      { kind: "mailpit", qa: externalUrl(env.VITE_QA_API_EMAIL_MAILPIT || ""), prod: externalUrl(env.VITE_PROD_API_EMAIL_MAILPIT || "") },
    ] : undefined,
  };
}

export const entries: CatalogEntry[] = repositories.map(toEntry);

export function matches(entry: CatalogEntry, filters: CatalogFilters) {
  if (filters.framework && !entry.frameworks.includes(filters.framework as FrameworkId)) return false;
  if (filters.language && entry.language !== filters.language) return false;
  if (filters.kind && entry.kind !== filters.kind) return false;
  return true;
}

export const storybooks: StorybookLink[] = [
  {
    label: "web-app",
    href: externalUrl(env.VITE_STORYBOOK_WEB_APP || "https://solierrr.github.io/web-app/"),
  },
  {
    label: "lib-web",
    href: externalUrl(env.VITE_STORYBOOK_LIB_WEB || "https://solierrr.github.io/lib-web/"),
  },
];

export function withPath(base: string | undefined, path: string | undefined) {
  if (!base) return undefined;
  return path ? `${base.replace(/\/$/, "")}${path}` : base;
}

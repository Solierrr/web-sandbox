import { authUrl, externalUrl, services } from "./services";

export interface ApiDoc {
  id: string;
  description: string;
  url: string;
  specPath: string;
}

const springKinds = new Set(["core", "messenger"]);
export const apis: ApiDoc[] = [
  {
    id: "api-auth",
    description: "Autenticação, sessões e identidade.",
    url: authUrl,
    specPath: "/v3/api-docs",
  },
  ...services
    .filter((service) => externalUrl(service.url))
    .map((service) => ({
      id: service.id,
      description: service.description,
      url: service.url,
      specPath: springKinds.has(service.kind)
        ? "/v3/api-docs"
        : "/openapi.json",
    })),
];

export const findApi = (id: string | undefined) =>
  apis.find((api) => api.id === id);

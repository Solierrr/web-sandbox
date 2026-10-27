declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  import type { SwaggerRequest } from "./swagger.client";
  export default function SwaggerUI(options: {
    domNode: HTMLElement;
    spec: object;
    docExpansion: "list" | "none";
    filter: boolean;
    validatorUrl: null;
    queryConfigEnabled: boolean;
    persistAuthorization: boolean;
    withCredentials: boolean;
    requestInterceptor: (request: SwaggerRequest) => Promise<SwaggerRequest>;
  }): unknown;
}

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import "./swagger-theme.css";
import type { ApiDoc } from "../../../config/apis";
import {
  authorize,
  renewOnUnauthorized,
  type InterceptedRequest,
  type Spec,
} from "../openapi.service";

export default function SwaggerView({
  api,
  spec,
  filter,
}: {
  api: ApiDoc;
  spec: Spec;
  filter: string;
}) {
  return (
    <div className="swagger-theme swagger-scroll">
      <SwaggerUI
        spec={spec.document}
        filter={filter || true}
        docExpansion="list"
        defaultModelsExpandDepth={0}
        persistAuthorization={false}
        requestInterceptor={(request) =>
          authorize(api, request as unknown as InterceptedRequest) as unknown as Promise<typeof request>
        }
        responseInterceptor={(response) => {
          renewOnUnauthorized(api, response as unknown as { url: string; status: number });
          return response;
        }}
      />
    </div>
  );
}

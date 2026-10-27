import { useEffect, useRef } from "react";
import SwaggerUI from "swagger-ui-dist/swagger-ui-bundle.js";
import { authorizeRequest } from "./documentation.service";
import "swagger-ui-dist/swagger-ui.css";

export default function SwaggerPanel({ id, spec }: { id: string; spec: object }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    SwaggerUI({
      domNode: node, spec, docExpansion: "none", filter: true,
      validatorUrl: null, queryConfigEnabled: false, persistAuthorization: false,
      withCredentials: false,
      requestInterceptor: request => authorizeRequest(id, request),
    });
    return () => { node.replaceChildren(); };
  }, [id, spec]);
  return <div ref={root} className="swagger-scroll h-[65dvh] overflow-auto rounded-small" />;
}

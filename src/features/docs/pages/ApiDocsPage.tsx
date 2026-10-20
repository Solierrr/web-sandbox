import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { OperationalPage, WhiteButton } from "@solaria.network/web-lib";
import { externalUrl } from "../../../config/services";
import type { ApiDoc } from "../../../config/apis";
import { forgetSpec, loadSpec, type LoadState } from "../openapi.service";
import ApiStatus from "../components/ApiStatus";

const SwaggerView = lazy(() => import("../components/SwaggerView"));

export default function ApiDocsPage({ api }: { api: ApiDoc }) {
  const [params] = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadSpec(api).then(
      (spec) => active && setState({ status: "ready", spec }),
      (failure: unknown) =>
        active &&
        setState({
          status: "error",
          message:
            failure instanceof Error ? failure.message : "Erro inesperado.",
        }),
    );
    return () => {
      active = false;
    };
  }, [api, attempt]);

  const retry = useCallback(() => {
    forgetSpec(api.id);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, [api.id]);

  const github = `https://github.com/Solierrr/${api.id}`;
  const raw = externalUrl(`${api.url}${api.specPath}`);
  return (
    <OperationalPage
      title={api.id}
      description={api.description}
      actions={
        <>
          <ApiStatus state={state} />
          <Link className="text-orange" to="/docs">
            Todas as APIs
          </Link>
          {raw && (
            <a
              className="text-orange"
              href={raw}
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI ↗
            </a>
          )}
          <a
            className="text-orange"
            href={github}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </>
      }
    >
      {state.status === "loading" && (
        <p role="status" className="text-operational-muted">
          Carregando a documentação. Em QA a API pode levar cerca de 30 segundos
          para acordar.
        </p>
      )}
      {state.status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-hard border border-operational-border bg-white p-5"
        >
          <p className="text-feedback-error">{state.message}</p>
          <WhiteButton
            type="button"
            content="Tentar de novo"
            description={`Tentar carregar de novo a documentação de ${api.id}`}
            onClick={retry}
          />
        </div>
      )}
      {state.status === "ready" && (
        <Suspense
          fallback={<p role="status">Carregando o visualizador…</p>}
        >
          <SwaggerView
            api={api}
            spec={state.spec}
            filter={params.get("q") ?? ""}
          />
        </Suspense>
      )}
    </OperationalPage>
  );
}

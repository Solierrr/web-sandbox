import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input, OperationalPage, WhiteButton } from "@solaria.network/web-lib";
import { apis, type ApiDoc } from "../../../config/apis";
import {
  forgetSpec,
  loadSpec,
  type LoadState,
  type Operation,
} from "../openapi.service";
import ApiStatus from "../components/ApiStatus";

const maxResults = 100;
const methodTone: Record<string, string> = {
  get: "bg-feedback-info/10 text-feedback-info",
  post: "bg-feedback-success/10 text-feedback-success",
  put: "bg-feedback-warning/10 text-feedback-warning",
  patch: "bg-feedback-warning/10 text-feedback-warning",
  delete: "bg-feedback-error/10 text-feedback-error",
};

export default function DocsOverviewPage() {
  const [states, setStates] = useState<Record<string, LoadState>>(() =>
    Object.fromEntries(apis.map((api) => [api.id, { status: "loading" }])),
  );
  const [query, setQuery] = useState("");

  const resolveSpec = useCallback((api: ApiDoc) => {
    loadSpec(api).then(
      (spec) =>
        setStates((current) => ({ ...current, [api.id]: { status: "ready", spec } })),
      (failure: unknown) =>
        setStates((current) => ({
          ...current,
          [api.id]: {
            status: "error",
            message:
              failure instanceof Error ? failure.message : "Erro inesperado.",
          },
        })),
    );
  }, []);
  const load = useCallback((api: ApiDoc) => {
    setStates((current) => ({ ...current, [api.id]: { status: "loading" } }));
    resolveSpec(api);
  }, [resolveSpec]);
  useEffect(() => {
    for (const api of apis) resolveSpec(api);
  }, [resolveSpec]);

  const operations = useMemo(
    () =>
      Object.values(states).flatMap((state) =>
        state.status === "ready" ? state.spec.operations : [],
      ),
    [states],
  );
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [] as Operation[];
    return operations.filter((operation) =>
      `${operation.method} ${operation.path} ${operation.summary} ${operation.tag} ${operation.api}`
        .toLowerCase()
        .includes(term),
    );
  }, [operations, query]);

  return (
    <OperationalPage
      title="Documentação das APIs"
      description={`Todas as APIs do ambiente em um lugar. ${operations.length} endpoints carregados.`}
    >
      <div className="flex flex-col gap-8">
        <section aria-label="Buscar endpoint" className="flex flex-col gap-3">
          <Input
            name="endpoint-search"
            type="search"
            rounded
            placeholder="Buscar endpoint em todas as APIs (caminho, método, resumo ou tag)"
            icon={{ name: "search" }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar endpoint em todas as APIs"
          />
          {query.trim() && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-hard border border-operational-border bg-white"
            >
              <p className="border-b border-operational-border px-4 py-2 text-sm text-operational-muted">
                {matches.length} resultado{matches.length === 1 ? "" : "s"}
                {matches.length > maxResults
                  ? ` (mostrando os ${maxResults} primeiros)`
                  : ""}
              </p>
              <ul className="max-h-96 overflow-auto">
                {matches.slice(0, maxResults).map((operation) => (
                  <li
                    key={`${operation.api}${operation.method}${operation.path}`}
                  >
                    <Link
                      className="flex flex-wrap items-center gap-3 px-4 py-2 hover:bg-operational-hover"
                      to={`/docs/${operation.api}?q=${encodeURIComponent(operation.tag)}`}
                    >
                      <span
                        className={`w-16 rounded-small px-2 py-0.5 text-center text-xs font-bold uppercase ${methodTone[operation.method]}`}
                      >
                        {operation.method}
                      </span>
                      <code className="text-sm">{operation.path}</code>
                      <span className="text-sm text-operational-muted">
                        {operation.api}
                        {operation.summary ? ` · ${operation.summary}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-label="APIs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apis.map((api) => {
            const state = states[api.id];
            return (
              <article
                key={api.id}
                className="flex flex-col gap-3 rounded-hard border border-operational-border bg-white p-5 shadow-surface"
              >
                <header className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold">{api.id}</h2>
                  <ApiStatus state={state} />
                </header>
                <p className="text-sm text-operational-muted">{api.description}</p>
                {state.status === "ready" && (
                  <p className="text-sm">
                    <strong>{state.spec.operations.length}</strong> endpoints
                    {state.spec.version ? ` · ${/^v/i.test(state.spec.version) ? state.spec.version : `v${state.spec.version}`}` : ""}
                  </p>
                )}
                {state.status === "error" && (
                  <p role="alert" className="text-sm text-feedback-error">
                    {state.message}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  {state.status === "ready" && (
                    <Link className="text-orange font-semibold" to={`/docs/${api.id}`}>
                      Abrir documentação
                    </Link>
                  )}
                  {state.status === "error" && (
                    <WhiteButton
                      type="button"
                      content="Tentar de novo"
                      description={`Tentar carregar de novo a documentação de ${api.id}`}
                      onClick={() => {
                        forgetSpec(api.id);
                        load(api);
                      }}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </OperationalPage>
  );
}

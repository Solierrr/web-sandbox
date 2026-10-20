import type { Result } from "../../../lib/shared/http/http.service";

export default function ResponsePanel({
  result,
  error,
  busy,
}: {
  result: Result | null;
  error: string;
  busy: boolean;
}) {
  return (
    <section
      aria-label="Resposta do serviço"
      aria-busy={busy}
      className="rounded-hard border border-operational-border bg-white p-5"
    >
      <h2 className="text-lg">Resposta do serviço</h2>
      <div role="status" aria-live="polite" className="mt-3">
        {busy ? (
          <p>Executando solicitação…</p>
        ) : error ? (
          <p className="text-red-700">{error}</p>
        ) : result ? (
          <p>
            HTTP {result.status} · {result.duration} ms
            {result.status >= 400 ? " · Solicitação não concluída" : ""}
          </p>
        ) : (
          <p className="text-gray">
            Execute uma ação para inspecionar o retorno.
          </p>
        )}
      </div>
      {result && (
        <pre
          tabIndex={0}
          aria-label="Corpo da resposta"
          className="scrollbar-none mt-4 max-h-96 overflow-auto rounded-medium bg-operational-surface p-4 text-sm whitespace-pre-wrap break-all"
        >
          {JSON.stringify(result.body, null, 2)}
        </pre>
      )}
    </section>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { OperationalPage, Surface } from "@solaria.network/web-lib";
import { BarChart } from "../charts";
import { Collapsible, FilterBar, Notice } from "../components";
import { periodWeeks } from "../cost";
import { CostSimulation } from "../CostSimulation";
import { RoiExplanation } from "../RoiExplanation";
import { getDataSource } from "../data/source";
import { DataUnavailableError, type DashboardData, type LangSmithRow, type LangSmithSummary } from "../data/types";
import { useFilters } from "../filters";
import { percent, tokens, usd } from "../format";
import { targetById } from "../targets";
import { formatMs } from "../trace";

type State =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string; unavailable: boolean };

type LangSmithState =
  | { status: "loading" }
  | { status: "ready"; data: LangSmithSummary }
  | { status: "error"; message: string };

const assistantLabel = (name: string) => targetById(name.replace(/^ai-/, ""))?.label ?? name;

function LangSmithTable({ title, label, rows, display }: { title: string; label: string; rows: LangSmithRow[]; display: (name: string) => string }) {
  return (
    <Surface contentClassName="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">Nenhuma execução no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide opacity-70">
              <tr>
                <th className="py-2 pr-3 font-semibold">{label}</th>
                <th className="pr-3 font-semibold">Execuções</th>
                <th className="pr-3 font-semibold">Tokens</th>
                <th className="pr-3 font-semibold">Custo</th>
                <th className="pr-3 font-semibold">Latência p99</th>
                <th className="font-semibold">Erros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-t border-black/10">
                  <td className="py-2 pr-3 font-semibold">{display(row.name)}</td>
                  <td className="pr-3">{row.runs}</td>
                  <td className="pr-3">{tokens(row.totalTokens)}</td>
                  <td className="pr-3">{usd(row.costUsd)}</td>
                  <td className="pr-3">{formatMs(row.p99Ms)}</td>
                  <td>{percent(row.errorRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
}

function LangSmithSection({ state }: { state: LangSmithState }) {
  if (state.status === "loading") return <Notice tone="info">Carregando o LangSmith…</Notice>;
  if (state.status === "error") return <Notice tone="info">{state.message}</Notice>;
  const { data } = state;
  if (!data.enabled || !data.totals)
    return <Notice tone="info">O LangSmith não está configurado no api-messenger deste ambiente (LANGSMITH_API_KEY e LANGSMITH_PROJECT).</Notice>;
  const totals = data.totals;
  const onlyAssistant = data.byAssistant.length === 0 && data.byModel.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-sm font-semibold">LangSmith{data.project ? ` · ${data.project}` : ""}</h2>
        {data.projectUrl && (
          <a className="text-xs underline" href={data.projectUrl} target="_blank" rel="noreferrer">
            Abrir no LangSmith
          </a>
        )}
        <span className="text-xs opacity-70">
          {onlyAssistant
            ? "Execuções só do ai-assistant no período, sem o filtro de assistente. O api-messenger faz uma consulta só, para não passar do limite do LangSmith."
            : "Execuções de todos os assistentes no período, sem o filtro de assistente."}
        </span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Kpi label="Execuções" value={totals.runs} hint="Um turno do assistente por execução" />
        <Kpi label="Custo" value={usd(totals.costUsd)} />
        <Kpi label="Tokens" value={tokens(totals.totalTokens)} hint={`${tokens(totals.promptTokens)} entrada · ${tokens(totals.completionTokens)} saída`} />
        <Kpi label="Taxa de erro" value={percent(totals.errorRate)} />
        <Kpi label="Latência p50" value={formatMs(totals.p50Ms)} />
        <Kpi label="Latência p99" value={formatMs(totals.p99Ms)} />
      </div>
      {!onlyAssistant && <LangSmithTable title="Execuções por assistente" label="Assistente" rows={data.byAssistant} display={assistantLabel} />}
      {!onlyAssistant && <LangSmithTable title="Execuções por modelo" label="Modelo" rows={data.byModel} display={(name) => name} />}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Surface contentClassName="flex flex-col gap-1 p-4">
      <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {hint && <span className="text-xs opacity-70">{hint}</span>}
    </Surface>
  );
}

export default function DashboardsPage() {
  const filters = useFilters();
  const source = getDataSource();
  const [state, setState] = useState<State>({ status: "loading" });
  const [langsmith, setLangsmith] = useState<LangSmithState>({ status: "loading" });
  const dashboardReady = state.status === "ready";

  useEffect(() => {
    let cancelled = false;
    source
      .dashboard(filters)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          unavailable: error instanceof DataUnavailableError,
          message: error instanceof Error ? error.message : "Não foi possível carregar os dashboards.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source, filters]);

  useEffect(() => {
    if (!dashboardReady) return;
    let cancelled = false;
    source
      .langsmith(filters)
      .then((data) => !cancelled && setLangsmith({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!cancelled) setLangsmith({ status: "error", message: error instanceof Error ? error.message : "Não foi possível carregar o LangSmith." });
      });
    return () => {
      cancelled = true;
    };
  }, [source, filters, dashboardReady]);

  return (
    <OperationalPage title="Dashboards" description="NPS, custo, latência e erros dos assistentes no período.">
      <div className="flex flex-col gap-4">
        {source.demo && <Notice>Dados de exemplo (modo mock). Nada aqui vem dos serviços.</Notice>}
        <FilterBar allowAll deferred submitLabel="Aplicar filtros" />
        {state.status === "error" && <Notice tone={state.unavailable ? "info" : "error"}>{state.message}</Notice>}
        {state.status === "ready" && (
          <>
            {state.data.truncated && (
              <Notice>Há mais conversas no período do que o painel lê de uma vez (as 2000 mais recentes). Reduza o período para ver tudo.</Notice>
            )}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Kpi label="Conversas" value={state.data.totals.conversations} />
              <Kpi label="NPS" value={state.data.totals.nps ?? "-"} hint="Entre quem respondeu a pesquisa" />
              <Kpi label="Custo" value={usd(state.data.totals.costUsd)} />
              <Kpi
                label="Custo médio por conversa"
                value={state.data.totals.pricedConversations > 0 ? usd(state.data.totals.costUsd / state.data.totals.pricedConversations) : "-"}
                hint="Só conversas com custo registrado"
              />
              <Kpi label="Resoluções" value={state.data.totals.resolvedConversations} hint="Conversas sem erro e com resposta do assistente" />
              <Kpi
                label="Custo por resolução"
                value={state.data.totals.resolvedConversations > 0 ? usd(state.data.totals.costUsd / state.data.totals.resolvedConversations) : "-"}
                hint="Custo das conversas dividido pelas resoluções"
              />
              <Kpi label="Taxa de erro" value={percent(state.data.totals.errorRate)} />
              <Kpi label="Latência p50" value={formatMs(state.data.totals.p50Ms)} />
              <Kpi label="Latência p95" value={formatMs(state.data.totals.p95Ms)} />
            </div>
            <LangSmithSection state={langsmith} />
            <Surface contentClassName="p-4">
              <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <BarChart title="Conversas por dia" points={state.data.byDay.map((day) => ({ label: day.day, value: day.conversations }))} format={String} />
              <BarChart title="Custo por dia" points={state.data.byDay.map((day) => ({ label: day.day, value: day.costUsd }))} format={usd} />
              </div>
            </Surface>
            <Surface contentClassName="flex flex-col gap-3 p-4">
              <h2 className="text-sm font-semibold">Por assistente</h2>
              {state.data.byAssistant.length === 0 ? (
                <p className="text-sm opacity-70">Nenhuma conversa no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide opacity-70">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Assistente</th>
                        <th className="pr-3 font-semibold">Conversas</th>
                        <th className="pr-3 font-semibold">NPS</th>
                        <th className="pr-3 font-semibold">Custo</th>
                        <th className="pr-3 font-semibold">Latência p95</th>
                        <th className="font-semibold">Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.data.byAssistant.map((row) => (
                        <tr key={row.assistant} className="border-t border-black/10">
                          <td className="py-2 pr-3 font-semibold">{targetById(row.assistant)?.label ?? row.assistant}</td>
                          <td className="pr-3">{row.conversations}</td>
                          <td className="pr-3">{row.nps ?? "-"}</td>
                          <td className="pr-3">{usd(row.costUsd)}</td>
                          <td className="pr-3">{formatMs(row.p95Ms)}</td>
                          <td>{percent(row.errorRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>
            <CostSimulation
              basis={{
                from: filters.from,
                to: filters.to,
                conversations: state.data.totals.conversations,
                pricedConversations: state.data.totals.pricedConversations,
                resolvedConversations: state.data.totals.resolvedConversations,
                users: state.data.totals.users,
                costUsd: state.data.totals.costUsd,
                costP50: state.data.totals.costP50,
                costP95: state.data.totals.costP95,
                weeks: periodWeeks(filters.from, filters.to),
              }}
              truncated={state.data.truncated}
            />
            <Collapsible title="Como o ROI e o custo humano são calculados">
              <RoiExplanation />
            </Collapsible>
          </>
        )}
      </div>
    </OperationalPage>
  );
}

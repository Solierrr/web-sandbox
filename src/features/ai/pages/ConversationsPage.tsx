import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Input, OperationalPage, Surface } from "@solaria.network/web-lib";
import { Field, FilterBar, Notice } from "../components";
import { getDataSource } from "../data/source";
import { DataUnavailableError, type ConversationSummary } from "../data/types";
import { useFilters } from "../filters";
import { dateTime, shortId, usd } from "../format";
import { aiTargets, targetById } from "../targets";
import { formatMs } from "../trace";

const LIST_LIMIT = 200;
const chatTargets = aiTargets.filter((target) => target.kind === "chat");

type Result =
  | { items: ConversationSummary[] }
  | { message: string; unavailable: boolean };

export default function ConversationsPage() {
  const filters = useFilters();
  const source = getDataSource();
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("");
  const [text, setText] = useState("");
  const [applied, setApplied] = useState({ sessionId: "", userId: "", text: "" });
  const [answer, setAnswer] = useState<{ key: string; result: Result } | null>(null);
  const key = JSON.stringify([filters, applied]);

  useEffect(() => {
    let cancelled = false;
    void source
      .listConversations({ filters, ...applied, limit: LIST_LIMIT })
      .then((items) => ({ items }) as Result)
      .catch(
        (error: unknown): Result => ({
          unavailable: error instanceof DataUnavailableError,
          message: error instanceof Error ? error.message : "Não foi possível buscar as conversas.",
        }),
      )
      .then((result) => {
        if (!cancelled) setAnswer({ key, result });
      });
    return () => {
      cancelled = true;
    };
  }, [source, filters, applied, key]);

  const result = answer?.key === key ? answer.result : null;

  return (
    <OperationalPage title="Conversas" description="Consulte conversas, filtre sessões e abra o passo a passo de cada uma.">
      <div className="flex flex-col gap-4">
        {source.demo && <Notice>Dados de exemplo (modo mock). Nada aqui vem dos serviços.</Notice>}
        <FilterBar targets={chatTargets} allowAll deferred onSubmit={() => setApplied({ sessionId, userId, text })} submitLabel="Buscar conversas">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Pergunta ou resposta">
              <Input name="Pergunta ou resposta" className="w-full" placeholder="Buscar por pergunta ou resposta…" value={text} onChange={(event) => setText(event.target.value)} />
            </Field>
            <Field label="Session ID">
              <Input name="Session ID" className="w-full" placeholder="Ex: 19eba199-986f" value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
            </Field>
            <Field label="User ID">
              <Input name="User ID" className="w-full" placeholder="Ex: 1234567" value={userId} onChange={(event) => setUserId(event.target.value)} />
            </Field>
          </div>
        </FilterBar>

        {result === null && <Notice>Buscando…</Notice>}
        {result && "message" in result && <Notice tone={result.unavailable ? "info" : "error"}>{result.message}</Notice>}
        {result && "items" in result && (
          <Surface contentClassName="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold">Histórico de conversas</h2>
            <p className="text-xs opacity-70">
              {result.items.length === 1 ? "Foi encontrada 1 conversa." : `Foram encontradas ${result.items.length} conversas.`}
              {result.items.length >= LIST_LIMIT && ` Mostrando as ${LIST_LIMIT} mais recentes; refine os filtros para ver as outras.`}
            </p>
            {result.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide opacity-70">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Sessão</th>
                      <th className="pr-3 font-semibold">Assistente</th>
                      <th className="pr-3 font-semibold">Usuário</th>
                      <th className="pr-3 font-semibold">Início</th>
                      <th className="pr-3 font-semibold">Mensagens</th>
                      <th className="pr-3 font-semibold">Latência</th>
                      <th className="pr-3 font-semibold">Custo</th>
                      <th className="font-semibold">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.sessionId} className="border-t border-black/10 align-top">
                        <td className="py-2 pr-3">
                          <Link className="font-semibold underline" to={`/ia/conversas/${encodeURIComponent(item.sessionId)}`}>
                            {shortId(item.sessionId)}
                          </Link>
                          <p className="max-w-xs truncate text-xs opacity-70">{item.firstMessage}</p>
                        </td>
                        <td className="pr-3">{targetById(item.assistant)?.label ?? item.assistant}</td>
                        <td className="pr-3">{item.userId}</td>
                        <td className="pr-3">{dateTime(item.startedAt)}</td>
                        <td className="pr-3">{item.messageCount}</td>
                        <td className="pr-3">
                          {formatMs(item.latencyMs)}
                          {item.error && <span className="ml-2 text-red-700">erro</span>}
                        </td>
                        <td className="pr-3">{usd(item.costUsd)}</td>
                        <td>{item.nps ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
        )}
      </div>
    </OperationalPage>
  );
}

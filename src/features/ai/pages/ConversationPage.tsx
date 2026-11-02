import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { OperationalPage, Surface } from "@solaria.network/web-lib";
import { Notice } from "../components";
import { getDataSource } from "../data/source";
import { DataUnavailableError, type ConversationDetail } from "../data/types";
import { setPlaygroundRun } from "../playground";
import { NO_REPLAY_REASONS } from "../replay";
import { getSimulatorSession, sessionDetail } from "../sessions";
import { dateTime, usd } from "../format";
import { targetById } from "../targets";
import { formatMs } from "../trace";

type State =
  | { status: "loading" }
  | { status: "ready"; item: ConversationDetail }
  | { status: "missing" }
  | { status: "error"; message: string };

export default function ConversationPage() {
  const { sessionId = "" } = useParams();
  const source = getDataSource();
  const [state, setState] = useState<State>({ status: "loading" });
  const simulated = getSimulatorSession(sessionId);

  useEffect(() => {
    if (simulated) return;
    let cancelled = false;
    source
      .getConversation(sessionId)
      .then((item) => !cancelled && setState(item ? { status: "ready", item } : { status: "missing" }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof DataUnavailableError || error instanceof Error ? error.message : "Não foi possível abrir a conversa.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source, sessionId, simulated]);

  const back = (
    <Link className="text-sm underline" to="/ia/conversas">
      Voltar para conversas
    </Link>
  );

  if (!simulated && state.status !== "ready") {
    return (
      <OperationalPage title="Conversa" description={back}>
        {state.status === "loading" && <Notice>Carregando…</Notice>}
        {state.status === "missing" && <Notice>Conversa não encontrada.</Notice>}
        {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      </OperationalPage>
    );
  }
  const item = simulated ? sessionDetail(simulated) : (state as Extract<State, { status: "ready" }>).item;
  const demo = simulated ? simulated.run.demo : source.demo;
  const localUrl = simulated?.run.localUrl;
  const target = targetById(item.assistant);
  const replies = item.messages.flatMap((message, index) => (message.role === "assistant" ? [{ message, index }] : []));

  function openPlayground(index: number) {
    const message = item.messages[index];
    if (!target || !message?.trace?.length) return;
    setPlaygroundRun({
      target,
      environment: item.environment,
      conversationId: item.replayConversationId ?? item.sessionId,
      messages: item.messages.slice(0, index).map((previous) => ({ role: previous.role, text: previous.content })),
      outcome: {
        ok: true,
        status: 200,
        elapsed: message.latencyMs ?? 0,
        body: { response: message.content, specialists_used: message.agent ? [message.agent] : [] },
        debug: { nodes: message.trace, truncated: false },
      },
      demo,
      localUrl,
      replay: message.replay,
      replayReason: message.replay ? undefined : (message.replayReason ?? (simulated ? NO_REPLAY_REASONS.oldService : NO_REPLAY_REASONS.history)),
      back: { to: `/ia/conversas/${encodeURIComponent(item.sessionId)}`, label: "Voltar para a conversa" },
    });
  }

  return (
    <OperationalPage title="Chat da sessão" description={back}>
      <div className="flex flex-col gap-4">
        {demo && <Notice>Dados de exemplo (modo mock).</Notice>}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          <Surface contentClassName="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold">
              {target?.label ?? item.assistant} · {item.environment}
            </h2>
            <p className="text-xs opacity-70">
              Sessão {item.sessionId} · usuário {item.userId} · início {dateTime(item.startedAt)}
              {item.nps === null ? "" : ` · nota ${item.nps}`}
            </p>
            {item.messages.map((message, index) => (
              <div key={index} className={`flex flex-col gap-1 ${message.role === "user" ? "items-start" : "items-end"}`}>
                <span className="text-xs opacity-70">
                  {message.role === "user" ? `Usuário ${item.userId}` : `Assistente${message.agent ? ` [${message.agent}]` : ""}`} · {dateTime(message.at)}
                </span>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-black/5" : "bg-[#FF6500]/10"}`}>
                  {message.content}
                </p>
              </div>
            ))}
          </Surface>
          <div className="flex flex-col gap-4">
            {replies.map(({ message, index }, position) => (
              <Surface key={index} contentClassName="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Resposta {position + 1}</h2>
                  {target && message.trace && message.trace.length > 0 && (
                    <Link
                      className="rounded-md border border-[#FF6500] px-2 py-1 text-sm font-semibold text-[#C24E00] no-underline"
                      to="/ia/playground"
                      aria-label={`Playground Debug da resposta ${position + 1}`}
                      onClick={() => openPlayground(index)}
                    >
                      Playground Debug
                    </Link>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ["Assistente", target?.label ?? item.assistant],
                    ["Agente", message.agent ?? "-"],
                    ["Ambiente", item.environment],
                    ["Hora", dateTime(message.at)],
                    ["Latência", formatMs(message.latencyMs)],
                    ["Custo", message.costUsd === null || message.costUsd === undefined ? "-" : usd(message.costUsd)],
                    ...Object.entries(item.metadata),
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wide opacity-70">{key}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Surface>
            ))}
          </div>
        </div>
      </div>
    </OperationalPage>
  );
}

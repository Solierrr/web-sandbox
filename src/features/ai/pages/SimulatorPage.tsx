import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox, Input, MessageComposer, OperationalPage, PrimaryButton, Select, Surface, WhiteButton } from "@solaria.network/web-lib";
import { Field, FilterBar, Json, Notice } from "../components";
import { demoOutcome } from "../data/mock";
import { getDataSource } from "../data/source";
import { localBase, runDebug, type DebugInput, type DebugOutcome } from "../debug.service";
import { useFilters } from "../filters";
import type { PlaygroundRun } from "../playground";
import { replayFor } from "../replay";
import { recordSimulatorTurn } from "../sessions";
import { aiTargets, baseUrl, imagePurposes, targetById, type AiTarget } from "../targets";
import { formatMs, totalTokens } from "../trace";

type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; outcome: DebugOutcome; run: Omit<PlaygroundRun, "messages" | "outcome" | "conversationId"> };

const newConversationId = () => `sandbox-${crypto.randomUUID().slice(0, 8)}`;
const DEFAULT_LOCAL_URL = "http://localhost:8000";

function AssistantTurn({ turn }: { turn: Extract<Turn, { role: "assistant" }> }) {
  const { outcome, run } = turn;
  const tokens = outcome.debug ? totalTokens(outcome.debug) : null;
  const answer = outcome.ok && typeof outcome.body.response === "string" ? outcome.body.response : null;
  const rest = outcome.ok ? Object.fromEntries(Object.entries(outcome.body).filter(([key]) => key !== "response")) : null;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs opacity-70">
        {run.target.label} · {run.environment}
        {run.demo ? " · exemplo" : ""}
      </span>
      <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${outcome.ok ? "bg-[#FF6500]/10" : "bg-red-100 text-red-800"}`}>
        {answer !== null && <p className="whitespace-pre-wrap">{answer}</p>}
        {!outcome.ok && <p>{outcome.message}</p>}
        {outcome.ok && answer === null && <Json value={outcome.body} />}
        {answer !== null && rest && Object.keys(rest).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs opacity-70">Resposta completa</summary>
            <Json value={rest} />
          </details>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 text-xs opacity-70">
        <span>{formatMs(outcome.elapsed)}</span>
        {tokens && tokens.calls > 0 && (
          <span>
            {tokens.calls} chamadas · {tokens.input}/{tokens.output} tokens
          </span>
        )}
      </p>
    </div>
  );
}

export default function SimulatorPage() {
  const filters = useFilters();
  const demo = getDataSource().demo;
  const environment = filters.environment;
  const target: AiTarget = targetById(filters.assistant) ?? aiTargets[0];

  const [conversationId, setConversationId] = useState(newConversationId);
  const [persona, setPersona] = useState("demandante");
  const [useLocal, setUseLocal] = useState(false);
  const [localUrl, setLocalUrl] = useState(DEFAULT_LOCAL_URL);
  const [message, setMessage] = useState("");
  const [nr10, setNr10] = useState("");
  const [nr35, setNr35] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [purpose, setPurpose] = useState<string>("product");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, running]);

  const url = useLocal ? localBase(localUrl) : baseUrl(target, environment);
  const chat = target.kind === "chat";
  const formReady =
    target.kind === "certificates" ? nr10.trim() && nr35.trim() : target.kind === "cnpj" ? cnpj.trim() : target.kind === "image" ? file !== null : true;

  function newConversation() {
    controller.current?.abort();
    setTurns([]);
    setRunning(false);
    setConversationId(newConversationId());
  }

  async function execute(input: DebugInput, summary: string) {
    if (running) return;
    const current = new AbortController();
    controller.current = current;
    setRunning(true);
    const userTurn: Turn = { id: ++counter.current, role: "user", text: summary };
    setTurns((previous) => [...previous, userTurn]);
    const outcome = demo
      ? demoOutcome(target.id, summary)
      : await runDebug(target, environment, input, current.signal, useLocal ? localUrl : undefined);
    if (current.signal.aborted) return;
    const run = { target, environment, demo, localUrl: useLocal ? localUrl : undefined };
    setTurns((previous) => [...previous, { id: ++counter.current, role: "assistant", outcome, run }]);
    recordSimulatorTurn(conversationId, run, {
      userText: summary,
      outcome,
      at: new Date().toISOString(),
      replay: demo ? undefined : replayFor(input, outcome),
    });
    setRunning(false);
  }

  function send() {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    void execute(
      { kind: "chat", conversationId: conversationId.trim(), message: text, persona: target.personas ? persona : undefined },
      text,
    );
  }

  function submitForm() {
    if (target.kind === "certificates") void execute({ kind: "certificates", nr10Url: nr10.trim(), nr35Url: nr35.trim() }, "NR-10 e NR-35");
    else if (target.kind === "cnpj") void execute({ kind: "cnpj", cnpj: cnpj.trim() }, cnpj.trim());
    else if (target.kind === "image" && file) void execute({ kind: "image", file, purpose }, `${file.name} (${purpose})`);
  }

  return (
    <OperationalPage title="Simulador" description="Simule conversas com os assistentes e valide as respostas em ambiente controlado.">
      <div className="flex flex-col gap-4">
        {demo && <Notice>Modo mock: as respostas e os passos são de exemplo e não saem do navegador.</Notice>}
        <FilterBar allowAll={false} period={false} />
        {environment === "PROD" && (
          <Notice tone="warning">
            PROD: o serviço consulta dados reais. Nada é salvo no histórico e, no operacional, ações de escrita ficam simuladas.
          </Notice>
        )}
        <Surface contentClassName="flex flex-col overflow-visible!">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">{turns.length ? target.label : "Inicie uma nova conversa"}</h2>
              <p className="text-xs opacity-70">
                Session ID:{" "}
                {turns.length > 0 ? (
                  <Link className="font-semibold underline" to={`/ia/conversas/${encodeURIComponent(conversationId)}`}>
                    {conversationId}
                  </Link>
                ) : (
                  conversationId
                )}
              </p>
            </div>
            <WhiteButton description="Começar outra conversa de teste" content="Nova conversa" action={newConversation} />
          </div>
          <div className="flex flex-wrap">
            <aside className="flex flex-col gap-4 border-r border-black/10 p-4" style={{ flex: "0 0 300px", maxWidth: "100%" }}>
              <h3 className="text-sm font-semibold">Configurações</h3>
              <Checkbox label="Usar servidor local" checked={useLocal} onChange={(event) => setUseLocal(event.target.checked)} />
              {useLocal && (
                <Field label="URL do servidor local">
                  <Input name="URL do servidor local" className="w-full" value={localUrl} onChange={(event) => setLocalUrl(event.target.value)} />
                  {!localBase(localUrl) && <span className="text-xs text-red-700">Só localhost ou 127.0.0.1 (o token do admin não sai para outro host).</span>}
                </Field>
              )}
              {chat && target.personas && (
                <Field label="Persona">
                  <Select
                    name="Persona"
                    options={target.personas.map((item) => [item, item] as const)}
                    value={persona}
                    onChange={(value) => value && setPersona(value)}
                  />
                </Field>
              )}
              {chat && (
                <Field label="Session ID">
                  <Input name="Session ID" className="w-full" value={conversationId} onChange={(event) => setConversationId(event.target.value)} />
                </Field>
              )}
              {target.kind === "certificates" && (
                <>
                  <Field label="URL da imagem do NR-10">
                    <Input name="URL NR-10" type="url" className="w-full" value={nr10} onChange={(event) => setNr10(event.target.value)} />
                  </Field>
                  <Field label="URL da imagem do NR-35">
                    <Input name="URL NR-35" type="url" className="w-full" value={nr35} onChange={(event) => setNr35(event.target.value)} />
                  </Field>
                </>
              )}
              {target.kind === "cnpj" && (
                <Field label="CNPJ">
                  <Input name="CNPJ" className="w-full" placeholder="12.345.678/0001-90" value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
                </Field>
              )}
              {target.kind === "image" && (
                <>
                  <Field label="Imagem">
                    <input type="file" accept="image/*" aria-label="Imagem" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                  </Field>
                  <Field label="Finalidade">
                    <Select
                      name="Finalidade"
                      options={imagePurposes.map(([label, value]) => [label, value] as const)}
                      value={purpose}
                      onChange={(value) => value && setPurpose(value)}
                    />
                  </Field>
                </>
              )}
              {!chat && (
                <PrimaryButton
                  description="Executar pela rota de debug"
                  content={running ? "Executando…" : "Executar"}
                  disabled={running || !formReady || !url}
                  action={submitForm}
                />
              )}
              <p className="text-xs opacity-70">
                {target.description} {url ? `Destino: ${url}${target.path}` : "Sem URL configurada para este ambiente."}
              </p>
            </aside>

            <section className="flex min-w-0 flex-col" style={{ flex: "1 1 360px" }}>
              <div className="flex flex-col gap-3 overflow-y-auto p-4" style={{ minHeight: 320, maxHeight: 520 }}>
                {turns.length === 0 && (
                  <div className="m-auto flex max-w-sm flex-col items-center gap-2 rounded-lg bg-black/5 p-6 text-center">
                    <h3 className="text-base font-semibold">{chat ? "Comece a conversar!" : "Pronto para executar"}</h3>
                    <p className="text-sm opacity-70">
                      {chat
                        ? `Envie uma mensagem para iniciar a conversa com o assistente ${target.label}.`
                        : "Preencha os dados ao lado e clique em Executar."}
                    </p>
                  </div>
                )}
                {turns.map((turn) =>
                  turn.role === "user" ? (
                    <div key={turn.id} className="flex flex-col items-start gap-1">
                      <span className="text-xs opacity-70">Você</span>
                      <p className="max-w-[88%] whitespace-pre-wrap rounded-lg bg-black/5 px-3 py-2 text-sm">{turn.text}</p>
                    </div>
                  ) : (
                    <AssistantTurn key={turn.id} turn={turn} />
                  ),
                )}
                {running && <p className="text-sm opacity-70">Executando…</p>}
                <div ref={end} />
              </div>
              {chat && (
                <div className="composer-clean border-t border-black/10 p-3">
                  <MessageComposer
                    value={message}
                    onChange={setMessage}
                    onSend={send}
                    placeholder="Digite sua mensagem..."
                    label="Mensagem"
                    sendLabel="Enviar mensagem"
                    disabled={running || !url}
                    compact
                  />
                  {running && (
                    <div className="pt-2">
                      <WhiteButton description="Cancelar a execução" content="Cancelar" action={() => controller.current?.abort()} />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </Surface>
      </div>
    </OperationalPage>
  );
}

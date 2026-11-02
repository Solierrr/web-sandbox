import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Input,
  OperationalPage,
  PrimaryButton,
  Select,
  StatusField,
  Surface,
  Textarea,
  WhiteButton,
} from "@solaria.network/web-lib";
import { runDebug, type DebugInput, type DebugOutcome } from "../debug.service";
import { aiTargets, baseUrl, environments, imagePurposes, targetById, type AiTarget, type EnvId } from "../targets";
import { formatJson, formatMs, nodeTokens, totalTokens, type DebugNode } from "../trace";

interface Run {
  id: number;
  target: AiTarget;
  environment: EnvId;
  summary: string;
  outcome: DebugOutcome;
}

const newConversationId = () => `sandbox-${crypto.randomUUID().slice(0, 8)}`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
      {children}
    </div>
  );
}

function Json({ value }: { value: unknown }) {
  const text = formatJson(value);
  if (!text) return null;
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/5 p-3 text-xs">
      {text}
    </pre>
  );
}

function NodeCard({ node }: { node: DebugNode }) {
  const tokens = nodeTokens(node);
  const failed = node.status === "error";
  return (
    <details className="rounded-lg border border-black/10 bg-white/60">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
        <span className="font-semibold">
          {node.order}. {node.node}
        </span>
        <span className={failed ? "text-red-700" : "opacity-70"}>{failed ? "erro" : "ok"}</span>
        <span className="opacity-70">{formatMs(node.duration_ms)}</span>
        {node.llm_calls.length > 0 && (
          <span className="opacity-70">
            {node.llm_calls.length} chamada{node.llm_calls.length > 1 ? "s" : ""} de LLM · {tokens.input}/{tokens.output} tokens
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {node.error && <p className="text-sm text-red-700">{node.error}</p>}
        <Field label="Entrada">
          <Json value={node.input} />
        </Field>
        <Field label="Saída">
          <Json value={node.output} />
        </Field>
        {node.llm_calls.map((call, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
            <p className="text-xs opacity-70">
              {call.model ?? "modelo n/d"} · {formatMs(call.latency_ms)} · {call.tokens_in ?? "-"}/{call.tokens_out ?? "-"} tokens
            </p>
            {call.error && <p className="text-sm text-red-700">{call.error}</p>}
            <Field label="Prompt">
              <Json value={call.prompt} />
            </Field>
            <Field label="Resposta do modelo">
              <Json value={call.completion} />
            </Field>
          </div>
        ))}
      </div>
    </details>
  );
}

function RunCard({ run }: { run: Run }) {
  const { outcome } = run;
  const debug = outcome.debug;
  const tokens = debug ? totalTokens(debug) : null;
  const answer = outcome.ok && typeof outcome.body.response === "string" ? outcome.body.response : null;
  const rest = outcome.ok && answer !== null ? Object.fromEntries(Object.entries(outcome.body).filter(([key]) => key !== "response")) : outcome.ok ? outcome.body : null;
  return (
    <Surface contentClassName="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusField
          state={outcome.ok ? "approved" : "rejected"}
          label={outcome.ok ? `${run.target.label} · ${run.environment}` : `Falhou · ${run.target.label} · ${run.environment}`}
        />
        <span className="text-sm opacity-70">
          {formatMs(outcome.elapsed)}
          {tokens && tokens.calls > 0 ? ` · ${tokens.calls} chamadas · ${tokens.input}/${tokens.output} tokens` : ""}
        </span>
      </div>
      <p className="text-sm opacity-70">{run.summary}</p>
      {!outcome.ok && <p className="text-sm text-red-700">{outcome.message}</p>}
      {answer && <p className="whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-sm">{answer}</p>}
      {rest && Object.keys(rest).length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Resposta completa</summary>
          <Json value={rest} />
        </details>
      )}
      {debug?.truncated && (
        <p className="text-xs opacity-70">Conteúdo cortado pelo serviço (limite de tamanho). Prompts e entradas longas aparecem resumidos.</p>
      )}
      {debug && debug.nodes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Passos do turno</h3>
          {debug.nodes.map((node) => (
            <NodeCard key={`${node.order}-${node.node}`} node={node} />
          ))}
        </div>
      )}
      {debug && debug.nodes.length === 0 && outcome.ok && <p className="text-xs opacity-70">O serviço não registrou passos neste turno.</p>}
    </Surface>
  );
}

export default function AiFlowPage() {
  const [targetId, setTargetId] = useState(aiTargets[0].id);
  const [environment, setEnvironment] = useState<EnvId>("QA");
  const [persona, setPersona] = useState("demandante");
  const [conversationId, setConversationId] = useState(newConversationId);
  const [message, setMessage] = useState("");
  const [nr10, setNr10] = useState("");
  const [nr35, setNr35] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [purpose, setPurpose] = useState<string>("product");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => () => controller.current?.abort(), []);

  const target = targetById(targetId) ?? aiTargets[0];
  const url = baseUrl(target, environment);
  const ready =
    target.kind === "chat"
      ? message.trim().length > 0 && conversationId.trim().length > 0
      : target.kind === "certificates"
        ? nr10.trim().length > 0 && nr35.trim().length > 0
        : target.kind === "cnpj"
          ? cnpj.trim().length > 0
          : file !== null;

  function buildInput(): { input: DebugInput; summary: string } | null {
    switch (target.kind) {
      case "chat":
        return {
          input: { kind: "chat", conversationId: conversationId.trim(), message: message.trim(), persona: target.personas ? persona : undefined },
          summary: message.trim(),
        };
      case "certificates":
        return { input: { kind: "certificates", nr10Url: nr10.trim(), nr35Url: nr35.trim() }, summary: "NR-10 e NR-35" };
      case "cnpj":
        return { input: { kind: "cnpj", cnpj: cnpj.trim() }, summary: cnpj.trim() };
      case "image":
        return file ? { input: { kind: "image", file, purpose }, summary: `${file.name} (${purpose})` } : null;
    }
  }

  async function execute() {
    const built = buildInput();
    if (!built || running) return;
    const current = new AbortController();
    controller.current = current;
    setRunning(true);
    const outcome = await runDebug(target, environment, built.input, current.signal);
    if (current.signal.aborted) return;
    setRunning(false);
    setRuns((previous) => [{ id: ++counter.current, target, environment, summary: built.summary, outcome }, ...previous]);
    if (target.kind === "chat" && outcome.ok) setMessage("");
  }

  return (
    <OperationalPage title="Fluxo de IA" description="Executa um turno pela rota de debug do serviço e mostra o que cada passo recebeu e devolveu.">
      <div className="flex flex-col gap-4">
        <Surface contentClassName="flex flex-col gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serviço">
              <Select
                name="Serviço"
                options={aiTargets.map((item) => [item.label, item.id] as const)}
                value={targetId}
                onChange={(value) => value && setTargetId(value)}
              />
            </Field>
            <Field label="Ambiente">
              <Select
                name="Ambiente"
                options={environments.map((item) => [item.label, item.id] as const)}
                value={environment}
                onChange={(value) => value && setEnvironment(value)}
              />
            </Field>
          </div>
          <p className="text-xs opacity-70">
            {target.description} {url ? `Destino: ${url}${target.path}` : "Sem URL configurada para este ambiente."}
          </p>
          {environment === "PROD" && (
            <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900" role="alert">
              PROD: o serviço consulta dados reais. Nada é salvo no histórico e, no operacional, ações de escrita ficam simuladas.
            </p>
          )}

          {target.kind === "chat" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Conversa de teste">
                  <Input name="Conversa de teste" className="w-full" value={conversationId} onChange={(event) => setConversationId(event.target.value)} />
                </Field>
                {target.personas && (
                  <Field label="Persona">
                    <Select
                      name="Persona"
                      options={target.personas.map((item) => [item, item] as const)}
                      value={persona}
                      onChange={(value) => value && setPersona(value)}
                    />
                  </Field>
                )}
              </div>
              <Field label="Mensagem">
                <Textarea
                  name="Mensagem"
                  placeholder="Preciso de um instalador em SP"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  className="w-full"
                />
              </Field>
            </>
          )}
          {target.kind === "certificates" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="URL da imagem do NR-10">
                <Input name="URL NR-10" type="url" value={nr10} onChange={(event) => setNr10(event.target.value)} />
              </Field>
              <Field label="URL da imagem do NR-35">
                <Input name="URL NR-35" type="url" value={nr35} onChange={(event) => setNr35(event.target.value)} />
              </Field>
            </div>
          )}
          {target.kind === "cnpj" && (
            <Field label="CNPJ">
              <Input name="CNPJ" placeholder="12.345.678/0001-90" value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
            </Field>
          )}
          {target.kind === "image" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Imagem">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Imagem"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Finalidade">
                <Select
                  name="Finalidade"
                  options={imagePurposes.map(([label, value]) => [label, value] as const)}
                  value={purpose}
                  onChange={(value) => value && setPurpose(value)}
                />
              </Field>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <PrimaryButton
              description="Executar o turno pela rota de debug"
              content={running ? "Executando…" : "Executar"}
              disabled={!ready || running || !url}
              action={execute}
            />
            {running && (
              <WhiteButton description="Cancelar a execução" content="Cancelar" action={() => controller.current?.abort()} />
            )}
            {target.kind === "chat" && (
              <WhiteButton
                description="Começar outra conversa de teste"
                content="Nova conversa"
                disabled={running}
                action={() => setConversationId(newConversationId())}
              />
            )}
          </div>
        </Surface>

        {runs.map((run) => (
          <RunCard key={run.id} run={run} />
        ))}
      </div>
    </OperationalPage>
  );
}

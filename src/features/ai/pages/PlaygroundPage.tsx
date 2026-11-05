import { useState } from "react";
import { Link } from "react-router-dom";
import { OperationalPage, StatusField, Surface } from "@solaria.network/web-lib";
import { Notice } from "../components";
import { changedPrompts, draftKey, lastUserMessage, promptParts, type Drafts } from "../custom";
import { nodeConversation } from "../conversation";
import { demoRerun } from "../data/mock";
import { runDebug, type CustomRun, type DebugInput, type DebugOutcome } from "../debug.service";
import { usePlaygroundRun, type PlaygroundRun } from "../playground";
import { NO_REPLAY_REASONS, nodeBlockedReason } from "../replay";
import { StepsView, type NodeEditor } from "../timeline";
import { formatMs, type DebugNode } from "../trace";

const answerOf = (outcome: DebugOutcome) => (outcome.ok && typeof outcome.body.response === "string" ? outcome.body.response : null);
const agentsOf = (outcome: DebugOutcome) =>
  outcome.ok && Array.isArray(outcome.body.specialists_used) ? outcome.body.specialists_used.map(String) : [];

function Steps({ run }: { run: PlaygroundRun }) {
  const { outcome } = run;
  const debug = outcome.debug;
  const [enabled, setEnabled] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [inputDrafts, setInputDrafts] = useState<Record<number, string>>({});
  const [reran, setReran] = useState<Record<number, DebugNode>>({});
  const [next, setNext] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastUser = [...run.messages].reverse().find((message) => message.role === "user")?.text ?? "";
  if (!debug || debug.nodes.length === 0) return <p className="text-sm opacity-70">O serviço não registrou passos neste turno.</p>;

  function inputFor(node: string, occurrence: number, prompts: CustomRun["prompts"], extra: Pick<CustomRun, "userMessage" | "state"> = {}): DebugInput | null {
    const replay = run.replay;
    if (!replay) return null;
    switch (replay.kind) {
      case "chat":
        return {
          kind: "chat",
          conversationId: run.conversationId,
          message: lastUser,
          persona: replay.persona,
          custom: { turn: replay.turn, node, occurrence, prompts, ...extra },
        };
      case "certificates":
        return {
          kind: "certificates",
          nr10Url: replay.nr10Url,
          nr35Url: replay.nr35Url,
          custom: { runId: replay.runId, node, occurrence, prompts, ...extra },
        };
      case "cnpj":
        return { kind: "cnpj", cnpj: replay.cnpj, custom: { node, occurrence: 0, prompts, ...extra } };
      case "image":
        return { kind: "image-stage", custom: { runId: replay.runId, node, occurrence, prompts, ...extra } };
    }
  }

  async function runNode(nodeIndex: number) {
    const original = debug?.nodes[nodeIndex];
    if (!original || busy) return;
    const prompts = changedPrompts(original, nodeIndex, drafts);
    const shown = lastUserMessage(nodeConversation(original.input, run.messages).messages);
    const draft = inputDrafts[nodeIndex];
    if (draft !== undefined && draft.trim() === "") {
      setError("A mensagem do usuário não pode ficar vazia.");
      return;
    }
    const edits = { userMessage: draft !== undefined && shown && draft !== shown.text ? draft : undefined, state: undefined };
    const occurrence = debug?.nodes.slice(0, nodeIndex).filter((item) => item.node === original.node).length ?? 0;
    setBusy(true);
    setError("");
    let result: DebugNode | null = null;
    let following: string[] | undefined;
    const extraReran: Record<number, DebugNode> = {};
    const input = run.demo ? null : inputFor(original.node, occurrence, prompts, { userMessage: edits.userMessage, state: edits.state });
    if (run.demo) {
      result = demoRerun(original, prompts);
    } else if (!input) {
      setError(run.replayReason ?? NO_REPLAY_REASONS.oldService);
    } else {
      const response = await runDebug(run.target, run.environment, input, undefined, run.localUrl);
      if (!response.ok) setError(response.message);
      else {
        const custom = response.debug?.custom as
          | { node?: unknown; stopped?: unknown; overrides_applied?: unknown; next?: unknown }
          | undefined;
        // O serviço devolve o nó e os sub-passos dele (ex.: "model" dentro de um agente).
        const only = response.debug?.nodes ?? [];
        if (custom?.node === original.node && custom.stopped === true && only[0]?.node === original.node) {
          result = only[0];
          // Sub-passos seguem logo depois do nó no trace original: cada um substitui o da mesma posição.
          only.slice(1).forEach((sub, offset) => {
            if (debug?.nodes[nodeIndex + 1 + offset]?.node === sub.node) extraReran[nodeIndex + 1 + offset] = sub;
          });
          if (Array.isArray(custom.next)) following = custom.next.map(String);
          if (prompts.length > 0 && custom.overrides_applied === 0)
            setError("O nó rodou, mas o serviço não encontrou onde aplicar o prompt editado (o prompt desta execução é outro).");
        } else
          setError(
            "O serviço não confirmou a execução só deste nó (debug.custom ausente). Ele ainda não suporta execução personalizada, então nada foi alterado.",
          );
      }
    }
    setBusy(false);
    if (result) {
      setReran((previous) => ({ ...previous, [nodeIndex]: result, ...extraReran }));
      setNext((previous) => ({ ...previous, [nodeIndex]: following ?? [] }));
    }
  }

  const available = run.demo || run.replay !== undefined;
  const editor: NodeEditor = {
        enabled,
        demo: run.demo,
        unavailable: available ? undefined : (run.replayReason ?? NO_REPLAY_REASONS.oldService),
        blockedReason: (node) => nodeBlockedReason(run.replay, node),
        onToggle: setEnabled,
        busy,
        drafts,
        reran,
        next,
        error,
        onDraft: (nodeIndex, callIndex, partIndex, value, originalParts) =>
          setDrafts((previous) => {
            const result = { ...previous };
            const edit = (call: number, parts: string[]) => {
              const key = draftKey(nodeIndex, call);
              const next = [...(result[key] ?? parts)];
              next[partIndex] = value;
              result[key] = next;
            };
            edit(callIndex, originalParts);
            const calls = debug?.nodes[nodeIndex]?.llm_calls ?? [];
            calls.forEach((call, other) => {
              const parts = promptParts(call.prompt);
              if (other !== callIndex && parts?.[partIndex]?.type === "system" && parts[partIndex].content === originalParts[partIndex])
                edit(
                  other,
                  parts.map((part) => part.content),
                );
            });
            return result;
          }),
        inputDrafts,
        onInputDraft: (nodeIndex, value) => setInputDrafts((previous) => ({ ...previous, [nodeIndex]: value })),
        onRun: runNode,
        onReset: (nodeIndex) => {
          setError("");
          setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${nodeIndex}:`))));
          setInputDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => Number(key) !== nodeIndex)));
          setReran((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => Number(key) !== nodeIndex)));
          setNext((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => Number(key) !== nodeIndex)));
        },
      };

  return (
    <div className="flex flex-col gap-4">
      <StepsView debug={debug} userMessage={lastUser} answer={answerOf(outcome)} agents={agentsOf(outcome)} editor={editor} history={run.messages} />
    </div>
  );
}

export default function PlaygroundPage() {
  const run = usePlaygroundRun();
  if (!run)
    return (
      <OperationalPage title="Playground" description="Passo a passo de um turno: o que cada nó recebeu, decidiu e devolveu.">
        <Notice>
          Nenhum turno para mostrar ainda. Abra uma conversa em <Link className="font-semibold underline" to="/ia/conversas">Conversas</Link> (ou o
          Session ID no <Link className="font-semibold underline" to="/ia/simulador">Simulador</Link>) e clique em "Playground Debug" na resposta.
        </Notice>
      </OperationalPage>
    );
  const { outcome } = run;
  return (
    <OperationalPage
      title="Playground"
      description={
        <Link className="text-sm underline" to={run.back?.to ?? "/ia/conversas"}>
          {run.back?.label ?? "Voltar para conversas"}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {run.demo && <Notice>Dados de exemplo (modo mock). Nada aqui vem dos serviços.</Notice>}
        <Surface contentClassName="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <StatusField state={outcome.ok ? "approved" : "rejected"} label={outcome.ok ? "Executado" : "Falhou"} />
          <span className="text-sm font-semibold">{run.target.label}</span>
          <span className="text-sm opacity-70">{run.environment}{run.localUrl ? ` · ${run.localUrl}` : ""}</span>
          <span className="text-sm opacity-70">Session ID: {run.conversationId}</span>
          <span className="text-sm opacity-70">{formatMs(outcome.elapsed)}</span>
        </Surface>
        {!outcome.ok && <Notice tone="error">{outcome.message}</Notice>}
        <Surface contentClassName="p-4">
          <Steps key={`${run.conversationId}-${run.messages.length}`} run={run} />
        </Surface>
      </div>
    </OperationalPage>
  );
}

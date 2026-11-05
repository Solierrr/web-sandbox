import { useState } from "react";
import { Checkbox, PrimaryButton, Textarea, WhiteButton } from "@solaria.network/web-lib";
import { Field, Json, Notice } from "./components";
import { nodeConversation, type NodeConversation } from "./conversation";
import { draftKey, editableMessageIndexes, isEditable, promptParts, type Drafts } from "./custom";
import type { PlaygroundMessage } from "./playground";
import {
  formatMs,
  nodeModels,
  nodeTokens,
  toolCallsOf,
  toolsOf,
  toolUsage,
  totalTokens,
  turnToolCalls,
  type DebugInfo,
  type DebugNode,
} from "./trace";

const clock = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

export interface NodeEditor {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  busy: boolean;
  drafts: Drafts;
  reran: Record<number, DebugNode>;
  next?: Record<number, string[]>;
  unavailable?: string;
  blockedReason?: (node: string) => string | undefined;
  error: string;
  demo?: boolean;
  onDraft: (nodeIndex: number, callIndex: number, partIndex: number, value: string, original: string[]) => void;
  inputDrafts?: Record<number, Record<number, string>>;
  onInputDraft?: (nodeIndex: number, messageIndex: number, value: string) => void;
  onRun: (nodeIndex: number) => void;
  onReset: (nodeIndex: number) => void;
}

interface StepsProps {
  editor?: NodeEditor;
  history?: PlaygroundMessage[];
  debug: DebugInfo;
  userMessage: string;
  answer: string | null;
  agents: string[];
}

export function StepsView({ debug, userMessage, answer, agents, editor, history = [] }: StepsProps) {
  const last = debug.nodes.length;
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, last);
  const rerun = editor?.reran[index];
  const node: DebugNode | undefined = rerun ?? debug.nodes[index];
  const conversation = node ? nodeConversation(node.input, history) : { summary: null, messages: [] };
  const { indexes: editableIndexes, lastIndex } = editableMessageIndexes(node?.input, conversation.messages, conversation.summary !== null);
  const messageEditor: MessageEditor | undefined =
    node && editor?.enabled && !rerun && editor.onInputDraft && !editor.unavailable && !editor.blockedReason?.(node.node) && editableIndexes.length > 0
      ? {
          indexes: new Set(editableIndexes),
          lastIndex,
          drafts: editor.inputDrafts?.[index],
          onChange: (messageIndex, value) => editor.onInputDraft?.(index, messageIndex, value),
        }
      : undefined;
  // As mensagens da conversa já aparecem (editáveis) em cima; no prompt elas só repetiriam o mesmo texto.
  const conversationTexts = new Set(conversation.messages.map((message) => message.text.trim()));
  const total = totalTokens(debug);
  const turnTools = [
    ...turnToolCalls(debug)
      .reduce((groups, call) => groups.set(call.name, (groups.get(call.name) ?? 0) + 1), new Map<string, number>())
      .entries(),
  ];
  const totalMs = debug.duration_ms ?? debug.nodes.reduce((sum, item) => sum + (item.duration_ms ?? 0), 0);

  const dot = (active: boolean, error = false) => (
    <span
      className={`z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${error ? "border-red-600" : "border-[#FF6500]"} ${active ? (error ? "bg-red-600" : "bg-[#FF6500]") : "bg-white"}`}
      aria-hidden
    />
  );
  const rowClass = (active: boolean) =>
    `relative flex w-full cursor-pointer gap-3 rounded-lg border-0 p-2 text-left ${active ? "bg-[#FF6500]/10" : "bg-transparent"}`;

  return (
    <div className="flex flex-wrap gap-4">
      <ol className="m-0 flex min-w-[240px] flex-1 list-none flex-col p-0" style={{ flexBasis: "280px" }} aria-label="Passos do turno">
        {debug.nodes.map((item, position) => {
          const tokens = nodeTokens(item);
          const active = position === index;
          return (
            <li key={`${item.order}-${item.node}`} className="relative">
              <span className="absolute left-[15px] top-6 h-full w-px bg-black/20" aria-hidden />
              <button type="button" className={rowClass(active)} aria-current={active ? "step" : undefined} onClick={() => setSelected(position)}>
                {dot(active, item.status === "error")}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="break-words text-xs font-bold uppercase tracking-wide">{item.node}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs opacity-80">
                    {item.started_at && <span className="rounded bg-black/5 px-1.5 py-0.5">{clock(item.started_at)}</span>}
                    <span className="rounded bg-black/5 px-1.5 py-0.5">{formatMs(item.duration_ms)}</span>
                    {nodeModels(item).length > 0 && <span className="rounded bg-black/5 px-1.5 py-0.5">{nodeModels(item).join(", ")}</span>}
                    {item.llm_calls.length > 0 && (
                      <span className="rounded bg-[#FF6500]/15 px-1.5 py-0.5" title="Tokens de entrada/saída">
                        {tokens.input}/{tokens.output} tokens
                      </span>
                    )}
                    {toolCallsOf(item).length > 0 && (
                      <span className="rounded bg-[#FF6500]/15 px-1.5 py-0.5" title="Tools chamadas neste passo">
                        {toolCallsOf(item).length} tool{toolCallsOf(item).length > 1 ? "s" : ""}
                      </span>
                    )}
                    {item.status === "error" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">erro</span>}
                    {editor?.reran[position] && <span className="rounded bg-[#FF6500]/15 px-1.5 py-0.5">reexecutado</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li className="relative">
          <button type="button" className={rowClass(index === last)} aria-current={index === last ? "step" : undefined} onClick={() => setSelected(last)}>
            {dot(index === last)}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide">Resposta final</span>
              <span className="text-xs opacity-80">{formatMs(totalMs)} no total</span>
            </span>
          </button>
        </li>
      </ol>

      <div className="flex min-w-[260px] flex-col gap-3" style={{ flex: "2 1 360px" }}>
        {node ? (
          <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-3">
            <span className="text-sm font-bold uppercase tracking-wide">
              {node.order}. {node.node}
            </span>
            <p className="text-xs opacity-70">
              {formatMs(node.duration_ms)}
              {nodeModels(node).length > 0 ? ` · modelo ${nodeModels(node).join(", ")}` : ""}
              {node.llm_calls.length > 0 ? ` · ${node.llm_calls.length} chamada${node.llm_calls.length > 1 ? "s" : ""} de LLM` : " · sem chamada de LLM"}
            </p>
            {node.error && <p className="text-sm text-red-700">{node.error}</p>}
            {rerun && (
              <Notice>
                Só este nó foi executado, com a entrada gravada dos nós anteriores, e a execução parou aqui. Os nós seguintes continuam com o resultado
                original da conversa.
                {editor?.next?.[index] !== undefined &&
                  (editor.next[index].length > 0 ? ` O próximo nó seria: ${editor.next[index].join(", ")}.` : " Este era o último nó.")}
              </Notice>
            )}
            <ConversationView conversation={conversation} editable={messageEditor} />
            <Field label="Entrada">
              <Json value={node.input} />
            </Field>
            <ToolsView node={node} />
            {node.llm_calls.map((call, callIndex) => (
              <div key={callIndex} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
                <p className="text-xs opacity-70">
                  Chamada de LLM {callIndex + 1} · {call.model ?? "modelo n/d"} · {formatMs(call.latency_ms)} · {call.tokens_in ?? "-"}/{call.tokens_out ?? "-"} tokens
                </p>
                {call.error && <p className="text-sm text-red-700">{call.error}</p>}
                {editor?.enabled && promptParts(call.prompt) && (call.prompt_complete === true || editor.demo) ? (
                  <PromptEditor editor={editor} nodeIndex={index} callIndex={callIndex} prompt={call.prompt} hideTexts={conversationTexts} />
                ) : (
                  <Field label="Prompt">
                    <Json value={call.prompt} />
                    {editor?.enabled && call.prompt === null && !editor.unavailable && (
                      <span className="text-xs opacity-70">
                        O histórico não guarda o prompt. Use "Executar" para o serviço reexecutar só este nó e trazer o prompt para editar.
                      </span>
                    )}
                    {editor?.enabled && promptParts(call.prompt) && (
                      <span className="text-xs opacity-70">
                        Este prompt veio com dado pessoal mascarado pelo serviço, então não dá para editar nem reenviar.
                      </span>
                    )}
                  </Field>
                )}
                <Field label="Resposta do modelo">
                  <Json value={call.completion} />
                </Field>
              </div>
            ))}
            <Field label="Saída do passo">
              <Json value={node.output} />
            </Field>
            {editor && (editor.unavailable || editor.blockedReason?.(node.node)) && (
              <p className="border-t border-black/10 pt-3 text-xs opacity-70">
                Execução personalizada indisponível: {editor.unavailable ?? editor.blockedReason?.(node.node)}
              </p>
            )}
            {editor && !editor.unavailable && !editor.blockedReason?.(node.node) && (
              <div className="flex flex-col gap-3 border-t border-black/10 pt-3">
                <Checkbox label="Ativar execução personalizada?" checked={editor.enabled} onChange={(event) => editor.onToggle(event.target.checked)} />
                {editor.enabled && (
                  <>
                    <p className="text-xs opacity-70">
                      Edite a mensagem do usuário e os prompts acima (system, human e ai) e use "Executar": o serviço roda apenas este nó, com o que os nós anteriores
                      já produziram, e para nele, sem passar para o próximo. A saída do nó e a escolha de qual tool chamar continuam sendo do serviço.
                    </p>
                    {editor.error && <Notice tone="error">{editor.error}</Notice>}
                    <div className="flex flex-wrap gap-3">
                      <PrimaryButton
                        description={`Executar apenas o nó ${node.node}`}
                        content={editor.busy ? "Executando…" : "Executar"}
                        disabled={editor.busy}
                        action={() => editor.onRun(index)}
                      />
                      {(rerun || editor.inputDrafts?.[index] !== undefined || Object.keys(editor.drafts).some((key) => key.startsWith(`${index}:`))) && (
                        <WhiteButton description="Voltar ao prompt e ao resultado originais" content="Restaurar original" disabled={editor.busy} action={() => editor.onReset(index)} />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {userMessage && (
              <p className="whitespace-pre-wrap rounded-lg border-l-4 border-[#FF6500] bg-black/5 px-3 py-2 text-sm">{userMessage}</p>
            )}
            <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
              <span className="text-sm font-bold uppercase tracking-wide">Resposta final</span>
              <p className="text-sm">Agente selecionado: {agents.length ? agents.join(", ") : "Nenhum agente selecionado"}</p>
              {turnTools.length > 0 && (
                <p className="text-sm">
                  Tools utilizadas: {turnTools.map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ")}
                </p>
              )}
              {answer ? <p className="whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-sm">{answer}</p> : <p className="text-sm opacity-70">Sem resposta final neste turno.</p>}
              <p className="text-xs opacity-70">
                {formatMs(totalMs)} no total · {total.calls} chamada{total.calls === 1 ? "" : "s"} de LLM · {total.input}/{total.output} tokens
                {debug.truncated ? " · conteúdo cortado pelo serviço" : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PromptEditor({
  editor,
  nodeIndex,
  callIndex,
  prompt,
  hideTexts,
}: {
  editor: NodeEditor;
  nodeIndex: number;
  callIndex: number;
  prompt: unknown;
  hideTexts: Set<string>;
}) {
  const parts = promptParts(prompt) ?? [];
  const original = parts.map((part) => part.content);
  const values = editor.drafts[draftKey(nodeIndex, callIndex)] ?? original;
  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, partIndex) =>
        (part.type === "human" || part.type === "ai") && part.editable === undefined && hideTexts.has(part.content.trim()) ? null : isEditable(part) ? (
          <Field key={partIndex} label={`Prompt · ${part.type}`}>
            <Textarea
              name={`Prompt ${part.type} do nó ${nodeIndex + 1}`}
              className="w-full"
              rows={Math.min(14, Math.max(4, values[partIndex]?.split("\n").length ?? 4))}
              value={values[partIndex] ?? ""}
              onChange={(event) => editor.onDraft(nodeIndex, callIndex, partIndex, event.target.value, original)}
            />
          </Field>
        ) : (
          <Field key={partIndex} label={`Prompt · ${part.type} (não editável)`}>
            <Json value={part.content} />
          </Field>
        ),
      )}
    </div>
  );
}

interface MessageEditor {
  indexes: Set<number>;
  lastIndex: number | null;
  drafts: Record<number, string> | undefined;
  onChange: (messageIndex: number, value: string) => void;
}

function ConversationView({ conversation, editable }: { conversation: NodeConversation; editable?: MessageEditor }) {
  if (!conversation.summary && conversation.messages.length === 0) return null;
  return (
    <Field label={conversation.summary ? "Conversa (resumida)" : "Conversa"}>
      <div className="flex flex-col gap-2">
        {conversation.summary && (
          <div className="flex flex-col gap-1 rounded-lg border border-black/10 p-3">
            <span className="text-xs font-bold uppercase tracking-wide">Resumo da conversa</span>
            <p className="m-0 whitespace-pre-wrap text-sm">{conversation.summary}</p>
          </div>
        )}
        {conversation.messages.map((message, position) =>
          editable?.indexes.has(position) ? (
            <div
              key={position}
              className={`flex flex-col gap-1 rounded-lg bg-black/5 px-3 py-2 ${message.role === "user" ? "border-l-4 border-[#FF6500]" : ""}`}
            >
              <span className="block text-xs font-bold uppercase tracking-wide opacity-70">
                {message.role === "user" ? "Usuário" : "Assistente"} (editável)
              </span>
              <Textarea
                name={
                  message.role === "user" && position === editable.lastIndex
                    ? "Mensagem do usuário do nó"
                    : `Mensagem ${position + 1} (${message.role === "user" ? "usuário" : "assistente"}) do nó`
                }
                className="w-full"
                rows={Math.min(10, Math.max(2, (editable.drafts?.[position] ?? message.text).split("\n").length))}
                value={editable.drafts?.[position] ?? message.text}
                onChange={(event) => editable.onChange(position, event.target.value)}
              />
            </div>
          ) : (
          <p
            key={position}
            className={`m-0 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "border-l-4 border-[#FF6500] bg-black/5" : "bg-black/5"}`}
          >
            <span className="block text-xs font-bold uppercase tracking-wide opacity-70">{message.role === "user" ? "Usuário" : "Assistente"}</span>
            {message.text}
          </p>
          ),
        )}
      </div>
    </Field>
  );
}

function ToolsView({ node }: { node: DebugNode }) {
  const tools = toolsOf(node);
  const calls = toolCallsOf(node);
  if (tools.length === 0 && calls.length === 0) return null;
  const usage = toolUsage(node);
  return (
    <Field label="Tools">
      <div className="flex flex-col gap-3">
        {tools.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs opacity-70">Tools que este agente pode chamar ({tools.length})</span>
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Tools disponíveis">
              {tools.map((tool) => {
                const times = usage.get(tool.name) ?? 0;
                return (
                  <li key={tool.name} className="flex flex-col gap-0.5 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-semibold">{tool.name}</code>
                      {times > 0 ? (
                        <span className="rounded bg-[#FF6500]/15 px-1.5 py-0.5 text-xs">utilizada{times > 1 ? ` ×${times}` : ""}</span>
                      ) : (
                        <span className="text-xs opacity-60">não utilizada neste passo</span>
                      )}
                    </span>
                    {tool.description && <span className="text-xs opacity-70">{tool.description}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {calls.map((call, position) => (
          <div key={position} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
            <p className="m-0 text-xs opacity-70">
              Tool call {position + 1} · <code>{call.name}</code> · {formatMs(call.duration_ms)} · {call.status === "ok" ? "ok" : "erro"}
            </p>
            {call.error && <p className="m-0 text-sm text-red-700">{call.error}</p>}
            {call.input !== null && call.input !== undefined && (
              <Field label="Entrada da tool">
                <Json value={call.input} />
              </Field>
            )}
            {call.output !== null && call.output !== undefined && (
              <Field label="Saída da tool">
                <Json value={call.output} />
              </Field>
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}

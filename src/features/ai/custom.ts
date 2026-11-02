import type { CustomRun } from "./debug.service";
import type { DebugNode } from "./trace";

export interface PromptPart {
  type: string;
  content: string;
  editable?: boolean;
}

export type Drafts = Record<string, string[]>;
export const draftKey = (nodeIndex: number, callIndex: number) => `${nodeIndex}:${callIndex}`;

export function promptParts(prompt: unknown): PromptPart[] | null {
  if (typeof prompt === "string") return [{ type: "prompt", content: prompt }];
  if (!Array.isArray(prompt) || prompt.length === 0) return null;
  const parts: PromptPart[] = [];
  for (const item of prompt) {
    if (!item || typeof item !== "object" || typeof (item as { content?: unknown }).content !== "string") return null;
    const { type, content, editable } = item as { type?: unknown; content: string; editable?: unknown };
    parts.push({
      type: typeof type === "string" ? type : "message",
      content,
      ...(typeof editable === "boolean" ? { editable } : {}),
    });
  }
  return parts;
}

export const isEditable = (part: PromptPart) => part.editable ?? part.type === "system";

export function rebuildPrompt(original: unknown, contents: string[]): PromptPart[] {
  const parts = promptParts(original) ?? [];
  return parts.map((part, index) => ({
    type: part.type,
    content: contents[index] ?? part.content,
    ...(part.editable === undefined ? {} : { editable: part.editable }),
  }));
}

export function changedPrompts(node: DebugNode, nodeIndex: number, drafts: Drafts): CustomRun["prompts"] {
  const result: CustomRun["prompts"] = [];
  node.llm_calls.forEach((call, callIndex) => {
    const draft = drafts[draftKey(nodeIndex, callIndex)];
    const parts = promptParts(call.prompt);
    if (!draft || !parts || typeof call.prompt === "string") return;
    if (parts.some((part, index) => isEditable(part) && (draft[index] ?? part.content) !== part.content)) {
      result.push({ call: callIndex, prompt: rebuildPrompt(call.prompt, draft) });
    }
  });
  return result;
}

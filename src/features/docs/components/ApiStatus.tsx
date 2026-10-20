import type { LoadState } from "../openapi.service";

const label = {
  loading: "Carregando…",
  ready: "No ar",
  error: "Indisponível",
} as const;

const tone = {
  loading: "bg-operational-hover text-operational-muted",
  ready: "bg-feedback-success/10 text-feedback-success",
  error: "bg-feedback-error/10 text-feedback-error",
} as const;

export default function ApiStatus({ state }: { state: LoadState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone[state.status]}`}
    >
      {label[state.status]}
    </span>
  );
}

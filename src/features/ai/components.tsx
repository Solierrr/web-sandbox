import { useState, type ReactNode } from "react";
import { Input, PrimaryButton, Select, Surface, WhiteButton } from "@solaria.network/web-lib";
import { resetFilters, setFilters, useFilters, type AiFilters } from "./filters";
import { aiTargets, environments, type AiTarget, type EnvId } from "./targets";
import { formatJson } from "./trace";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
      {children}
    </div>
  );
}

export function Json({ value }: { value: unknown }) {
  const text = formatJson(value);
  if (!text) return null;
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/5 p-3 text-xs">{text}</pre>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const palette = {
    info: "bg-black/5",
    warning: "bg-amber-100 text-amber-900",
    error: "bg-red-100 text-red-800",
  }[tone];
  return (
    <p className={`rounded-lg p-3 text-sm ${palette}`} role={tone === "info" ? "status" : "alert"}>
      {children}
    </p>
  );
}

interface FilterBarProps {
  targets?: readonly AiTarget[];
  allowAll?: boolean;
  period?: boolean;
  children?: ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  deferred?: boolean;
}

export function FilterBar({
  targets = aiTargets,
  allowAll = false,
  period = true,
  children,
  onSubmit,
  submitLabel,
  deferred = false,
}: FilterBarProps) {
  const applied = useFilters();
  const [edits, setEdits] = useState<Partial<AiFilters>>({});
  const filters = deferred ? { ...applied, ...edits } : applied;
  const change = (patch: Partial<AiFilters>) => (deferred ? setEdits((current) => ({ ...current, ...patch })) : setFilters(patch));
  const submit = () => {
    if (deferred) {
      setFilters(edits);
      setEdits({});
    }
    onSubmit?.();
  };
  const clear = () => {
    setEdits({});
    resetFilters();
  };
  const options: (readonly [string, string])[] = [
    ...(allowAll ? ([["Todos", ""]] as const) : []),
    ...targets.map((target) => [target.label, target.id] as const),
  ];
  const assistant = allowAll || targets.some((target) => target.id === filters.assistant) ? filters.assistant : targets[0]?.id ?? "";
  return (
    <Surface contentClassName="flex flex-col gap-4 overflow-visible! p-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Field label="Ambiente">
          <Select
            name="Ambiente"
            options={environments.map((item) => [item.label, item.id] as const)}
            value={filters.environment}
            onChange={(value) => value && change({ environment: value as EnvId })}
          />
        </Field>
        <Field label="Assistente">
          <Select name="Assistente" options={options} value={assistant} onChange={(value) => change({ assistant: value ?? "" })} />
        </Field>
        {period && (
          <>
            <Field label="Data inicial">
              <Input name="Data inicial" type="date" className="w-full" value={filters.from} onChange={(event) => change({ from: event.target.value })} />
            </Field>
            <Field label="Data final">
              <Input name="Data final" type="date" className="w-full" value={filters.to} onChange={(event) => change({ to: event.target.value })} />
            </Field>
          </>
        )}
      </div>
      {children}
      {(onSubmit || deferred || period) && (
        <div className="flex flex-wrap gap-3">
          {(onSubmit || deferred) && <PrimaryButton description={submitLabel ?? "Aplicar filtros"} content={submitLabel ?? "Aplicar"} action={submit} />}
          <WhiteButton description="Limpar os filtros" content="Limpar" action={clear} />
        </div>
      )}
    </Surface>
  );
}

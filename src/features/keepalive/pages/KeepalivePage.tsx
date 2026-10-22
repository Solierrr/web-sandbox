import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Checkbox,
  OperationalPage,
  PrimaryButton,
  StatusField,
  Surface,
  ToolbarAction,
  WhiteButton,
  notify,
} from "@solaria.network/web-lib";
import { keepaliveSets, targets } from "../../../config/keepalive";
import { formatDuration, wake } from "../keepalive.service";

type StatusFieldState = ComponentProps<typeof StatusField>["state"];

type Status =
  | { state: "idle" }
  | { state: "waking" }
  | { state: "awake"; duration: number }
  | { state: "failed"; duration: number };

const badge = (status: Status): { state: StatusFieldState; label: string } => {
  switch (status.state) {
    case "waking":
      return { state: "pending", label: "Acordando…" };
    case "awake":
      return { state: "approved", label: `Respondeu · ${formatDuration(status.duration)}` };
    case "failed":
      return { state: "rejected", label: "Sem resposta" };
    default:
      return { state: "cancelled", label: "Não verificado" };
  }
};

export default function KeepalivePage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const controller = useRef<AbortController | null>(null);
  const running = useRef(new Set<string>());

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);

  async function wakeMany(ids: string[]) {
    const pending = ids.filter((id) => !running.current.has(id));
    if (!pending.length) return;
    for (const id of pending) running.current.add(id);
    setStatuses((current) => ({
      ...current,
      ...Object.fromEntries(pending.map((id) => [id, { state: "waking" } as Status])),
    }));
    const results = await Promise.all(
      pending.map(async (id) => {
        const target = targets.find((item) => item.id === id);
        const result = target
          ? await wake(target.url, controller.current?.signal)
          : { ok: false, duration: 0 };
        running.current.delete(id);
        setStatuses((current) => ({
          ...current,
          [id]: result.ok
            ? { state: "awake", duration: result.duration }
            : { state: "failed", duration: result.duration },
        }));
        return result.ok;
      }),
    );
    if (controller.current?.signal.aborted) return;
    const awake = results.filter(Boolean).length;
    notify(
      pending.length === 1
        ? awake
          ? `${pending[0]} respondeu.`
          : `${pending[0]} não respondeu.`
        : `${awake} de ${pending.length} serviços responderam.`,
    );
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = selected.size === targets.length;

  return (
    <OperationalPage
      title="Keepalive"
      description="Acorde os serviços de QA no Render (plano free) antes de testar."
      centered
      sideBackground
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pb-10">
        <section aria-label="Conjuntos" className="flex flex-wrap items-center justify-center gap-3">
          {keepaliveSets.map((set) => (
            <WhiteButton
              key={set.id}
              content={`${set.label} (${set.ids.length})`}
              description={`Acordar o conjunto ${set.label}`}
              onClick={() => void wakeMany(set.ids)}
            />
          ))}
        </section>
        <Surface contentClassName="flex flex-wrap items-center justify-between gap-3 p-4">
          <Checkbox
            label="Selecionar todos"
            checked={allSelected}
            onChange={(event) =>
              setSelected(event.target.checked ? new Set(targets.map((target) => target.id)) : new Set())
            }
          />
          <PrimaryButton
            content={`Acordar selecionados (${selected.size})`}
            description="Acordar os serviços selecionados"
            disabled={selected.size === 0}
            onClick={() => void wakeMany([...selected])}
          />
        </Surface>
        <Surface>
          <ul aria-label="Serviços" className="divide-y divide-operational-border/60">
            {targets.map((target) => {
              const status = statuses[target.id] ?? { state: "idle" };
              const { state, label } = badge(status);
              return (
                <li
                  key={target.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                >
                  <Checkbox
                    label={target.id}
                    checked={selected.has(target.id)}
                    onChange={(event) => toggle(target.id, event.target.checked)}
                    className="min-w-0 flex-1 basis-40"
                  />
                  <span className="flex items-center gap-2">
                    <span role="status">
                      <StatusField state={state} label={label} />
                    </span>
                    <ToolbarAction
                      icon="refresh"
                      label={`Acordar ${target.id}`}
                      disabled={status.state === "waking"}
                      onClick={() => void wakeMany([target.id])}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Surface>
        <p className="text-center text-sm text-gray">
          O Render pode levar até cerca de um minuto para acordar um serviço. A resposta indica que o serviço
          respondeu, não que as rotas estejam saudáveis.
        </p>
      </div>
    </OperationalPage>
  );
}

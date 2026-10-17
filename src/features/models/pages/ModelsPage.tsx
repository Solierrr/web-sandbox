import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Confirmation,
  Input,
  OperationalPage,
  OperationalTable,
  PrimaryButton,
  Select,
  StatusField,
  ToolbarAction,
  WhiteButton,
  notify,
  type OperationalColumn,
} from "@solaria.network/web-lib";
import type { Service } from "../../../config/services";
import { request, type Result } from "../../../lib/shared/http/http.service";
import ResponsePanel from "../../services/components/ResponsePanel";

import {
  parsePanelModels,
  modelInput,
  measurements,
  type Model,
  type ModelInput,
} from "../models.model";

interface BrandOption {
  id: string;
  name: string;
  archived: boolean;
  legacy: boolean;
}
const types = [
  ["Monocristalina", "MONOCRYSTALLINE"],
  ["Policristalina", "POLYCRYSTALLINE"],
  ["Filme fino", "THIN_FILM"],
] as const;
export default function ModelsPage({
  service,
  actions,
}: {
  service: Service;
  actions: ReactNode;
}) {
  const [items, setItems] = useState<Model[] | null>(null);
  const [form, setForm] = useState<Model | "new" | null>(null);
  const [brandId, setBrandId] = useState("");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [type, setType] = useState("MONOCRYSTALLINE");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [pending, setPending] = useState<{
    id?: string;
    body?: ModelInput;
    method: "POST" | "PUT" | "DELETE";
  } | null>(null);
  const load = useCallback(
    () =>
      request(service, "/api/models")
        .then((response) => {
          if (response.status >= 400) {
            setResult(response);
            throw new Error(
              `Não foi possível carregar os modelos (HTTP ${response.status}).`,
            );
          }
          setItems(parsePanelModels(response.body));
        })
        .catch((failure: unknown) => {
          setItems([]);
          setError(
            failure instanceof Error
              ? failure.message
              : "Falha ao carregar modelos.",
          );
        }),
    [service],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!form) return;
    let active = true;
    request(service, "/api/brands")
      .then((response) => {
        if (!active) return;
        if (response.status >= 400 || !Array.isArray(response.body))
          throw new Error("Não foi possível carregar as marcas cadastradas.");
        const entries = response.body as BrandOption[];
        if (
          !entries.every(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string",
          )
        )
          throw new Error("Resposta de marcas inválida.");
        setBrands(entries);
      })
      .catch((failure: unknown) => {
        if (active) {
          setBrands([]);
          setError(
            failure instanceof Error
              ? failure.message
              : "Falha ao carregar marcas.",
          );
        }
      })
      .finally(() => {
        if (active) setBrandsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, service]);
  function open(model: Model | "new") {
    setBrandsLoading(true);
    setBrandId(model === "new" ? "" : (model.brandId ?? ""));
    setType(model === "new" ? "MONOCRYSTALLINE" : model.type);
    setForm(model);
    setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let body: ModelInput;
    try {
      body = modelInput(data, brandId, type);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Dados inválidos.");
      return;
    }
    setPending({
      method: form === "new" ? "POST" : "PUT",
      id: form && form !== "new" ? form.id : undefined,
      body,
    });
  }
  async function mutate() {
    if (!pending || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await request(
        service,
        `/api/models${pending.id ? `/${encodeURIComponent(pending.id)}` : ""}`,
        {
          method: pending.method,
          body: pending.body ? JSON.stringify(pending.body) : undefined,
        },
      );
      setResult(response);
      if (response.status >= 400)
        throw new Error(`Operação não concluída (HTTP ${response.status}).`);
      notify(
        pending.method === "DELETE"
          ? "Modelo excluído."
          : pending.method === "POST"
            ? "Modelo criado."
            : "Modelo atualizado.",
      );
      setForm(null);
      setPending(null);
      await load();
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "Falha ao salvar o modelo.";
      setError(message);
      setPending(null);
      notify(message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function detail(id: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      setResult(
        await request(service, `/api/models/${encodeURIComponent(id)}`),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Falha ao consultar modelo.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const columns: OperationalColumn<Model>[] = [
    { key: "brand", label: "Marca", render: (item) => item.brand },
    { key: "model", label: "Modelo", render: (item) => item.model },
    {
      key: "type",
      label: "Tecnologia",
      render: (item) =>
        types.find(([, value]) => value === item.type)?.[0] || item.type,
    },
    ...measurements.map(({ name, label }) => ({
      key: name,
      label,
      render: (item: Model) => item[name],
    })),
    {
      key: "status",
      label: "Situação",
      render: (item) =>
        item.status === "APPROVED" ? (
          <StatusField state="approved" label="Aprovada" />
        ) : item.status === "REJECTED" ? (
          <StatusField state="rejected" label="Recusada" />
        ) : item.status === "UNDERANALYSIS" ||
          item.status === "UNDER_ANALYSIS" ? (
          <StatusField state="pending" label="Em análise" />
        ) : (
          item.status || "Não informada"
        ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (item) => (
        <div className="flex gap-2">
          <ToolbarAction
            label={`Consultar ${item.model}`}
            icon="eye"
            disabled={busy}
            onClick={() => void detail(item.id)}
          />
          <ToolbarAction
            label={`Editar ${item.model}`}
            icon="edit"
            disabled={busy}
            onClick={() => open(item)}
          />
          <ToolbarAction
            label={`Excluir ${item.model}`}
            icon="trash"
            disabled={busy}
            onClick={() => setPending({ method: "DELETE", id: item.id })}
          />
        </div>
      ),
    },
  ];
  const current = form && form !== "new" ? form : null;
  return (
    <OperationalPage
      title={
        form
          ? form === "new"
            ? "Adicionar modelo"
            : "Editar modelo"
          : "Placas Solares"
      }
      description={
        form
          ? "Cadastre os atributos do modelo no ambiente de QA."
          : "CRUD básico de modelos de placas solares da API-core."
      }
      centered
      sideBackground
      actions={actions}
    >
      {form ? (
        <form
          key={form === "new" ? "new" : form.id}
          onSubmit={submit}
          className="mx-auto flex w-full max-w-lg flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <span>Marca</span>
            <Select
              name="Marca"
              value={brandId}
              onChange={(id) => setBrandId(id ?? "")}
              clearable={false}
              disabled={busy || brandsLoading}
              placeholder={
                brandsLoading
                  ? "Carregando marcas…"
                  : "Escolha uma marca cadastrada"
              }
              options={brands
                .filter(
                  (brand) =>
                    (!brand.archived && !brand.legacy) || brand.id === brandId,
                )
                .map((brand) => [brand.name, brand.id] as const)}
              className="w-full"
            />
          </div>
          <label className="flex flex-col gap-2">
            Modelo
            <Input
              name="model"
              placeholder="Nome do modelo"
              defaultValue={current?.model}
              required
              className="w-full"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span>Tecnologia</span>
            <Select
              name="type"
              options={[...types]}
              value={type}
              onChange={(value) => setType(value || "MONOCRYSTALLINE")}
              clearable={false}
              className="w-full"
            />
          </div>
          {measurements.map(({ name, label }) => (
            <label key={name} className="flex flex-col gap-2">
              {label}
              <Input
                name={name}
                type="number"
                step="any"
                min="0.000001"
                placeholder={label}
                defaultValue={current?.[name]}
                required
                className="w-full"
              />
            </label>
          ))}
          <PrimaryButton
            type="submit"
            description="Salvar modelo no QA"
            content="Salvar modelo"
            disabled={busy || brandsLoading || !brandId}
            className="w-full"
          />
          <WhiteButton
            type="button"
            description="Cancelar cadastro"
            content="Cancelar"
            disabled={busy}
            onClick={() => setForm(null)}
            className="w-full"
          />
        </form>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton
              description="Adicionar modelo"
              content="Adicionar modelo"
              disabled={busy}
              onClick={() => open("new")}
            />
            <WhiteButton
              type="button"
              description="Atualizar tabela"
              content="Atualizar tabela"
              disabled={busy || items === null}
              onClick={() => {
                setError("");
                setItems(null);
                void load();
              }}
            />
          </div>
          <OperationalTable
            label="Modelos de placas solares"
            columns={columns}
            items={items}
            getKey={(item) => item.id}
            empty="Nenhum modelo disponível."
          />
        </>
      )}
      <div className="mx-auto w-full max-w-3xl">
        <ResponsePanel result={result} error={error} busy={busy} />
      </div>
      {pending && (
        <Confirmation
          title={
            pending.method === "DELETE"
              ? "Excluir este modelo?"
              : "Salvar este modelo no QA?"
          }
          message={
            pending.method === "DELETE"
              ? "A exclusão remove o modelo do ambiente de teste e pode afetar seus vínculos."
              : "Esta operação altera os cadastros de teste da API-core."
          }
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void mutate()}
        />
      )}
    </OperationalPage>
  );
}

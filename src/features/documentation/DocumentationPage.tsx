import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loading, OperationalPage, Select, Surface, WhiteButton } from "@solaria.network/web-lib";
import services from "../../../shared/qa-services.json";
import { loadSpec } from "./documentation.service";
import SwaggerPanel from "./SwaggerPanel";
import "./documentation.css";


export default function DocumentationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const service = services.find(item => item.id === id);
  const [result, setResult] = useState<{ id: string; spec?: object; error?: string }>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!service) return;
    const controller = new AbortController();
    void loadSpec(service.id, controller.signal).then(spec => {
      if (!controller.signal.aborted) setResult({ id: service.id, spec });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ id: service.id, error: error instanceof Error ? error.message : "Serviço indisponível." });
    });
    return () => controller.abort();
  }, [service, revision]);
  const current = result?.id === id ? result : undefined;
  return <OperationalPage title="Documentação de QA" description="Teste os serviços com sua conta. A autenticação interna é aplicada pelo servidor." centered sideBackground>
    <div className="mx-auto w-full max-w-sm pb-4">
      <Select name="qa-service" placeholder="Selecione um serviço" value={id} options={services.map(item => item.id)} onChange={value => navigate(value ? `/docs/${value}` : "/docs")} />
    </div>
    {service ? <Surface className="w-full p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <span className="font-semibold">{service.id} · QA</span>
        <div className="flex gap-3"><a href={`https://github.com/Solierrr/${service.id}`} target="_blank" rel="noreferrer" className="self-center text-operational-ink">GitHub</a><WhiteButton content="Atualizar" description="Recarregar documentação do serviço" onClick={() => { setResult(undefined); setRevision(value => value + 1); }} /></div>
      </div>
      {current?.error ? <p role="alert" className="py-8 text-center text-operational-ink">{current.error}</p> : current?.spec ? <SwaggerPanel key={`${id}-${revision}`} id={service.id} spec={current.spec} /> : <Loading label="Carregando documentação…" />}
    </Surface> : <Surface className="p-8 text-center">Selecione um serviço para abrir o Swagger.</Surface>}
  </OperationalPage>;
}

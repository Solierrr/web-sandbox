import { useRef, useState, type FormEvent } from "react";
import {
  Confirmation,
  Input,
  OperationalPage,
  PrimaryButton,
  Select,
  Textarea,
  WhiteButton,
} from "@solaria.network/web-lib";
import { externalUrl, type Service } from "../../../config/services";
import { request, type Result } from "../../../lib/shared/http/http.service";
import ResponsePanel from "../components/ResponsePanel";
import ModelsPage from "../../models/pages/ModelsPage";

export default function ServicePage({ service }: { service: Service }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [pending, setPending] = useState<{
    path: string;
    init: RequestInit;
  } | null>(null);
  const [validation, setValidation] = useState("cnpj");
  const [purpose, setPurpose] = useState("product");
  const [messageType, setMessageType] = useState("USER_TO_USER");
  const [conversationId] = useState(() => crypto.randomUUID());
  const github = `https://github.com/Solierrr/${service.id}`;
  const actions = (
    <>
      {externalUrl(service.url) && service.swagger && (
        <a
          className="text-orange"
          href={externalUrl(`${service.url}${service.swagger}`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir Swagger ↗
        </a>
      )}
      <a
        className="text-orange"
        href={github}
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub ↗
      </a>
    </>
  );
  async function execute(
    path: string,
    init: RequestInit = {},
    authenticated = true,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await request(service, path, init, authenticated));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Erro inesperado.");
    } finally {
      locked.current = false;
      setBusy(false);
      setPending(null);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || "").trim();
    let path = "/chat";
    let body: BodyInit;
    if (service.kind === "accessibility") {
      const image = data.get("image");
      if (
        !(image instanceof File) ||
        !image.size ||
        image.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(image.type)
      ) {
        setError("Escolha uma imagem JPEG, PNG ou WebP de até 8 MB.");
        return;
      }
      data.set("purpose", purpose);
      data.set("request_id", crypto.randomUUID());
      if (!value("context_title")) data.delete("context_title");
      body = data;
      path = "/v1/images/analyze";
    } else if (service.kind === "validation") {
      path =
        validation === "cnpj"
          ? "/api/v1/companies/validate-cnpj"
          : "/api/v1/certificates/validate";
      body = JSON.stringify(
        validation === "cnpj"
          ? { cnpj: value("cnpj") }
          : {
              cert_nr10_url: value("cert_nr10_url"),
              cert_nr35_url: value("cert_nr35_url"),
            },
      );
    } else if (service.kind === "messenger") {
      path = "/messaging/messages";
      body = JSON.stringify({
        conversationId: value("conversationId"),
        messageType,
        content: value("content"),
      });
    } else {
      const payload: Record<string, unknown> = {
        conversation_id: value("conversation_id"),
        message: value("message"),
      };
      if (service.id === "ai-geographic") {
        if (value("user_timezone"))
          payload.user_timezone = value("user_timezone");
        if (value("latitude") || value("longitude")) {
          if (!value("latitude") || !value("longitude")) {
            setError("Preencha latitude e longitude juntas.");
            return;
          }
          payload.current_location = {
            latitude: Number(value("latitude")),
            longitude: Number(value("longitude")),
          };
        }
      }
      body = JSON.stringify(payload);
    }
    setError("");
    setPending({ path, init: { method: "POST", body } });
  }
  if (service.kind === "core")
    return <ModelsPage service={service} actions={actions} />;
  return (
    <OperationalPage
      title={service.id}
      description={service.description}
      centered
      sideBackground
      actions={actions}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-hard border border-operational-border bg-white p-4">
          <p className="min-w-0 break-all text-sm text-gray">
            {service.url || "URL pendente de configuração"}
          </p>
          <WhiteButton
            type="button"
            content="Verificar disponibilidade"
            description="Verificar disponibilidade do serviço"
            disabled={busy || !service.url}
            onClick={() => void execute(service.health, {}, false)}
          />
        </div>
        {service.kind === "internal" || service.kind === "recommendation" ? (
          <section className="rounded-hard border border-operational-border bg-white p-6">
            <h2>Integração interna pendente</h2>
            <p className="mt-3">
              Estas operações exigem credenciais de serviço. A integração segura
              foi registrada no VersioSpec e será retomada depois.
            </p>
            {service.kind === "recommendation" && (
              <p className="mt-3 text-gray">
                Recomendações de placas, profissionais e técnicos possuem
                contratos separados e autenticação interna.
              </p>
            )}
            {!service.swagger && (
              <p className="mt-3 text-gray">
                Este serviço ainda não disponibiliza um contrato Swagger.
              </p>
            )}
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-hard border border-operational-border bg-white p-6"
          >
            {service.kind === "chat" && (
              <>
                <label className="flex flex-col gap-2">
                  Identificador da conversa
                  <Input
                    name="conversation_id"
                    defaultValue={conversationId}
                    placeholder="Identificador compartilhado entre mensagens"
                    required
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  Mensagem
                  <Textarea
                    name="message"
                    placeholder="Escreva a solicitação para o assistente"
                    required
                    maxLength={8000}
                    className="w-full"
                  />
                </label>
                {service.id === "ai-geographic" && (
                  <>
                    <label className="flex flex-col gap-2">
                      Fuso horário
                      <Input
                        name="user_timezone"
                        placeholder="America/Sao_Paulo"
                        className="w-full"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        Latitude opcional
                        <Input
                          name="latitude"
                          type="number"
                          step="any"
                          min={-90}
                          max={90}
                          placeholder="-23.5505"
                          className="w-full"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        Longitude opcional
                        <Input
                          name="longitude"
                          type="number"
                          step="any"
                          min={-180}
                          max={180}
                          placeholder="-46.6333"
                          className="w-full"
                        />
                      </label>
                    </div>
                  </>
                )}
              </>
            )}
            {service.kind === "accessibility" && (
              <>
                <label className="flex flex-col gap-2">
                  Imagem (até 8 MB)
                  <Input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    className="w-full"
                  />
                </label>
                <div className="flex flex-col gap-2">
                  <span>Finalidade</span>
                  <Select
                    name="purpose"
                    options={[
                      ["Produto", "product"],
                      ["Perfil de empresa", "company_profile"],
                      ["Perfil profissional", "professional_profile"],
                    ]}
                    value={purpose}
                    onChange={(value) => setPurpose(value || "product")}
                    clearable={false}
                    className="w-full"
                  />
                </div>
                <label className="flex flex-col gap-2">
                  Contexto da imagem
                  <Input
                    name="context_title"
                    placeholder="Ex.: placa solar monocristalina"
                    className="w-full"
                  />
                </label>
              </>
            )}
            {service.kind === "validation" && (
              <>
                <div className="flex flex-col gap-2">
                  <span>Validação</span>
                  <Select
                    name="validation-kind"
                    options={[
                      ["Empresa / CNPJ", "cnpj"],
                      ["Certificados NR-10 e NR-35", "certificates"],
                    ]}
                    value={validation}
                    onChange={(value) => setValidation(value || "cnpj")}
                    clearable={false}
                    className="w-full"
                  />
                </div>
                {validation === "cnpj" ? (
                  <label className="flex flex-col gap-2">
                    CNPJ
                    <Input
                      name="cnpj"
                      placeholder="CNPJ da empresa"
                      required
                      maxLength={18}
                      className="w-full"
                    />
                  </label>
                ) : (
                  <>
                    <label className="flex flex-col gap-2">
                      URL do certificado NR-10
                      <Input
                        name="cert_nr10_url"
                        type="url"
                        placeholder="https://…"
                        required
                        className="w-full"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      URL do certificado NR-35
                      <Input
                        name="cert_nr35_url"
                        type="url"
                        placeholder="https://…"
                        required
                        className="w-full"
                      />
                    </label>
                  </>
                )}
                <p className="text-sm text-gray">
                  A validação completa de profissionais permanece pendente por
                  exigir autenticação interna.
                </p>
              </>
            )}
            {service.kind === "messenger" && (
              <>
                <WhiteButton
                  type="button"
                  content="Listar minhas conversas"
                  description="Listar minhas conversas"
                  disabled={busy}
                  onClick={() => void execute("/messaging/conversations/me")}
                />
                <label className="flex flex-col gap-2">
                  Identificador da conversa
                  <Input
                    name="conversationId"
                    placeholder="UUID de uma conversa existente"
                    required
                    className="w-full"
                  />
                </label>
                <WhiteButton
                  type="button"
                  content="Consultar histórico"
                  description="Consultar histórico da conversa"
                  disabled={busy}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    const id = String(
                      new FormData(form || undefined).get("conversationId") ||
                        "",
                    ).trim();
                    if (!id) {
                      setError(
                        "Informe a conversa para consultar o histórico.",
                      );
                      return;
                    }
                    void execute(
                      `/messaging/messages/conversation/${encodeURIComponent(id)}?limit=50`,
                    );
                  }}
                />
                <div className="flex flex-col gap-2">
                  <span>Tipo de mensagem</span>
                  <Select
                    name="message-type"
                    options={[
                      ["Pessoa", "USER_TO_USER"],
                      ["Grupo", "USER_TO_GROUP"],
                      ["Assistente", "USER_TO_CHATBOT"],
                    ]}
                    value={messageType}
                    onChange={(value) =>
                      setMessageType(value || "USER_TO_USER")
                    }
                    clearable={false}
                    className="w-full"
                  />
                </div>
                <label className="flex flex-col gap-2">
                  Conteúdo
                  <Textarea
                    name="content"
                    placeholder="Mensagem de teste"
                    required
                    maxLength={8000}
                    className="w-full"
                  />
                </label>
              </>
            )}
            <PrimaryButton
              type="submit"
              content={
                service.kind === "messenger"
                  ? "Enviar mensagem"
                  : "Executar teste"
              }
              description="Executar teste no serviço de QA"
              disabled={busy}
              className="w-full"
            />
          </form>
        )}
        <ResponsePanel result={result} error={error} busy={busy} />
      </div>
      {pending && (
        <Confirmation
          title="Executar esta solicitação no QA?"
          message="Esta operação pode alterar dados de teste ou acionar integrações externas do serviço."
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() =>
            void execute(
              pending.path,
              pending.init,
              service.kind !== "validation",
            )
          }
        />
      )}
    </OperationalPage>
  );
}

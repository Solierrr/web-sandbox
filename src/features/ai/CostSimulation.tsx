import { useState } from "react";
import { Input, PrimaryButton, Surface, WhiteButton } from "@solaria.network/web-lib";
import { Field, Notice } from "./components";
import {
  DEFAULT_SCENARIOS,
  MAX_SCENARIO_USERS,
  DEFAULT_HUMAN_COST_USD,
  observedPremises,
  parsePositive,
  parseRate,
  parseScenario,
  projectCost,
  projectReturn,
  scenarioList,
  type CostBasis,
} from "./cost";
import { percent, usd } from "./format";

const trimmed = (value: number, digits: number) => String(Number(value.toFixed(digits)));
const count = (value: number) => value.toLocaleString("pt-BR");
export function CostSimulation({ basis, truncated = false }: { basis: CostBasis; truncated?: boolean }) {
  const observed = observedPremises(basis);
  const origin = observed.origin;
  const [costText, setCostText] = useState<string | null>(null);
  const [convText, setConvText] = useState<string | null>(null);
  const [rateText, setRateText] = useState<string | null>(null);
  const [humanText, setHumanText] = useState(String(DEFAULT_HUMAN_COST_USD));
  const [extra, setExtra] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const fallbackConversations = observed.conversationsPerUserWeek ?? 1;
  const cost = costText === null ? observed.costPerConversation : parsePositive(costText);
  const conversations = convText === null ? fallbackConversations : parsePositive(convText);
  const observedRate = observed.resolutionRate === null ? null : trimmed(observed.resolutionRate * 100, 1);
  const rate = rateText === null ? observed.resolutionRate : parseRate(rateText);
  const human = humanText.trim() === "" ? null : parsePositive(humanText);
  const edited = costText !== null || convText !== null || rateText !== null;
  const scenarios = scenarioList(extra);

  function addScenario() {
    const value = parseScenario(draft);
    if (value === null) return setError(`Informe um número inteiro de 1 a ${count(MAX_SCENARIO_USERS)}.`);
    if (scenarios.includes(value)) return setError("Esse cenário já está na lista.");
    setExtra((current) => [...current, value]);
    setDraft("");
    setError("");
  }

  return (
    <Surface contentClassName="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Simulação de custo por usuários semanais</h2>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Field label="Custo médio por conversa (US$)">
          <Input
            name="Custo médio por conversa"
            type="number"
            className="w-full"
            value={costText ?? (observed.costPerConversation === null ? "" : trimmed(observed.costPerConversation, 6))}
            onChange={(event) => setCostText(event.target.value)}
          />
        </Field>
        <Field label="Conversas por usuário por semana">
          <Input
            name="Conversas por usuário por semana"
            type="number"
            className="w-full"
            value={convText ?? trimmed(fallbackConversations, 2)}
            onChange={(event) => setConvText(event.target.value)}
          />
        </Field>
        <Field label="Taxa de resolução (%)">
          <Input
            name="Taxa de resolução"
            type="number"
            className="w-full"
            value={rateText ?? observedRate ?? ""}
            onChange={(event) => setRateText(event.target.value)}
          />
        </Field>
        <Field label="Custo de um atendimento humano (US$)">
          <Input
            name="Custo de um atendimento humano"
            type="number"
            className="w-full"
            placeholder="Ex: 2.50"
            value={humanText}
            onChange={(event) => setHumanText(event.target.value)}
          />
          {humanText !== String(DEFAULT_HUMAN_COST_USD) && (
            <WhiteButton
              description={`Voltar ao custo padrão de um atendimento humano (US$ ${DEFAULT_HUMAN_COST_USD.toFixed(2)})`}
              content="Usar o padrão"
              action={() => setHumanText(String(DEFAULT_HUMAN_COST_USD))}
            />
          )}
        </Field>
        {edited && (
          <div className="flex items-end">
            <WhiteButton
              description="Voltar às premissas calculadas com os dados do período"
              content="Usar dados do período"
              action={() => {
                setCostText(null);
                setConvText(null);
                setRateText(null);
              }}
            />
          </div>
        )}
      </div>

      {origin.priced === 0 ? (
        <Notice>Nenhuma conversa com custo registrado no período. Informe o custo médio por conversa.</Notice>
      ) : (
        <div className="flex flex-wrap gap-2" aria-label="Base do custo médio por conversa">
          <WhiteButton description="Usar a média como custo médio por conversa" content={`Média ${usd(origin.average ?? 0)}`} action={() => setCostText(trimmed(origin.average ?? 0, 6))} />
          <WhiteButton description="Usar a mediana como custo médio por conversa" content={`Mediana ${usd(origin.median ?? 0)}`} action={() => setCostText(trimmed(origin.median ?? 0, 6))} />
          <WhiteButton description="Usar o p95 como custo médio por conversa" content={`p95 ${usd(origin.p95 ?? 0)}`} action={() => setCostText(trimmed(origin.p95 ?? 0, 6))} />
        </div>
      )}
      <p className="text-xs opacity-70">
        {observed.conversationsPerUserWeek === null
          ? `Conversas por usuário por semana: com ${count(observed.observedUsers)} usuário${observed.observedUsers === 1 ? "" : "s"} distinto${observed.observedUsers === 1 ? "" : "s"} não dá para medir, então o ponto de partida é 1 por semana. Ajuste conforme o uso esperado.`
          : `Conversas por usuário por semana observadas: ${trimmed(observed.conversationsPerUserWeek, 2)} (${count(observed.observedUsers)} usuários distintos).`}
      </p>
      {observed.conversationsPerUserWeek !== null && observed.observedUsers < 10 && (
        <Notice>Poucos usuários distintos no período (provavelmente contas de teste): o consumo real por usuário pode ser bem diferente.</Notice>
      )}
      {truncated && <Notice>O painel leu só as conversas mais recentes do período, então as médias por semana podem estar subestimadas.</Notice>}
      {observed.costPerConversation === null && costText === null && <Notice>Sem conversas no período para calcular o custo. Informe o custo médio por conversa.</Notice>}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Adicionar cenário (usuários por semana)">
          <Input
            name="Novo cenário de usuários por semana"
            type="number"
            className="w-full"
            placeholder="Ex: 50"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addScenario();
            }}
          />
        </Field>
        <PrimaryButton description="Adicionar este número de usuários como cenário" content="Adicionar cenário" action={addScenario} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }} aria-label="Cenários de custo">
        {scenarios.map((users) => {
          const result = cost !== null && conversations !== null ? projectCost(users, conversations, cost) : null;
          const returned = cost !== null && conversations !== null && rate !== null ? projectReturn(users, conversations, cost, rate, human) : null;
          const removable = !DEFAULT_SCENARIOS.includes(users);
          return (
            <div key={users} className="flex flex-col gap-2 rounded-lg border border-black/10 p-4" data-scenario={users}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{count(users)} usuários por semana</span>
                {removable && (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent text-xs underline"
                    aria-label={`Remover o cenário de ${users} usuários`}
                    onClick={() => setExtra((current) => current.filter((item) => item !== users))}
                  >
                    Remover
                  </button>
                )}
              </div>
              <span className="text-xs uppercase tracking-wide opacity-70">Por semana</span>
              <span className="text-2xl font-semibold">{result ? usd(result.weekly) : "-"}</span>
              <span className="text-xs uppercase tracking-wide opacity-70">Por mês</span>
              <span className="text-lg font-semibold">{result ? usd(result.monthly) : "-"}</span>
              <span className="text-xs opacity-70">{result ? `${usd(result.perUserWeekly)} por usuário por semana` : "Informe as premissas acima"}</span>
              <span className="text-xs uppercase tracking-wide opacity-70">Resoluções por semana</span>
              <span className="text-lg font-semibold">{returned ? count(Math.round(returned.resolutionsWeekly)) : "-"}</span>
              <span className="text-xs uppercase tracking-wide opacity-70">Custo por resolução</span>
              <span className="text-lg font-semibold">{returned?.costPerResolution != null ? usd(returned.costPerResolution) : "-"}</span>
              <span className="text-xs uppercase tracking-wide opacity-70">ROI</span>
              <span className="text-lg font-semibold">{returned?.roi != null ? percent(returned.roi) : "-"}</span>
              {returned && returned.roi === null && <span className="text-xs opacity-70">Informe o custo de um atendimento humano</span>}
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

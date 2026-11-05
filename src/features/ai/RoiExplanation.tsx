import { DEFAULT_HUMAN_COST_USD, GARTNER_ASSISTED_CONTACT_USD, WEEKS_PER_MONTH } from "./cost";

const link = "underline";

function Source({ href, children }: { href: string; children: string }) {
  return (
    <a className={link} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** Tudo o que explica o ROI e o custo de um atendimento humano, para ficar recolhido na simulação. */
export function RoiExplanation() {
  return (
    <div className="flex flex-col gap-4 text-xs">
      <section className="flex flex-col gap-1">
        <h3 className="m-0 text-xs font-medium uppercase tracking-wide opacity-70">Custo da IA</h3>
        <p className="m-0 opacity-60">
          Custo semanal = usuários × conversas por usuário por semana × custo médio por conversa. O mês usa {WEEKS_PER_MONTH.toFixed(2).replace(".", ",")} semanas.
          Considera só o custo que o histórico registra por conversa (as chamadas de LLM); hospedagem e outros serviços ficam de fora.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="m-0 text-xs font-medium uppercase tracking-wide opacity-70">Resolução e ROI</h3>
        <p className="m-0 opacity-60">
          Resolução é a conversa sem erro e com resposta do assistente. Custo por resolução = custo das conversas ÷ resoluções.
        </p>
        <p className="m-0 font-medium opacity-70">ROI = (resoluções × custo de um atendimento humano − custo da IA) ÷ custo da IA</p>
        <p className="m-0 opacity-60">
          Exemplo: 100 usuários × 2 conversas por semana × US$ 0,05 = US$ 10 de custo da IA. Com 80% de resolução são 160 resoluções, e 160 × US$ {DEFAULT_HUMAN_COST_USD.toFixed(2)} = US$ 320
          de atendimento humano evitado. ROI = (320 − 10) ÷ 10 = 31, ou seja, 3100%: cada US$ 1 gasto com a IA devolve US$ 31.
        </p>
        <p className="m-0 opacity-60">
          O que ele não conta: parte do pressuposto de que cada conversa resolvida evitou um atendimento humano inteiro, e não inclui hospedagem, serviços de apoio nem o trabalho de
          desenvolvimento. Por isso tende a sair otimista.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="m-0 text-xs font-medium uppercase tracking-wide opacity-70">Como o custo de um atendimento humano foi calculado</h3>
        <p className="m-0 opacity-60">
          Estimativa de baixo para cima para um atendente de chat/SAC no Brasil. O valor padrão é US$ {DEFAULT_HUMAN_COST_USD.toFixed(2)} e pode ser editado no campo acima.
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 opacity-60">
          <li>
            Salário médio de atendente de telemarketing: R$ 1.800 por mês, em jornada de 37 h por semana (
            <Source href="https://www.salario.com.br/profissao/atendente-de-telemarketing-cbo-422315/">Portal Salário, via CAGED</Source>).
          </li>
          <li>
            Custo total para a empresa: × 1,7 de encargos e provisões do CLT (
            <Source href="https://valorfinal.com.br/guia/custo-funcionario">guia de custo CLT</Source>, que cita de 1,7 a 2,0 conforme o regime), o que dá R$ 3.060 por mês, ou cerca de R$ 19,09 por hora paga.
          </li>
          <li>
            Atendimentos por hora paga: 55% de ocupação × (60 ÷ 11 minutos por chat) = 3,0 (benchmark da{" "}
            <Source href="https://www.comm100.com/blog/live-chat-benchmark-data">Comm100</Source>: 50 a 60% de ocupação e cerca de 11 minutos por chat).
          </li>
          <li>Mão de obra por atendimento: R$ 19,09 ÷ 3,0 = R$ 6,36.</li>
          <li>Mais 40% de supervisão, ferramentas e treinamento (premissa nossa, sem fonte): R$ 8,91.</li>
          <li>
            Em dólar, a R$ 5,15: US$ 1,73, arredondado para US$ {DEFAULT_HUMAN_COST_USD.toFixed(2)}. O câmbio é de setembro de 2026.
          </li>
        </ol>
        <p className="m-0 opacity-60">
          Conferência: a{" "}
          <Source href="https://www.gov.br/mds/pt-br/acesso-a-informacao/licitacoes-e-contratos/editais-abertos/Planilha_de_Custo.pdf">planilha de custos do MDS</Source> lista chat com
          atendimento humano a R$ 9,99 por unidade (a unidade não está clara na planilha). Referência global: a mediana do{" "}
          <Source href="https://www.gartner.com/en/documents/7135530">Gartner</Source> para um contato assistido é de US$ {GARTNER_ASSISTED_CONTACT_USD.toFixed(2)}, nos EUA.
        </p>
        <p className="m-0 opacity-60">
          Vale para um chat simples, um por vez. Um atendimento técnico mais longo custa mais, e dois chats ao mesmo tempo cortam o custo pela metade. Se vocês tiverem o custo real, use-o no campo.
        </p>
      </section>
    </div>
  );
}

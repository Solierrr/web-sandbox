# Ambiente de administrador (Sandbox)

O Sandbox é a interface de testes manuais do ambiente de QA da Solaria. Nele um administrador conversa com os assistentes de IA em modo debug, acorda os serviços do Render, lê as conversas gravadas, abre o passo a passo de uma resposta e acompanha custo, latência, erros e NPS. Este documento explica cada tela e como usá-la.

## Visão geral

| Tela | Caminho | Para que serve |
|---|---|---|
| Catálogo | `/` | Links de GitHub, Swagger e aplicação de cada serviço |
| Keepalive | `/keepalive` | Acordar os serviços de QA no Render |
| Simulador | `/ia/simulador` | Rodar um turno de um assistente ou validador em modo debug |
| Conversas | `/ia/conversas` | Buscar conversas gravadas e abrir o chat de uma sessão |
| Playground | `/ia/playground` | Passo a passo de uma resposta, com reexecução de um nó (abre pelo botão em Conversas) |
| Dashboards | `/ia/dashboards` | NPS, custo, latência, erros, simulação de custo e LangSmith |

Simulador, Conversas e Dashboards ficam no grupo **Fluxo de IA** do menu lateral e compartilham os mesmos filtros de ambiente, assistente e período.

## Como acessar

- **Local:** use Node.js 24. Na pasta `web-sandbox`, rode `npm ci` e `npm run dev`, e abra `http://127.0.0.1:5174`. A porta é fixa (`strictPort`); se estiver ocupada, o Vite não sobe. O servidor local (`npm run dev:server`, porta 5180, para onde o Vite encaminha `/api/qa`) só é necessário para o Swagger de QA; as telas de Fluxo de IA chamam os serviços direto do navegador.
- **Render (QA):** o endereço do `web-sandbox` está na linha dele no Catálogo. Os serviços de IA liberam CORS para `http://127.0.0.1:5174` e para o endereço do Render.
- **Login:** a API-auth de QA valida e-mail e senha. Use uma conta do QA.
- **Sessão:** fica só em memória, com logout local imediato. Recarregar a página, ou abrir direto a URL de uma tela, volta ao login. Navegue sempre pelo menu lateral.
- **Modo mock:** com `VITE_MOCKS=ALWAYS` (só no `npm run dev`) o login aceita qualquer e-mail e senha e não chama a API-auth. As telas de IA continuam chamando os serviços reais e, sem um JWT válido, tendem a devolver 401. Conversas e Dashboards mostram dados de exemplo, com um aviso na tela. Para testar de verdade, use `VITE_MOCKS=DEACTIVATED`. Builds de produção ignoram essa variável.

As variáveis `VITE_*` são URLs públicas, sem credenciais. Nunca coloque chave de serviço nelas. Alterações exigem reiniciar o Vite.

## Catálogo

É a página inicial e lista os repositórios da Solaria (exceto o Elos).

- **Filtros:** ícones em pílulas por framework (Spring, LangChain, FastAPI, React), linguagem (Python, Kotlin, Java, TypeScript, Terraform) e tipo (serviços, bibliotecas, infraestrutura, dados, documentação, mobile). Clique para ligar e clique de novo para desligar. Os filtros se combinam e ficam na URL.
- **Cada linha:** o link do GitHub e, quando o serviço tem Swagger, as opções QA e PROD, com abrir em nova aba e copiar o link. Serviços sem Swagger mostram os links da aplicação em QA e PROD.
- **Hosts:** QA usa os endereços do Render. PROD usa `https://<servico>.solarianetwork.site`, com o nome do serviço sem o prefixo `api-` ou `ai-` (por exemplo, `api-core` vira `core.solarianetwork.site`). O `web-app` usa `https://solarianetwork.site`, e `web-sandbox` e `mcp-database` não têm PROD. Qualquer URL pode ser trocada com `VITE_QA_<SERVICO>` ou `VITE_PROD_<SERVICO>` (nome em maiúsculas e com `_`, por exemplo `VITE_PROD_API_CORE`).
- **Swagger de QA:** abre em uma página própria, pelo servidor do portal, que valida o JWT do `api-auth` e mantém credenciais de serviço fora do navegador. Mantenha aberta a aba original do Sandbox enquanto usa o Swagger, porque ela fornece a sessão. Uma sessão de mock local não dá acesso.
- **Storybook:** a linha `storybook` aponta para o GitHub Pages. `VITE_STORYBOOK_WEB_APP` e `VITE_STORYBOOK_LIB_WEB` trocam as URLs.

O Swagger pode estar desligado pelo próprio serviço, e o cluster de PROD pode estar desligado. Se um link não abre, confira antes se o serviço está acordado.

## Keepalive

No plano gratuito do Render os serviços dormem com inatividade, e o primeiro acesso pode levar um minuto ou mais. O Keepalive acorda os serviços de QA com uma requisição simples.

1. Abra **Keepalive** no menu.
2. Clique no botão de um serviço, escolha um conjunto pronto ou marque vários serviços.
3. Espere a resposta. Ela indica só que o serviço respondeu, não que está saudável por dentro.

| Conjunto | O que acorda |
|---|---|
| Essenciais | `api-auth`, `api-core` e `api-messenger` |
| IA | todos os serviços `ai-*` |
| Todos | todos os serviços de QA da lista |

`web-app`, `web-sandbox` e `lib-web` ficam de fora porque são estáticos e não dormem. A tela chama cada serviço direto do navegador (`no-cors`) e não usa o serviço do repositório `infra-keepalive`.

**Ordem recomendada:** `api-auth`, depois `api-messenger`, depois os `ai-*`. O `api-messenger` valida o JWT buscando as chaves públicas no `api-auth`. Se o `api-auth` estiver dormindo, o resultado aparece como 401 mesmo com token válido. Serviços Spring Boot (`api-auth`, `api-core`) podem levar mais de 2 minutos para subir; um botão que "não respondeu" nesse intervalo nem sempre indica falha, tente de novo.

## Simulador

O Simulador roda um turno de um serviço de IA pela rota `/debug/*` dele, com o JWT do administrador logado, e mostra a resposta e o que cada passo recebeu e devolveu.

### Escolhas no topo

| Campo | Opções |
|---|---|
| Ambiente | QA ou PROD |
| Assistente (serviço) | ver tabela abaixo |

| Serviço no Simulador | Rota usada | Entrada |
|---|---|---|
| Assistente (chat), `ai-assistant` | `POST /debug/chat` | mensagem, persona, Session ID |
| Operacional (chat), `ai-operational` | `POST /debug/chat` | mensagem, Session ID. Ações de escrita rodam em modo simulado |
| Geográfico (chat), `ai-geographic` | `POST /debug/chat` | mensagem, Session ID |
| Validação de certificados, `ai-validation` | `POST /debug/certificates/validate` | URL da imagem do NR-10 e URL da imagem do NR-35 |
| Validação de CNPJ, `ai-validation` | `POST /debug/companies/validate-cnpj` | CNPJ |
| Análise de imagem, `ai-accessibility` | `POST /debug/images/analyze` | arquivo de imagem e finalidade (Produto, Perfil de empresa, Perfil de profissional, Outro) |

### Painel de configurações (chats)

- **Usar servidor local:** envia o turno para um serviço rodando na sua máquina (padrão `http://localhost:8000`). Só aceita `localhost` ou `127.0.0.1`, porque o token do administrador não sai para outro host. Deixe desmarcado para usar o serviço do Render.
- **Persona:** `demandante` ou `profissional`. Só o assistente tem esse campo. Muda o que ele pode ler e recomendar.
- **Session ID:** gerado no formato `sandbox-xxxxxxxx`. É o identificador da conversa de debug. **Nova conversa** gera outro. O Session ID do topo é um link para a conversa na aba Conversas; enquanto a aba está aberta, a conversa vem da memória do navegador.

### Como usar

1. Escolha ambiente e serviço, e ajuste o painel.
2. Digite a mensagem (ou preencha URLs, CNPJ ou imagem) e clique em **Executar**.
3. Enquanto roda, aparece "Executando…" e o botão **Cancelar**. O limite é de 180 segundos; depois disso a tela informa que o serviço não respondeu a tempo e que, no plano gratuito, ele pode estar acordando.
4. A resposta aparece com o **passo a passo**: para cada nó, a entrada, a saída, os prompts e a resposta de cada chamada de LLM, com modelo, latência e tokens de entrada e saída.

### O que é gravado

- Os turnos de assistant, operational e geographic são gravados no `api-messenger` (conversa, mensagens e steps, com `userDetails.source = "debug"`). Por isso aparecem em Conversas e Dashboards.
- A execução personalizada de um nó (ver Playground) não grava nada.
- O estado do grafo vai para o checkpointer na thread `debug:<sub>:<conversation_id>`, separada das conversas reais.
- O tráfego aparece no LangSmith com `metadata.source = "debug"` e `metadata.persona`.
- O texto original das mensagens vai ao LangSmith. O bloco `debug` da resposta mascara CPF, CNPJ, telefone e e-mail.
- Em PROD o turno usa o grafo e os LLMs reais, com a identidade do administrador: gasta cota e custo reais, e as leituras no `api-core` são dados reais. Em PROD, use só contas de teste.

Para incluir outro serviço no Simulador, acrescente uma linha em `src/features/ai/targets.ts`.

## Conversas

Lista as conversas gravadas no `api-messenger` do ambiente escolhido (`GET /messaging/admin/conversations`).

**Filtros:** ambiente, assistente, período (padrão: últimos 7 dias) e três campos de busca: pergunta ou resposta, Session ID e User ID. Clique em **Buscar conversas** para aplicar. A lista mostra no máximo as 200 conversas mais recentes; refine os filtros para ver as outras.

**Colunas:** sessão (link com o início da primeira mensagem), assistente, usuário, início, número de mensagens, latência (com a marca "erro" quando houve falha), custo e nota de NPS.

**Abrir uma sessão** (`/ia/conversas/<sessão>`):

- À esquerda, o chat completo: mensagem do usuário e resposta do assistente, com agente e hora.
- À direita, um card por resposta do assistente com assistente, agente, ambiente, hora, latência, custo e metadados.
- O botão **Playground Debug** de cada card abre o passo a passo daquela resposta. Ele só aparece quando a resposta tem os steps gravados.

**Custo por usuário:** a tela não tem um relatório de custo por usuário pronto. Para ver quanto um usuário gerou, filtre pelo **User ID** e some a coluna Custo da lista; dentro de uma sessão, cada resposta mostra o próprio custo. Para uma projeção de custo por usuário por semana, use a simulação em Dashboards.

**Quem pode ler:** a rota é protegida pelo JWT do administrador e só aceita os `sub` listados em `DEBUG_ADMIN_SUBS` do `api-messenger`. Se o `api-messenger` do ambiente ainda não tem as rotas `/messaging/admin`, a tela avisa que é preciso publicar a versão nova dele.

## Playground

O Playground mostra uma resposta nó a nó e permite reexecutar um nó com outros prompts. Ele só abre pelo botão **Playground Debug** de um card de resposta em Conversas.

**O que mostra**

- Uma linha do tempo dos nós, com horário, duração, modelo e tokens. Cada nó pode usar um modelo diferente.
- O detalhe do nó escolhido: entrada, saída e, para cada chamada de LLM, o prompt e a resposta.

**Execução personalizada**

1. Escolha o nó.
2. Marque **Ativar execução personalizada?** (junto do botão **Executar**, no fim do detalhe do nó). Os prompts do nó ficam editáveis.
3. Edite o texto e clique em **Executar**. Roda apenas esse nó, com o que os anteriores já produziram, e para nele.

Regras:

- Só mensagens com `editable: true` podem ser editadas, e as chamadas com `prompt_complete: false` (houve dado pessoal mascarado) não permitem edição.
- A tela descarta qualquer resposta que não confirme `debug.custom.stopped`.
- Só funciona em respostas geradas pelo Simulador, porque o serviço guarda a execução: nos chats, nos checkpoints; em validação e acessibilidade, em memória (perdida após 15 a 30 minutos ou reinício). Para conversas abertas por Conversas, vale só para as feitas no Simulador pela mesma conta; as de outro administrador mostram o motivo no lugar da opção.
- O histórico não guarda prompts. O primeiro **Executar** de um nó traz o prompt atual para editar.
- Os checkpoints expiram em 30 dias (`CHECKPOINT_TTL_DIAS`); depois disso o serviço responde 404 para aquele turno.
- Nós que não podem ser reexecutados respondem 422 com o motivo. Hoje, só `operational_delegate`: no debug a delegação ao `ai-operational` é simulada.
- A reexecução não altera a conversa de debug original.

Rota usada por tipo de serviço:

| Serviço | Chamada |
|---|---|
| Chat (assistant, operational, geographic) | `POST /debug/chat` com `custom: {turn, node, occurrence, stop_after_node: true, prompts}` |
| Certificados | `POST /debug/certificates/validate` com `custom: {run_id, node, occurrence, stop_after_node, prompts}` e as URLs reenviadas |
| CNPJ | `POST /debug/companies/validate-cnpj` com `custom: {node: "cnpj_validation", stop_after_node, prompts}` e o CNPJ reenviado (a BrasilAPI é consultada de novo) |
| Imagem | `POST /debug/images/stage` com `{run_id, node, occurrence, stop_after_node, prompts}` (só `moderation` e `caption` chamam modelo) |

## Dashboards

Os dashboards são calculados no navegador sobre as conversas do `api-messenger` do ambiente escolhido. Leem no máximo as **2000 conversas mais recentes** do período; se houver mais, a tela avisa e pede um período menor. Clique em **Aplicar filtros** depois de mudar ambiente, assistente ou período (padrão: últimos 7 dias).

### Indicadores do período

| Indicador | Como é calculado |
|---|---|
| Conversas | total de conversas no período |
| NPS | `(promotores - detratores) / respondentes`, em %. Nota 9 a 10 é promotor, 0 a 6 é detrator, e só conta quem respondeu |
| Custo | soma do custo registrado das conversas (US$) |
| Custo médio por conversa | custo total dividido pelas conversas com custo registrado |
| Taxa de erro | conversas com erro dividido pelo total |
| Latência p50 e p95 | percentis da latência das conversas |

Abaixo dos indicadores:

- **Conversas por dia** e **Custo por dia**, em gráficos de barras (até 92 dias).
- **Por assistente:** conversas, NPS, custo, latência p95 e taxa de erro de cada assistente.

### Custo atual do sistema

Use **Custo** (total do período), **Custo por dia** e a tabela **Por assistente**. O bloco **LangSmith** (abaixo) traz um segundo número, vindo dos traces. O custo do painel considera só o que o histórico registra por conversa, ou seja, as chamadas de LLM. Hospedagem e outros serviços ficam de fora.

### Simulação de custo por usuários semanais

Projeta o custo para um número de usuários, com esta conta:

```
custo semanal = usuários × conversas por usuário por semana × custo médio por conversa
custo mensal  = custo semanal × 52/12 semanas
```

- **Custo médio por conversa (US$)** e **Conversas por usuário por semana** começam com os valores observados no período. Você pode editar os dois; **Usar dados do período** volta ao calculado.
- Os botões **Média**, **Mediana** e **p95** trocam o custo médio por conversa por essa estatística, para ver o cenário típico e o pessimista.
- Com menos de 2 usuários distintos no período, o consumo por usuário não pode ser medido e o ponto de partida é 1 conversa por semana. Com menos de 10 usuários, a tela avisa que provavelmente são contas de teste.
- Cenários padrão: 100 e 1000 usuários por semana. **Adicionar cenário** aceita qualquer inteiro de 1 a 1.000.000.
- Cada cenário mostra o custo por semana, por mês e por usuário por semana.

### LangSmith

Mostra execuções, custo, tokens (entrada e saída), taxa de erro e latência p50 e p99, no total, por assistente e por modelo. Um turno do assistente conta como uma execução.

- Os dados vêm do `api-messenger` (`GET /messaging/admin/langsmith/summary`). A chave do LangSmith fica só no backend.
- Se o `api-messenger` do ambiente não tiver `LANGSMITH_API_KEY` e `LANGSMITH_PROJECT`, o bloco avisa que não está configurado e o resto do painel segue normal.
- A consulta aceita 1 por chave a cada 10 segundos. Se aparecer o limite do LangSmith (429), espere cerca de 10 segundos e aplique os filtros de novo.
- Às vezes o bloco mostra só o `ai-assistant`, sem o filtro de assistente, para não passar do limite do LangSmith; a tela diz quando é o caso.
- **Abrir no LangSmith** leva ao projeto.

## Contas e permissões

Há duas camadas.

1. **Login no Sandbox:** qualquer conta válida da API-auth de QA entra e vê Catálogo e Keepalive.
2. **Modo debug e leitura de conversas:** só administradores. Cada serviço de IA e o `api-messenger` mantêm a lista `DEBUG_ADMIN_SUBS`, com os UUIDs (`sub` do JWT) autorizados, separados por vírgula. Entradas que não são UUID são ignoradas.

| Situação | Resposta do serviço |
|---|---|
| `DEBUG_ADMIN_SUBS` vazia, ou `ENVIRONMENT` fora de `LOCAL`, `DEV`, `QA`, `PROD` | `404` (a rota "não existe") |
| Sem `Authorization: Bearer`, ou token inválido | `401` |
| `sub` fora da lista | `403` |

Para dar acesso a alguém, adicione o `sub` dela à `DEBUG_ADMIN_SUBS` de cada serviço que ela precisa usar (os `ai-*` no Simulador, o `api-messenger` em Conversas e Dashboards). Para fechar o modo debug de um serviço, esvazie a lista. Cada turno autorizado deixa no log uma linha com o `sub` e o ambiente.

## Serviços de que o Sandbox depende

O Sandbox chama os serviços diretamente, sem BFF. Os padrões vêm de `.env.example` e apontam para o QA no Render.

| Variável | Serviço | Usado em |
|---|---|---|
| `VITE_API_AUTH` | `api-auth` | Login |
| `VITE_API_MESSENGER` | `api-messenger` | Conversas, Dashboards e LangSmith |
| `VITE_AI_ASSISTANT` | `ai-assistant` | Simulador |
| `VITE_AI_OPERATIONAL` | `ai-operational` | Simulador |
| `VITE_AI_GEOGRAPHIC` | `ai-geographic` | Simulador |
| `VITE_AI_VALIDATION` | `ai-validation` | Simulador (certificados e CNPJ) |
| `VITE_AI_ACCESSIBILITY` | `ai-accessibility` | Simulador (imagem) |
| `VITE_API_CORE`, `VITE_API_RECOMMENDATION`, `VITE_GOOGLE_REGISTRY` e outras | demais serviços | Catálogo e Keepalive |

Dependências entre serviços que explicam a maioria das falhas:

- Toda chamada autenticada depende do `api-auth` (chaves públicas do JWT).
- O Simulador de chat depende do `api-messenger` (grava a conversa) e do MongoDB.
- O `ai-assistant` chama o `api-core`, o `mcp-database` e o Qdrant, e delega ações ao `ai-operational`.
- O `ai-geographic` delega dúvidas de produto ao `ai-assistant`.

## LangSmith

Quando `SOLARIA_LANGSMITH_ENABLED` está `true` no serviço, cada turno do `/chat` e do `/debug/chat` gera um trace. No projeto de QA:

- Filtre `metadata.source = "debug"` para ver só o que veio do Simulador (o `/chat` real usa `"chat"`).
- Para achar os traces de uma conversa, filtre por `metadata.conversation_id`.
- Plano gratuito: 1 seat, 5.000 traces por mês e 14 dias de retenção.

Mais detalhes em `docs/observability-langsmith.md` do `ai-assistant`.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Volta para o login ao recarregar | A sessão fica só em memória | Navegue pelo menu lateral e não recarregue |
| "O serviço não respondeu a tempo" (180 s) | Serviço dormindo, caindo ou em cold start | Use o Keepalive na ordem `api-auth`, `api-messenger`, `ai-*`; confira o status no dashboard do Render |
| 401 em qualquer tela de IA | Token ausente ou expirado, modo mock, ou `api-auth` dormindo (o `api-messenger` não consegue buscar as chaves) | Faça login real (`VITE_MOCKS=DEACTIVATED`) e acorde o `api-auth` primeiro |
| 404 no Simulador | `DEBUG_ADMIN_SUBS` vazia ou `ENVIRONMENT` fora da lista no serviço | Configure a lista e confira o ambiente |
| 403 no Simulador ou em Conversas | Seu `sub` não está em `DEBUG_ADMIN_SUBS` do serviço | Peça a inclusão |
| Conversas e Dashboards avisam que faltam rotas `/messaging/admin` | `api-messenger` do ambiente com versão antiga | Publicar a versão nova do `api-messenger` |
| Bloco LangSmith "não está configurado" | `api-messenger` sem `LANGSMITH_API_KEY` e `LANGSMITH_PROJECT` | Configurar as duas variáveis no ambiente |
| LangSmith 429 | Limite de 1 consulta a cada 10 s por chave | Esperar e aplicar os filtros de novo |
| Simulador sem trace no LangSmith | Tracing desligado no serviço, ou o turno nem chegou a rodar | Ver `SOLARIA_LANGSMITH_ENABLED` e se o serviço respondeu |
| Serviço marcado "Failed service" no Render, com `bad auth : authentication failed` no log de inicialização | Senha do usuário do MongoDB Atlas diferente da que o serviço recebe do Infisical | Alinhar a senha entre o Atlas e o Infisical (QA, pasta `/database`) e fazer novo deploy dos serviços que usam esse Mongo |
| 409 ao gravar a segunda mensagem de uma conversa no `api-messenger` | Índice antigo `conversation_client_message_idx` ainda no Mongo, depois de um índice ter sido renomeado | Remover o índice antigo da coleção `messages` do ambiente |
| Botão **Playground Debug** ausente ou execução personalizada indisponível | A resposta não tem steps gravados, é de outro administrador, ou é uma conversa antiga | O motivo aparece na tela; refaça o turno no Simulador com a sua conta |

O Mongo do Atlas usa um usuário compartilhado. Quando a senha é trocada no Atlas, o Infisical e os serviços precisam ser atualizados juntos, senão os serviços caem na inicialização com o erro de `bad auth`.

## Validação do projeto

```sh
npm test
npm run lint
npm run build
```

Os testes usam respostas controladas e não alteram o QA. Nenhuma chave interna deve ser adicionada a variáveis `VITE_*`.

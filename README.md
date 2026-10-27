# Solaria Sandbox

Interface de testes manuais do ambiente de QA. Login pela API-auth, seguido de layout e componentes consumidos diretamente de `@solaria.network/web-lib`. O web-app mantém seus componentes locais.

## Executar localmente

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5174. Use uma conta do QA. As variáveis de `.env.example` podem ser copiadas para `.env.local`; são URLs públicas, sem credenciais de serviço. Alterações de variáveis exigem reiniciar o Vite. Os destinos padrão são os serviços de QA no Render. Serviços locais podem substituir essas URLs durante o desenvolvimento.

O catálogo usa os hosts de QA documentados (Render) e, para PROD, o padrão `https://<servico>.solarianetwork.site`. Qualquer URL pode ser sobrescrita com `VITE_QA_<SERVICO>` ou `VITE_PROD_<SERVICO>` (nome do serviço em maiúsculas e com `_`, por exemplo `VITE_PROD_API_CORE`). A disponibilidade depende do ambiente: o cluster de PROD pode estar desligado e o Swagger pode estar desativado pelo próprio serviço.

## Modo mock (local, sem dependência externa)

Com `VITE_MOCKS=ALWAYS` (padrão do `.env.example`) e só no `npm run dev`, o login aceita qualquer e-mail e senha, cria uma sessão local e não chama a API-auth: renovação e logout também ficam locais. Nada é simulado além da autenticação, então as telas que consultam as APIs de QA continuam chamando os serviços reais e, sem um JWT válido, tendem a retornar 401. Para usar a autenticação real, defina `VITE_MOCKS=DEACTIVATED`. Builds de produção ignoram essa variável.

## Telas

- Catálogo: página inicial com todos os repositórios do Solaria (exceto Elos) e filtros em pílulas de ícones, como as do login: framework (Spring, LangChain, FastAPI, React), linguagem (Python, Kotlin, Java, TypeScript, Terraform) e tipo (serviços, bibliotecas, infraestrutura, dados, documentação, mobile). Clicar em um ícone liga o filtro e clicar de novo desliga; os filtros se combinam e ficam na URL. Cada repositório mostra o GitHub e, quando tem Swagger, as opções PROD e QA com abrir em nova aba e copiar o link. Serviços sem Swagger mostram os links da aplicação em QA e PROD. A linha `storybook` aponta para o GitHub Pages (`VITE_STORYBOOK_WEB_APP` e `VITE_STORYBOOK_LIB_WEB` sobrescrevem as URLs).
- Keepalive: acorda os serviços de QA no Render com uma requisição simples (`no-cors`, sem integrar o serviço de keepalive). Há um botão por serviço, conjuntos predefinidos (Essenciais, IA e Todos) e seleção múltipla. A resposta indica só que o serviço respondeu; o plano free pode levar cerca de um minuto para acordar. Aplicações estáticas (web-app e web-sandbox) não dormem e ficam de fora.
- Fluxo de IA: reservado e comentado em `src/App.tsx` (rota, item de menu e import). Será implementado por outra pessoa.

O catálogo concentra os atalhos. O ícone Swagger de cada serviço abre diretamente a documentação QA em nova aba, na página independente `/swagger.html?service=<servico>`. Produção continua como atalho externo, sem injeção de credenciais.

## Portal Swagger de QA

Defina `VITE_MOCKS=DEACTIVATED`. Em um terminal, execute o servidor com as credenciais de QA injetadas pelo Infisical (`npm run dev:server`); em outro, `npm run dev`. O Vite encaminha `/api/qa` para `127.0.0.1:5180`. `.env.local` é configuração do Vite e **não** é carregado pelo processo Node. Não coloque service keys em variáveis `VITE_*`.

Todas as contas com JWT de acesso válido do QA podem usar o portal. O servidor verifica assinatura RS256, emissor, expiração e tipo do token usando o JWKS fixo do api-auth de QA. Sessões de mock não acessam as APIs pelo proxy. A documentação e as chamadas passam pelo servidor do próprio sandbox; service keys ficam fora do navegador. Não existe novo repositório BFF.

O Swagger tem seu próprio HTML, bundle, CSS e favicon oficiais, sem carregar a aplicação React do sandbox, sidebar, navbar, canvas ou componentes Solaria. As antigas páginas `/docs` e o painel de documentação foram removidos. Mantenha a aba original do catálogo aberta: ela fornece o JWT em memória e renova a sessão quando necessário. A comunicação `postMessage` valida origem, aba registrada, serviço e identificador da requisição. Tokens não passam pela URL nem são persistidos. Abrir a URL isoladamente sem a aba do catálogo apresenta orientação para abrir pelo serviço.

`shared/qa-services.json` define os destinos permitidos; URLs fornecidas pelo navegador não são aceitas. `server/portal/portal.service.ts` mapeia as credenciais: `SERVICE_KEY_API_EMAIL`, `SERVICE_KEY_API_RECOMMENDATION`, `RECOMMENDATION_API_KEY`, `SYNC_API_KEY`, `REGISTRY_CONSUMER_TOKEN` e `VALIDATION_SERVICE_TOKEN`. Os demais serviços recebem o JWT do usuário. Credencial ausente retorna 503, sem contornar autenticação. As rotas internas e as rotas `/v1/llm` do Registry não estão disponíveis, pois entregam credenciais de provedores.

O proxy aceita JSON, binários e multipart até 10 MiB, bloqueia redirecionamentos e referências OpenAPI externas e não repete mutações automaticamente. Streaming/SSE e WebSocket não fazem parte desta versão. Serviços adormecidos podem demorar até 90 segundos; falhas ficam isoladas na documentação selecionada.

O portal com proxy é publicado em `https://web-sandbox-qa.onrender.com` como **Render Web Service**, com o `Dockerfile`, health check `/health` e grupo `Infisical-injection`. O entrypoint carrega apenas QA. `npm run build` gera frontend e servidor; `NODE_ENV=production npm start` serve ambos na mesma origem. O Static Site anterior foi preservado durante a migração; apenas publicar `dist` não disponibiliza o proxy.

## Biblioteca de componentes

`@solaria.network/web-lib` vem do npm, no intervalo `^0.5.0` (correções e novidades compatíveis da 0.5.x). O `package-lock.json` fixa a versão exata e o Dependabot abre as PRs de atualização.

Para testar uma alteração da lib antes de publicá-la, gere o tarball na lib (`npm run build` e `npm pack`) e instale-o localmente com `npm install ./caminho/solaria.network-web-lib-x.y.z.tgz`, sem commitar o tarball.

## Validação

```sh
npm test
npm run lint
npm run build
```

Os testes usam respostas controladas e não alteram QA. O proxy fica dentro deste repositório, e nenhuma chave interna deve ser adicionada a variáveis `VITE_*`.

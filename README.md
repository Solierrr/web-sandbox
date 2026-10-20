# Solaria Sandbox

Interface de testes manuais do ambiente de QA. Login pela API-auth, seguido de layout e componentes consumidos diretamente de `@solaria.network/web-lib`. O web-app mantém seus componentes locais.

## Executar localmente

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5174. Use uma conta do QA. As variáveis de `.env.example` podem ser copiadas para `.env.local`; são URLs públicas, sem credenciais de serviço. Alterações de variáveis exigem reiniciar o Vite. Os destinos padrão são os serviços de QA no Render. Serviços locais podem substituir essas URLs durante o desenvolvimento.

Grafana, Argo CD e API-email aparecem como pendentes até suas URLs serem configuradas. Os outros links usam os hosts documentados de QA; a disponibilidade depende do ambiente. Swagger é um link externo e pode estar desativado pelo próprio serviço.

## Telas

- Atalhos: repositórios da organização separados por prefixo, descrições, links dos serviços e infraestrutura. Repositórios Elos são identificados separadamente.
- API-core: listar, consultar, criar, editar e excluir modelos de placas solares, selecionando uma marca cadastrada, com paginação de cinco itens e confirmação antes de alterações.
- Dispositivos QA: autenticação Google separada e gerenciamento de registros no Firestore `qa_devices`, sujeito às regras de acesso de `qa_admins`.
- API-messenger: consultar conversas/histórico e enviar mensagens confirmadas em conversas existentes.
- AI-assistant, AI-geographic e AI-operational: mensagens com identificador de conversa; geographic aceita localização e fuso opcionais.
- AI-accessibility: upload de imagem JPEG/PNG/WebP até 8 MB e contexto/finalidade.
- AI-validation: CNPJ e certificados NR-10/NR-35 públicos. Validação completa de profissionais permanece pendente.
- API-recommendation, API-email e Google-registry: disponibilidade e atalhos; operações que dependem de credenciais internas permanecem pendentes no VersioSpec.

As respostas mostram status HTTP, duração e corpo. Falhas são isoladas por serviço e não são substituídas por mocks. Sessão temporária em memória/sessionStorage, refresh único com proteção contra respostas atrasadas e logout local imediato. Tokens não são incluídos em links externos e redirecionamentos de requests autenticados são bloqueados.

## Biblioteca local

O tarball em `vendor` permite consumir as alterações locais da lib sem publicar nem depender de uma pasta irmã em `npm ci`. Para atualizar:

```sh
cd ../web-lib
npm run build
npm pack --pack-destination ../web-sandbox/vendor
cd ../web-sandbox
npm install ./vendor/solaria.network-web-lib-0.3.1.tgz
```

## Validação

```sh
npm test
npm run lint
npm run build
```

Os testes usam respostas controladas e não alteram QA. O uso real do navegador depende dos serviços aceitarem a origem do sandbox por CORS. Os ajustes locais nos serviços precisam ser publicados separadamente para valerem no QA remoto. Nenhum BFF é utilizado, e nenhuma chave interna deve ser adicionada a variáveis `VITE_*`.

## Documentação das APIs (Swagger)

`/docs` lista todas as APIs do ambiente (estado, versão, número de endpoints, busca entre APIs) e `/docs/:api` abre o Swagger UI de cada uma, com o login do portal aplicado às chamadas "Try it out" (o Authorize não é necessário). A lista fica em `src/config/apis.ts` e usa as mesmas variáveis `VITE_*` do restante do portal; o OpenAPI é lido de `/v3/api-docs` (Spring) ou `/openapi.json` (FastAPI). O token só é enviado à API aberta. Para testar contra a stack local do `database-console`, defina `VITE_API_AUTH` e `VITE_API_CORE` com `http://localhost:8081` e `http://localhost:8080` e abra o portal em uma origem liberada no CORS (por exemplo a porta 3000).

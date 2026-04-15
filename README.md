# Sette Log

Plataforma corporativa de gestao de frotas com frontend administrativo, API REST, MongoDB, autenticacao JWT, RBAC, auditoria, telemetria, rastreamento, manutencao, financeiro, compliance, BI e base preparada para IoT/eventos.

## ETAPA 1 - Arquitetura proposta

O projeto nasce como monorepo com separacao clara entre `backend` e `frontend`.

- API NestJS em camadas: controllers, services, DTOs, guards, interceptors e schemas.
- Banco MongoDB com Mongoose, colecoes operacionais e historicas.
- Autenticacao JWT com access token e refresh token hash no usuario.
- RBAC com perfis e permissoes granulares.
- Auditoria global para acoes de escrita.
- Frontend React com layout administrativo, rotas protegidas, React Query e componentes reutilizaveis.
- Redis preparado no Docker Compose para filas/cache e evolucao para ingestao assincrona.
- Swagger/OpenAPI em `/api/v1/docs`.

## ETAPA 2 - Stack final

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Leaflet, Zustand.
- Backend: Node.js, TypeScript, NestJS, Mongoose, Passport JWT, class-validator, Swagger, Helmet, rate limit.
- Banco: MongoDB.
- Infra: Docker Compose com MongoDB, Redis, API e Web.

## ETAPA 3 - Estrutura de pastas

```text
backend/
  src/
    auth/
    common/
    fleet/
    imports/
    users/
    app.module.ts
    main.ts
    seed.ts
frontend/
  src/
    components/
    features/
    lib/
    store/
docker-compose.yml
.env.example
```

## ETAPA 4 - Modelagem do banco

Colecoes criadas com timestamps, status e indices:

- `users`, `roles`
- `branches`, `vehicles`, `drivers`, `trackers`
- `telemetry_events`, `gps_positions`, `geofences`, `trips`
- `maintenance_plans`, `maintenance_orders`, `maintenance_history`
- `fuel_records`, `expenses`, `fines`, `incidents`, `insurances`
- `documents`, `compliance_checks`
- `notifications`, `alerts`, `audit_logs`
- `integrations`, `webhooks`, `settings`

Principais indices:

- `tenantId + plate` unico em veiculos.
- `tenantId + licenseNumber` unico em motoristas.
- `tenantId + email` unico em usuarios.
- `tenantId + vehicleId + occurredAt` em telemetria e GPS.
- `2dsphere` em posicoes e geocercas.
- `tenantId + status + triggeredAt` em alertas.
- `tenantId + actorUserId + createdAt` em auditoria.

## ETAPA 5 - Modulos e regras de negocio

Modulos implementados na base:

- Plataforma central: dashboard, KPIs, alertas e saude operacional.
- Rastreamento: snapshot ao vivo, posicoes, geocercas e playback.
- Telemetria: ingestao de eventos, atualizacao de veiculo e alertas.
- Manutencao: planos, ordens e historico.
- Motoristas: cadastro, CNH, score e vinculo com veiculo.
- Financeiro: abastecimentos, despesas, multas, sinistros e seguros.
- Compliance: documentos, checklists e auditoria.
- Integracoes: providers, webhooks e parametros.

Regras ja codificadas:

- Motorista principal nao pode ficar vinculado a dois veiculos.
- Veiculo nao pode receber motorista principal ja associado a outro veiculo.
- Documento vencido ou proximo do vencimento gera alerta.
- Abastecimento atualiza custo e litros acumulados do veiculo.
- Despesas, multas e sinistros impactam resumo financeiro do veiculo.
- Telemetria atualiza ultima posicao, status, resumo e GPS historico.
- Excesso de velocidade e bateria baixa geram alerta.
- Entrada/saida de geocerca circular gera alerta.
- Ordem em execucao move veiculo para manutencao; ordem fechada libera veiculo e registra historico.
- Acoes criticas geram log de auditoria.

## ETAPA 6 - Backend base

Endpoints principais:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/dashboard`
- `GET|POST|PATCH|DELETE /api/v1/vehicles`
- `GET|POST|PATCH /api/v1/drivers`
- `GET /api/v1/tracking/live`
- `GET /api/v1/tracking/vehicles/:vehicleId/playback`
- `POST /api/v1/telemetry/ingest`
- `GET|POST /api/v1/maintenance/plans`
- `GET|POST|PATCH /api/v1/maintenance/orders`
- `GET|POST /api/v1/finance/fuel-records`
- `GET|POST /api/v1/finance/expenses`
- `GET|POST /api/v1/finance/fines`
- `GET|POST /api/v1/finance/incidents`
- `GET|POST /api/v1/finance/insurances`
- `GET|POST /api/v1/compliance/documents`
- `GET|POST /api/v1/compliance/checks`
- `GET /api/v1/compliance/audit-logs`
- `GET|PATCH /api/v1/alerts`
- `GET|POST /api/v1/settings/branches`
- `GET|POST /api/v1/settings/integrations`
- `GET|POST /api/v1/settings/webhooks`
- `GET|POST /api/v1/settings/parameters`
- `POST /api/v1/imports/spreadsheet`

## Importacao de planilhas antigas

A tela `Configuracoes` permite subir planilhas de sistemas anteriores para migrar dados historicos. O backend tambem expoe o endpoint `POST /api/v1/imports/spreadsheet` com `multipart/form-data`.

Template pronto:

- Arquivo local: `templates/sette-log-importacao-template.xlsx`
- Download pela aplicacao: `http://localhost:5173/templates/sette-log-importacao-template.xlsx`

O template possui abas separadas: `veiculos`, `motoristas`, `abastecimentos`, `manutencoes` e `documentos`. Ao importar um XLSX com varias abas, o sistema usa a aba correspondente ao tipo selecionado na tela.

Formatos aceitos:

- `.csv`
- `.xlsx`

CSV pode usar separador por virgula, ponto e virgula ou tab. O importador tambem aceita datas em formato brasileiro, ISO ou serial numerico do Excel.

Tipos de importacao aceitos no campo `resource`:

- `vehicles`
- `drivers`
- `fuel-records`
- `maintenance-orders`
- `documents`

Ordem recomendada:

1. `vehicles`
2. `drivers`
3. `fuel-records`
4. `maintenance-orders`
5. `documents`

A primeira linha da planilha precisa conter cabecalhos. O importador aceita nomes comuns em portugues e ingles. Exemplos:

- Veiculos: `placa`, `marca`, `modelo`, `ano`, `tipo`, `odometro`, `centro_custo`
- Motoristas: `nome`, `cnh`, `categoria_cnh`, `validade_cnh`, `cpf`, `telefone`, `email`
- Abastecimentos: `placa`, `cnh`, `litros`, `valor_total`, `preco_litro`, `odometro`, `data_abastecimento`, `posto`, `combustivel`
- Manutencoes: `placa`, `tipo`, `prioridade`, `status`, `agendamento`, `odometro`, `valor`
- Documentos: `entidade`, `referencia`, `documento`, `numero`, `emissao`, `vencimento`, `url`

Planilhas de abastecimento, manutencao e documentos usam `placa` ou `cnh` para vincular os historicos aos cadastros ja importados. O limite atual e de 5000 linhas por arquivo para manter a importacao previsivel no ambiente inicial.

Reimportar veiculos, motoristas e documentos atualiza registros existentes quando encontra a mesma placa, CNH ou chave documental.

## ETAPA 7 - Frontend base

Telas criadas:

- Login.
- Dashboard principal.
- Gestao de veiculos.
- Rastreamento em tempo real com mapa.
- Gestao de motoristas.
- Manutencao.
- Financeiro.
- Compliance.
- Analytics e BI.
- Configuracoes.

## ETAPA 8 - Autenticacao e permissoes

Perfis seedados:

- `super_admin`
- `fleet_manager`
- `operator`
- `maintenance_analyst`
- `finance`
- `driver`
- `auditor`

Cada perfil expande permissoes via `ROLE_PERMISSIONS`. O guard global aceita `super_admin` como bypass e exige permissoes por endpoint com `@RequirePermissions`.

## ETAPA 9 - Dashboard e modulos iniciais

O dashboard agrega:

- Total de veiculos.
- Disponibilidade.
- Motoristas ativos.
- Alertas abertos.
- Custo de combustivel.
- Despesas.
- Preco medio por litro.
- Status operacional.
- Manutencao proxima.
- Documentos vencendo.

## ETAPA 10 - Como rodar

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

Instale dependencias:

```bash
npm install
```

Suba MongoDB e Redis:

```bash
docker compose up -d mongo redis
```

Rode os seeds:

```bash
npm run seed
```

Inicie API e frontend em terminais separados pela raiz:

```bash
npm run dev:backend
npm run dev:frontend
```

Ou rode cada projeto pela propria pasta:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Acesse:

- Web: `http://localhost:5173`
- API: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/api/v1/docs`

Credenciais iniciais:

```text
admin@settelog.local
admin123
```

## Onde alterar o banco de dados

Altere a variavel `MONGODB_URI` no arquivo `.env` na raiz do projeto:

```text
MONGODB_URI=mongodb://usuario:senha@host:porta/nome_do_banco?authSource=admin
```

Para o ambiente Docker local, o valor padrao e:

```text
MONGODB_URI=mongodb://root:root@localhost:27017/sette_log?authSource=admin
```

Tambem existem estes pontos relacionados:

- `.env.example`: modelo de variaveis para outros ambientes.
- `docker-compose.yml`: banco MongoDB local do Docker e nome do database inicial.
- `backend/src/app.module.ts`: fallback tecnico usado somente se `MONGODB_URI` nao existir.

Em producao, nao altere `app.module.ts`; configure `MONGODB_URI` no ambiente do servidor, container, CI/CD ou painel de deploy.

Tambem e possivel subir tudo com Docker:

```bash
docker compose up --build
```

## Evolucao planejada

A base ja considera `tenantId`, `branchId`, eventos de telemetria, historicos temporais, webhooks, integracoes e Redis. Isso deixa o sistema preparado para:

- App mobile do motorista.
- Ingestao MQTT/HTTP de rastreadores.
- Filas com BullMQ/Redis.
- Processamento assincrono de eventos.
- Scoring avancado de direcao.
- Modelos preditivos de manutencao.
- Multiempresa e SaaS.

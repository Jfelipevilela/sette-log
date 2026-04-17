# Sette Log

Plataforma corporativa de gestão de frotas com frontend administrativo, API REST, MongoDB, autenticação JWT, RBAC, auditoria, telemetria, rastreamento, manutenção, financeiro, compliance, BI e base preparada para IoT/eventos.

## ETAPA 1 - Arquitetura proposta

O projeto nasce como monorepo com separação clara entre `backend` e `frontend`.

- API NestJS em camadas: controllers, services, DTOs, guards, interceptors e schemas.
- Banco MongoDB com Mongoose, colecoes operacionais e historicas.
- Autenticação JWT com access token e refresh token hash no usuário.
- RBAC com perfis e permissoes granulares.
- Auditoria global para ações de escrita.
- Frontend React com layout administrativo, rotas protegidas, React Query e componentes reutilizaveis.
- Redis preparado no Docker Compose para filas/cache e evolucao para ingestão assincrona.
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

- `tenantId + plate` único em veículos.
- `tenantId + licenseNumber` único em motoristas.
- `tenantId + email` único em usuários.
- `tenantId + vehicleId + occurredAt` em telemetria e GPS.
- `2dsphere` em posições e geocercas.
- `tenantId + status + triggeredAt` em alertas.
- `tenantId + actorUserId + createdAt` em auditoria.

## ETAPA 5 - Modulos e regras de negocio

Modulos implementados na base:

- Plataforma central: dashboard, KPIs, alertas e saude operacional.
- Rastreamento: snapshot ao vivo, posições, geocercas e playback.
- Telemetria: ingestão de eventos, atualização de veículo e alertas.
- Manutenção: planos, ordens e histórico.
- Motoristas: cadastro, CNH, score e vínculo com veículo.
- Financeiro: abastecimentos, despesas, multas, sinistros e seguros.
- Compliance: documentos, checklists e auditoria.
- Integrações: providers, webhooks e parâmetros.

Regras já codificadas:

- Motorista principal não pode ficar vinculado a dois veículos.
- Veículo não pode receber motorista principal já associado a outro veículo.
- Documento vencido ou próximo do vencimento gera alerta.
- Abastecimento atualiza custo e litros acumulados do veículo.
- Despesas, multas e sinistros impactam resumo financeiro do veículo.
- Telemetria atualiza ultima posição, status, resumo e GPS histórico.
- Excesso de velocidade e bateria baixa geram alerta.
- Entrada/saida de geocerca circular gera alerta.
- Ordem em execução move veículo para manutenção; ordem fechada libera veículo e registra histórico.
- Ações críticas geram log de auditoria.

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
- `GET /api/v1/exports/:resource`

## Backup diario

O backend agenda automaticamente um backup diario do MongoDB quando a API sobe.
O arquivo e salvo em JSON compactado (`.json.gz`) na pasta configurada.

Variaveis:

- `BACKUP_ENABLED=true`
- `BACKUP_HOUR=2`
- `BACKUP_RETENTION_DAYS=30`
- `BACKUP_DIR=../backups/mongodb`

Padrao atual: gera um backup todos os dias as 02:00 e remove arquivos mais antigos que 30 dias.

## Exportação CSV

As telas principais possuem botão de exportação CSV. O backend exporta todos os registros do recurso, não apenas a página atual.

Recursos exportaveis:

- `vehicles`
- `drivers`
- `fuel-records`
- `maintenance-orders`
- `expenses`
- `fines`
- `incidents`
- `insurances`
- `documents`
- `compliance-checks`
- `alerts`
- `audit-logs`

## Importação de planilhas antigas

A tela `Configurações` permite subir planilhas de sistemas anteriores para migrar dados históricos. O backend tambem expoe o endpoint `POST /api/v1/imports/spreadsheet` com `multipart/form-data`.

Template pronto:

- Arquivo local: `templates/sette-log-importação-template.xlsx`
- Download pela aplicação: `http://localhost:5173/templates/sette-log-importação-template.xlsx`

O template possui abas separadas: `veiculos`, `motoristas`, `abastecimentos`, `manutenções` e `documentos`. Ao importar um XLSX com várias abas, o sistema usa a aba correspondente ao tipo selecionado na tela.

Formatos aceitos:

- `.csv`
- `.xlsx`

CSV pode usar separador por virgula, ponto e virgula ou tab. O importador tambem aceita datas em formato brasileiro, ISO ou serial numerico do Excel.

Tipos de importação aceitos no campo `resource`:

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

- Veículos: `placa`, `marca`, `modelo`, `ano`, `tipo`, `odometro`, `centro_custo`
- Motoristas: `nome`, `cnh`, `categoria_cnh`, `validade_cnh`, `cpf`, `telefone`, `email`
- Abastecimentos: `placa`, `cnh`, `litros`, `valor_total`, `preco_litro`, `odometro`, `data_abastecimento`, `posto`, `combustível`
- Manutenções: `placa`, `tipo`, `prioridade`, `status`, `agendamento`, `odometro`, `valor`
- Documentos: `entidade`, `referencia`, `documento`, `numero`, `emissao`, `vencimento`, `url`

Planilhas de abastecimento, manutenção e documentos usam `placa` ou `cnh` para vincular os históricos aos cadastros já importados. O limite atual e de 5000 linhas por arquivo para manter a importação previsível no ambiente inicial.

Reimportar veículos, motoristas e documentos atualiza registros existentes quando encontra a mesma placa, CNH ou chave documental.

## ETAPA 7 - Frontend base

Telas criadas:

- Login.
- Dashboard principal.
- Gestão de veículos.
- Rastreamento em tempo real com mapa.
- Gestão de motoristas.
- Manutenção.
- Financeiro.
- Compliance.
- Analytics e BI.
- Configurações.

## ETAPA 8 - Autenticação e permissoes

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

- Total de veículos.
- Disponibilidade.
- Motoristas ativos.
- Alertas abertos.
- Custo de combustível.
- Despesas.
- Preço médio por litro.
- Status operacional.
- Manutenção proxima.
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

Também existem estes pontos relacionados:

- `.env.example`: modelo de variaveis para outros ambientes.
- `docker-compose.yml`: banco MongoDB local do Docker e nome do database inicial.
- `backend/src/app.module.ts`: fallback tecnico usado somente se `MONGODB_URI` não existir.

Em producao, não altere `app.module.ts`; configure `MONGODB_URI` no ambiente do servidor, container, CI/CD ou painel de deploy.

Também é possível subir tudo com Docker:

```bash
docker compose up --build
```

## Evolução planejada

A base já considera `tenantId`, `branchId`, eventos de telemetria, históricos temporais, webhooks, integrações e Redis. Isso deixa o sistema preparado para:

- App mobile do motorista.
- Ingestão MQTT/HTTP de rastreadores.
- Filas com BullMQ/Redis.
- Processamento assincrono de eventos.
- Scoring avancado de direcao.
- Modelos preditivos de manutenção.
- Multiempresa e SaaS.

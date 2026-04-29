# Sette Log

Plataforma corporativa de gestão de frotas com frontend administrativo, API REST, MongoDB, autenticação JWT, RBAC, auditoria, manutenção, financeiro, compliance, BI e base preparada para integrações futuras.

## ETAPA 1 - Arquitetura proposta

O projeto foi estruturado como monorepo com separação clara entre `backend` e `frontend`.

- API NestJS em camadas: controllers, services, DTOs, guards, interceptors e schemas.
- MongoDB com Mongoose para dados operacionais e históricos.
- Autenticação JWT com access token e refresh token.
- RBAC com grupos, permissões granulares e trilha de auditoria.
- Frontend React com layout administrativo, rotas protegidas, React Query e componentes reutilizáveis.
- Redis preparado para cache e filas.
- Swagger em `/api/v1/docs`.

## ETAPA 2 - Stack final

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Leaflet e Zustand.
- Backend: Node.js, TypeScript, NestJS, Mongoose, Passport JWT, class-validator, Swagger, Helmet e rate limit.
- Banco de dados: MongoDB.
- Infraestrutura: Docker Compose com MongoDB, Redis, API e Web.

## ETAPA 3 - Estrutura de pastas

```text
backend/
  src/
    auth/
    common/
    fleet/
    users/
    backup/
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
docker-compose.prod.yml
.env.example
.env.production.example
```

## ETAPA 4 - Modelagem do banco

Coleções principais com timestamps, status e índices:

- `users`, `roles`
- `branches`, `vehicles`, `drivers`, `trackers`
- `telemetry_events`, `gps_positions`, `geofences`, `trips`
- `maintenance_plans`, `maintenance_orders`, `maintenance_history`
- `fuel_records`, `expenses`, `fines`, `incidents`, `insurances`
- `documents`, `compliance_checks`
- `notifications`, `alerts`, `audit_logs`
- `integrations`, `webhooks`, `settings`

Índices principais:

- `tenantId + plate` único em veículos
- `tenantId + licenseNumber` único em motoristas
- `tenantId + email` único em usuários
- `tenantId + vehicleId + occurredAt` em telemetria e GPS
- `2dsphere` em posições e geocercas
- `tenantId + status + triggeredAt` em alertas
- `tenantId + actorUserId + createdAt` em auditoria

## ETAPA 5 - Módulos e regras de negócio

Módulos já implementados:

- Dashboard operacional
- Veículos
- Motoristas
- Manutenção
- Abastecimentos
- Financeiro
- Compliance
- Configurações
- Importação, exportação e backup

Regras importantes já aplicadas:

- Um motorista principal não pode estar vinculado a dois veículos ao mesmo tempo.
- Documento vencido ou próximo do vencimento gera alerta.
- Abastecimento atualiza custos e consumo do veículo.
- Despesas, multas e sinistros impactam o resumo financeiro.
- Ordens de serviço em execução impactam o status operacional do veículo.
- OS finalizada não pode mais ser editada.
- Veículo com OS em execução não pode ter status alterado.
- Ações críticas geram log de auditoria.

## ETAPA 6 - Backend base

Endpoints principais:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/dashboard`
- `GET|POST|PATCH|DELETE /api/v1/vehicles`
- `GET|POST|PATCH|DELETE /api/v1/drivers`
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
- `GET /api/v1/settings/system-export`
- `GET /api/v1/settings/backups`
- `POST /api/v1/settings/backups/run`
- `GET /api/v1/settings/backups/:fileName`
- `POST /api/v1/imports/spreadsheet`

## Backup diário

O backend agenda backup diário automaticamente quando a API sobe.

Estratégia atual:

- tenta usar `mongodump` e gerar arquivo `.archive.gz`
- se `mongodump` não estiver disponível, usa fallback `.json.gz`
- remove arquivos antigos conforme a retenção configurada

Variáveis:

- `BACKUP_ENABLED=true`
- `BACKUP_HOUR=2`
- `BACKUP_RETENTION_DAYS=30`
- `BACKUP_DIR=../backups/mongodb`
- `MONGODUMP_PATH=mongodump`
- `MONGODUMP_READ_PREFERENCE=secondaryPreferred`

Endpoints:

- `GET /api/v1/settings/backups`
- `POST /api/v1/settings/backups/run`
- `GET /api/v1/settings/backups/:fileName`

## Exportação CSV

As telas principais possuem exportação CSV. O backend exporta todos os registros do recurso, não apenas a página atual.

Recursos exportáveis:

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

A tela `Configurações` permite subir planilhas de sistemas anteriores para migrar dados históricos.

Endpoint:

- `POST /api/v1/imports/spreadsheet`

Formatos aceitos:

- `.csv`
- `.xlsx`

CSV pode usar vírgula, ponto e vírgula ou tab. O importador também aceita datas em formato brasileiro, ISO e serial numérico do Excel.

Tipos aceitos no campo `resource`:

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

O template possui abas separadas para:

- `veiculos`
- `motoristas`
- `abastecimentos`
- `manutencoes`
- `despesas`
- `documentos`

## ETAPA 7 - Frontend base

Telas principais:

- Login
- Dashboard principal
- Veículos
- Motoristas
- Manutenção
- Abastecimentos
- Financeiro
- Compliance
- BI e Relatórios
- Configurações
- Documentação pública da API

## ETAPA 8 - Autenticação e permissões

Perfis e grupos:

- `super_admin`
- grupos editáveis por tenant

O `super_admin` é o único grupo de sistema e recebe todas as permissões possíveis.

O sistema já suporta permissões por ação, com granularidade de:

- visualização
- criação
- edição
- exclusão
- exportação
- acessos específicos, como portal do técnico

## ETAPA 9 - Dashboard e módulos iniciais

O dashboard agrega:

- total de veículos
- disponibilidade
- motoristas ativos
- alertas abertos
- custo total
- combustível
- manutenção
- outras despesas
- custo por dia
- histórico 12 meses
- ranking de consumo
- ranking de maior gasto
- abastecimento por veículo

## ETAPA 10 - Como rodar

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Instale as dependências:

```bash
npm install
```

Suba MongoDB e Redis:

```bash
docker compose up -d mongo redis
```

Rode o seed:

```bash
npm run seed
```

Inicie backend e frontend em terminais separados, pela raiz:

```bash
npm run dev:backend
npm run dev:frontend
```

Ou rode cada projeto pela própria pasta:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Acessos:

- Web: `http://localhost:5173`
- API: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/api/v1/docs`

Credenciais iniciais:

```text
admin@settelog.local
admin123
```

## Onde alterar o banco de dados

Altere a variável `MONGODB_URI` no arquivo `.env` na raiz do projeto:

```text
MONGODB_URI=mongodb://usuario:senha@host:porta/nome_do_banco?authSource=admin
```

Para o ambiente Docker local, o valor padrão é:

```text
MONGODB_URI=mongodb://root:root@localhost:27017/sette_log?authSource=admin
```

Pontos relacionados:

- `.env.example`
- `docker-compose.yml`
- `backend/src/app.module.ts`

Em produção, não altere `app.module.ts`. Configure `MONGODB_URI` no ambiente do servidor, container, CI/CD ou painel de deploy.

Também é possível subir tudo com Docker:

```bash
docker compose up --build
```

## Produção

O projeto já está preparado para subir em container com:

- `docker-compose.prod.yml`
- `.env.production.example`
- proxy interno do frontend para `/api/v1`
- healthchecks de `mongo`, `redis`, `api` e `web`
- backup com preferência por `mongodump`

### 1. Preparar variáveis de ambiente

Crie o arquivo `.env.production` a partir do exemplo:

```bash
cp .env.production.example .env.production
```

No Windows PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

Revise obrigatoriamente:

- `MONGO_INITDB_ROOT_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `MONGODB_URI`, se usar Mongo externo

### 2. Subir em produção

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

O frontend publica a aplicação na porta `80` e faz proxy de `/api/*` para o container `api`.

### 3. Popular dados iniciais

Depois dos containers subirem, execute o seed:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run seed
```

Credenciais padrão do seed:

- email: `admin@settelog.local`
- senha: `admin123`

Troque essa senha após o primeiro acesso.

### 4. Validar o ambiente

Endpoints importantes:

- aplicação: `http://SEU_HOST/`
- healthcheck simples: `http://SEU_HOST/api/v1/health`
- readiness: `http://SEU_HOST/api/v1/health/ready`
- Swagger: `http://SEU_HOST/api/v1/docs`

Checks esperados:

- `/api/v1/health` retorna `status: ok`
- `/api/v1/health/ready` retorna `status: ready`
- login do `super_admin` funciona
- `Configurações > Exportação e backup` gera exportação e backup manual

### 5. Backup

O backup do sistema funciona assim:

1. tenta gerar snapshot com `mongodump` em `.archive.gz`
2. se `mongodump` não estiver disponível, usa fallback `.json.gz`

No compose de produção, a imagem da API já instala `mongodb-database-tools`, incluindo `mongodump`.

Valide no servidor:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api mongodump --version
```

Se esse comando falhar, o backup continuará funcional, mas cairá no fallback JSON compactado.

### 6. Arquivos persistidos

O compose de produção usa:

- `./backups` para backups
- `./storage/uploads` para anexos

Isso funciona, mas para produção mais robusta o ideal é mover anexos para storage externo:

- Amazon S3
- Cloudflare R2
- Azure Blob Storage

### 7. Recomendações objetivas de deploy

- coloque a aplicação atrás de HTTPS
- use domínio real
- restrinja ou desative o Swagger em produção
- use segredos fortes para JWT
- teste restore de backup periodicamente
- monitore o espaço em disco de `backups` e `storage/uploads`

## MongoDB e volume de dados

Para o cenário atual, sem telemetria pesada em produção, o MongoDB atende bem.

Os pontos que mais crescem neste sistema:

- anexos
- histórico de abastecimentos
- auditoria
- manutenções
- documentos

O MongoDB suporta esse cenário desde que você mantenha:

- índices corretos
- backup validado
- storage adequado para anexos
- retenção para dados que crescerem muito no futuro

## Evolução planejada

A base já considera `tenantId`, `branchId`, eventos, webhooks, integrações e Redis. Isso deixa o sistema preparado para:

- app mobile do motorista
- ingestão MQTT/HTTP de rastreadores
- filas com BullMQ/Redis
- processamento assíncrono de eventos
- scoring avançado de direção
- modelos preditivos de manutenção
- multiempresa e SaaS

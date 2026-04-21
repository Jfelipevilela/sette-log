# API Endpoints

Este arquivo documenta os endpoints atuais da API do sistema `SETTE Log`.

Base padrão:

```text
http://localhost:3333/api/v1
```

Autenticação:

- Login JWT:
  - `Authorization: Bearer <access_token>`
- Token de API por usuário:
  - `Authorization: Bearer slapi_xxxxxxxxx`

Observações:

- Quase todas as rotas são multi-tenant e retornam dados filtrados pelo `tenantId` do usuário autenticado.
- Listagens normalmente aceitam:
  - `page`
  - `limit`
  - `search`
  - `sortBy`
  - `sortDir`
  - `filters` em JSON stringificado
- Resposta paginada padrão:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 120,
    "totalPages": 12
  }
}
```

## Auth

### `POST /auth/login`
Autentica um usuário por email e senha.

Retorna:
- `user`
- `accessToken`
- `refreshToken`

### `POST /auth/refresh`
Gera novos tokens a partir do `refreshToken`.

Retorna:
- `user`
- `accessToken`
- `refreshToken`

### `POST /auth/logout`
Encerra a sessão atual.

Retorna:
- `{ success: true }`

## Dashboard

### `GET /dashboard`
Retorna o resumo consolidado da operação.

Parâmetros:
- `from`
- `to`

Pode trazer:
- KPIs gerais
- veículos por status
- veículos críticos
- manutenções próximas
- documentos vencendo
- custos por dia
- custos por mês
- combustível por veículo
- ranking de maior gasto
- combustível por tipo
- alertas recentes
- período do dashboard
- data de geração

## Exports

### `GET /exports/:resource`
Exporta dados em CSV.

Resources suportados:
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

Retorna:
- arquivo CSV para download

## Vehicles

### `GET /vehicles`
Lista veículos da frota.

Pode trazer:
- placa
- marca
- modelo
- apelido
- tipo
- status
- odômetro
- cidade
- setor
- centro de custo
- motorista principal
- última posição
- resumo financeiro
- resumo de telemetria

### `GET /vehicles/:id`
Retorna um veículo específico.

### `POST /vehicles`
Cria um veículo.

### `PATCH /vehicles/:id`
Atualiza um veículo.

### `DELETE /vehicles/:id`
Remove um veículo.

## Drivers

### `GET /drivers`
Lista motoristas.

Pode trazer:
- nome
- CNH
- categoria
- validade da CNH
- email
- telefone
- status
- score
- veículo vinculado

### `GET /drivers/:id`
Retorna um motorista específico.

### `POST /drivers`
Cria um motorista.

### `PATCH /drivers/:id`
Atualiza um motorista.

### `DELETE /drivers/:id`
Remove um motorista.

## Tracking

### `GET /tracking/live`
Retorna snapshot ao vivo do rastreamento.

Pode trazer:
- veículos com posição atual
- geocercas
- timestamp de atualização

### `GET /tracking/positions`
Lista posições GPS históricas.

Pode trazer:
- coordenadas
- data/hora
- velocidade
- veículo vinculado

### `GET /tracking/vehicles/:vehicleId/playback`
Retorna rota histórica para playback.

Parâmetros:
- `from`
- `to`

Pode trazer:
- pontos da rota
- velocidade por ponto
- horário de cada posição

### `GET /tracking/geofences`
Lista geocercas.

### `POST /tracking/geofences`
Cria geocerca.

## Telemetry

### `GET /telemetry/events`
Lista eventos de telemetria.

Pode trazer:
- velocidade
- ignição
- bateria
- temperatura
- odômetro
- tipo do evento
- payload do evento

### `POST /telemetry/ingest`
Ingestão de evento de telemetria.

## Maintenance

### `GET /maintenance/plans`
Lista planos de manutenção.

Pode trazer:
- nome do plano
- tipo
- periodicidade
- vínculo com veículo

### `POST /maintenance/plans`
Cria plano de manutenção.

### `GET /maintenance/orders`
Lista ordens de serviço.

Pode trazer:
- veículo
- tipo
- prioridade
- status
- data agendada
- odômetro
- custo total
- anexos

### `POST /maintenance/orders`
Cria ordem de serviço.

### `PATCH /maintenance/orders/:id`
Atualiza ordem de serviço.

### `DELETE /maintenance/orders/:id`
Remove ordem de serviço.

## Finance

### `GET /finance/fuel-records`
Lista abastecimentos.

Pode trazer:
- veículo
- motorista
- litros
- valor total
- preço por litro
- odômetro
- distância
- km/l
- data do abastecimento
- posto
- tipo de combustível
- anexos

### `GET /finance/fuel-records/summary`
Resumo consolidado de abastecimentos.

Pode trazer:
- quantidade de lançamentos
- litros totais
- custo total
- km analisados
- litros usados no cálculo de eficiência
- preço médio por litro
- km/l médio

### `POST /finance/fuel-records`
Cria abastecimento.

### `PATCH /finance/fuel-records/:id`
Atualiza abastecimento.

### `DELETE /finance/fuel-records/:id`
Remove abastecimento.

### `POST /finance/fuel-records/:id/attachments`
Anexa arquivo a um abastecimento.

Pode receber:
- `file`

### `GET /finance/fuel-records/:id/attachments/:fileName`
Baixa ou abre anexo de abastecimento.

### `GET /finance/:resource`
Lista recursos financeiros genéricos.

Resources suportados:
- `expenses`
- `fines`
- `incidents`
- `insurances`

Pode trazer:
- despesas operacionais
- multas
- sinistros
- seguros

### `POST /finance/:resource`
Cria item financeiro.

### `PATCH /finance/:resource/:id`
Atualiza item financeiro.

### `DELETE /finance/:resource/:id`
Remove item financeiro.

## Compliance

### `GET /compliance/documents`
Lista documentos.

Pode trazer:
- tipo do documento
- entidade relacionada
- número
- emissão
- vencimento
- status
- URL/arquivo

### `POST /compliance/documents`
Cria documento.

### `PATCH /compliance/documents/:id`
Atualiza documento.

### `DELETE /compliance/documents/:id`
Remove documento.

### `GET /compliance/checks`
Lista checklists de compliance.

Pode trazer:
- veículo
- motorista
- versão do checklist
- status
- itens
- observações
- anexos
- data da execução

### `POST /compliance/checks`
Cria checklist.

### `PATCH /compliance/checks/:id`
Atualiza checklist.

### `DELETE /compliance/checks/:id`
Remove checklist.

### `POST /compliance/checks/:id/attachments`
Anexa arquivos a um checklist.

Pode receber:
- `files[]`

### `GET /compliance/checks/:id/attachments/:fileName`
Baixa ou abre anexo de checklist.

### `GET /compliance/audit-logs`
Lista logs de auditoria.

Pode trazer:
- ator
- ação
- recurso
- rota
- método
- status
- data/hora

### `GET /compliance/audit-logs/entity/:id`
Retorna a trilha de auditoria de uma entidade específica.

## Alerts

### `GET /alerts`
Lista alertas operacionais.

Pode trazer:
- tipo
- severidade
- status
- veículo
- motorista
- payload
- data do disparo

### `PATCH /alerts/:id`
Atualiza alerta.

## Settings

### `GET /settings/branches`
Lista filiais/unidades.

### `POST /settings/branches`
Cria filial/unidade.

### `GET /settings/integrations`
Lista integrações.

Pode trazer:
- tipo
- provedor
- configuração
- status

### `POST /settings/integrations`
Cria integração.

### `GET /settings/webhooks`
Lista webhooks.

Pode trazer:
- nome
- URL
- evento
- segredo
- status

### `POST /settings/webhooks`
Cria webhook.

### `GET /settings/parameters`
Lista parâmetros/configurações do sistema.

Pode trazer:
- chave
- valor
- escopo

### `POST /settings/parameters`
Cria ou atualiza parâmetro.

## Notifications

### `GET /notifications`
Lista notificações do usuário atual.

Pode trazer:
- título
- mensagem
- status
- data de criação
- data de leitura

### `POST /notifications/:id/read`
Marca notificação como lida.

## Imports

### `GET /imports/template`
Baixa a planilha base de importação.

Retorna:
- arquivo XLSX

### `POST /imports/spreadsheet`
Importa uma planilha de um recurso específico.

Campos esperados:
- `resource`
- `file`
- `recalculateFuelTotal` opcional

Resources suportados:
- `vehicles`
- `drivers`
- `fuel-records`
- `maintenance-orders`
- `documents`

Pode retornar:
- quantidade importada
- quantidade atualizada
- quantidade com falha
- erros por linha

### `POST /imports/spreadsheet/complete`
Importa planilha completa legada.

Campos esperados:
- `file`
- `recalculateFuelTotal` opcional

Pode retornar:
- resumo geral
- total por recurso
- inseridos
- atualizados
- falhas
- erros

## Users

### `GET /users`
Lista usuários.

Pode trazer:
- nome
- email
- perfil
- permissões
- status
- filial
- datas de criação/atualização
- status de acesso à API
- preview do token de API
- data da última geração do token

### `POST /users`
Cria usuário.

### `PATCH /users/:id`
Atualiza usuário.

### `POST /users/:id/api-access`
Gera ou regenera token de API para o usuário.

Retorna:
- `user`
- `apiToken` completo

Importante:
- o token completo é mostrado apenas no momento da geração
- depois o sistema armazena somente o hash

### `DELETE /users/:id/api-access`
Revoga o acesso à API do usuário.

Retorna:
- usuário atualizado, com acesso à API removido

### `DELETE /users/:id`
Remove usuário.

## Exemplo de uso com token de API

```bash
curl --request GET \
  --url http://localhost:3333/api/v1/dashboard \
  --header "Authorization: Bearer slapi_xxxxxxxxxxxxxxxxx"
```

## Observação sobre Swagger

Se a aplicação estiver rodando, a documentação interativa também pode ser consultada no Swagger configurado pelo backend.

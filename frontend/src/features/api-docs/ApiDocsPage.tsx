import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileCode2,
  Fuel,
  KeyRound,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { api } from "../../lib/api";
import { notify } from "../../lib/toast";

type ApiModule =
  | "auth"
  | "dashboard"
  | "vehicles"
  | "drivers"
  | "fuel"
  | "notifications"
  | "users";

type EndpointDoc = {
  id: string;
  module: ApiModule;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  tags: string[];
  requiredFields?: string[];
  optionalFields?: string[];
  requestBody?: string;
  requestExample?: string;
  responseExample: string;
};

const baseUrl = api.defaults.baseURL ?? "http://localhost:3333/api/v1";

const moduleMeta: Record<
  ApiModule | "all",
  {
    label: string;
    icon: typeof FileCode2;
    tone: "green" | "amber" | "cyan" | "red" | "blue" | "neutral";
  }
> = {
  all: { label: "Todos", icon: FileCode2, tone: "neutral" },
  auth: { label: "Autenticacao", icon: KeyRound, tone: "blue" },
  dashboard: { label: "Dashboard", icon: LayoutDashboard, tone: "cyan" },
  vehicles: { label: "Veiculos", icon: Car, tone: "green" },
  drivers: { label: "Motoristas", icon: UsersRound, tone: "amber" },
  fuel: { label: "Abastecimentos", icon: Fuel, tone: "green" },
  notifications: { label: "Notificacoes", icon: AlertTriangle, tone: "red" },
  users: { label: "Usuarios e API", icon: ShieldCheck, tone: "neutral" },
};

const endpointDocs: EndpointDoc[] = [
  {
    id: "auth-login",
    module: "auth",
    method: "POST",
    path: "/auth/login",
    title: "Login",
    description: "Autentica o usuario e devolve os tokens da sessao.",
    tags: ["token", "publico", "login"],
    requiredFields: ["email", "password"],
    requestBody: `{
  "email": "admin@settelog.local",
  "password": "123456"
}`,
    requestExample: `POST ${baseUrl}/auth/login
Content-Type: application/json

{
  "email": "admin@settelog.local",
  "password": "123456"
}`,
    responseExample: `{
  "user": {
    "_id": "661fd3b1d54d32d4c2450a01",
    "name": "Administrador Sette Log",
    "email": "admin@settelog.local",
    "tenantId": "sette-demo",
    "roles": ["super_admin"],
    "permissions": ["*"]
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi..."
}`,
  },
  {
    id: "dashboard-main",
    module: "dashboard",
    method: "GET",
    path: "/dashboard?from=2026-04-01&to=2026-04-30",
    title: "Dashboard operacional",
    description: "Consolida KPIs, custos, alertas e graficos do periodo.",
    tags: ["kpi", "analytics", "periodo"],
    requiredFields: ["from", "to"],
    responseExample: `{
  "kpis": {
    "totalVehicles": 13,
    "availableVehicles": 13,
    "activeDrivers": 2,
    "openAlerts": 10,
    "availability": 100,
    "totalFuelCost": 3240.61,
    "totalFuelLiters": 500.54,
    "totalMaintenanceCost": 0,
    "totalExpenseCost": 13844,
    "totalOperationalCost": 17084.61,
    "averageFuelCost": 6.47
  },
  "recentAlerts": [
    {
      "_id": "6629804ef41417dd3575666a",
      "type": "maintenance_due",
      "severity": "warning",
      "status": "open"
    }
  ]
}`,
  },
  {
    id: "vehicles-list",
    module: "vehicles",
    method: "GET",
    path: "/vehicles?page=1&limit=20&search=SSL7C24",
    title: "Listar veiculos",
    description: "Retorna veiculos paginados com busca, ordenacao e filtros.",
    tags: ["pagination", "search", "fleet"],
    optionalFields: ["page", "limit", "search", "filters", "sortBy", "sortDir"],
    responseExample: `{
  "data": [
    {
      "_id": "661fd74fd54d32d4c2450a45",
      "plate": "SSL7C24",
      "brand": "Fiat",
      "model": "Mobi",
      "nickname": "Quality",
      "type": "car",
      "status": "available",
      "currentOdometerKm": 53842,
      "tankCapacityLiters": 47,
      "sector": "Operacoes",
      "city": "Manaus"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}`,
  },
  {
    id: "vehicles-create",
    module: "vehicles",
    method: "POST",
    path: "/vehicles",
    title: "Criar veiculo",
    description: "Cria um veiculo com odometro inicial e dados operacionais.",
    tags: ["create", "vehicle"],
    requiredFields: [
      "plate",
      "brand",
      "model",
      "type",
      "status",
      "initialOdometerKm",
    ],
    optionalFields: [
      "nickname",
      "year",
      "tankCapacityLiters",
      "sector",
      "city",
    ],
    requestBody: `{
  "plate": "ABC1D23",
  "brand": "Fiat",
  "model": "Mobi",
  "nickname": "Entrega 01",
  "year": 2024,
  "type": "car",
  "status": "available",
  "initialOdometerKm": 12000,
  "tankCapacityLiters": 47,
  "sector": "Distribuicao",
  "city": "Manaus"
}`,
    requestExample: `POST ${baseUrl}/vehicles
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "plate": "ABC1D23",
  "brand": "Fiat",
  "model": "Mobi",
  "nickname": "Entrega 01",
  "year": 2024,
  "type": "car",
  "status": "available",
  "initialOdometerKm": 12000,
  "tankCapacityLiters": 47,
  "sector": "Distribuicao",
  "city": "Manaus"
}`,
    responseExample: `{
  "_id": "6629812ef41417dd357566a1",
  "plate": "ABC1D23",
  "brand": "Fiat",
  "model": "Mobi",
  "status": "available",
  "odometerKm": 12000,
  "currentOdometerKm": 12000,
  "tankCapacityLiters": 47
}`,
  },
  {
    id: "drivers-list",
    module: "drivers",
    method: "GET",
    path: "/drivers?page=1&limit=20",
    title: "Listar motoristas",
    description: "Retorna motoristas, categorias da CNH, score e status.",
    tags: ["drivers", "pagination", "score"],
    optionalFields: ["page", "limit", "search", "filters", "sortBy", "sortDir"],
    responseExample: `{
  "data": [
    {
      "_id": "66298167f41417dd357566bc",
      "name": "Davi de Sousa Campos",
      "licenseNumber": "12345678901",
      "licenseCategory": "A,B",
      "licenseExpiresAt": "2027-06-01T00:00:00.000Z",
      "status": "active",
      "score": 91
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}`,
  },
  {
    id: "fuel-create",
    module: "fuel",
    method: "POST",
    path: "/finance/fuel-records",
    title: "Criar abastecimento",
    description:
      "Registra litros, valor, posto e odometro. O backend valida tanque e odometro atual.",
    tags: ["fuel", "finance", "validation"],
    requiredFields: [
      "vehicleId",
      "fuelType",
      "filledAt",
      "liters",
      "totalCost",
      "odometerKm",
    ],
    optionalFields: ["driverId", "station", "pricePerLiter", "attachments"],
    requestBody: `{
  "vehicleId": "661fd74fd54d32d4c2450a45",
  "driverId": "66298167f41417dd357566bc",
  "fuelType": "gasoline",
  "filledAt": "2026-04-24T10:30:00.000Z",
  "station": "Posto Tomatao",
  "liters": 35.2,
  "pricePerLiter": 6.59,
  "totalCost": 231.97,
  "odometerKm": 53842
}`,
    requestExample: `POST ${baseUrl}/finance/fuel-records
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "vehicleId": "661fd74fd54d32d4c2450a45",
  "driverId": "66298167f41417dd357566bc",
  "fuelType": "gasoline",
  "filledAt": "2026-04-24T10:30:00.000Z",
  "station": "Posto Tomatao",
  "liters": 35.2,
  "pricePerLiter": 6.59,
  "totalCost": 231.97,
  "odometerKm": 53842
}`,
    responseExample: `{
  "_id": "66298212f41417dd357566df",
  "vehicleId": "661fd74fd54d32d4c2450a45",
  "fuelType": "gasoline",
  "liters": 35.2,
  "totalCost": 231.97,
  "odometerKm": 53842,
  "distanceKm": 264,
  "kmPerLiter": 7.5
}`,
  },
  {
    id: "notifications-list",
    module: "notifications",
    method: "GET",
    path: "/notifications?limit=10&sortBy=createdAt&sortDir=desc",
    title: "Listar notificacoes",
    description: "Busca as notificacoes do usuario logado.",
    tags: ["notifications", "ui", "feed"],
    optionalFields: ["limit", "sortBy", "sortDir"],
    responseExample: `{
  "data": [
    {
      "_id": "66298268f41417dd35756714",
      "title": "Veiculo cadastrado",
      "message": "O veiculo ABC1D23 foi criado com sucesso.",
      "status": "unread",
      "createdAt": "2026-04-24T12:01:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}`,
  },
  {
    id: "users-api-access",
    module: "users",
    method: "POST",
    path: "/users/:id/api-access",
    title: "Gerar token de API",
    description:
      "Habilita o acesso via API para o usuario e devolve o token completo uma vez.",
    tags: ["api-token", "security", "users"],
    requiredFields: ["id"],
    requestExample: `POST ${baseUrl}/users/66298167f41417dd357566bc/api-access
Authorization: Bearer SEU_TOKEN`,
    responseExample: `{
  "user": {
    "_id": "66298167f41417dd357566bc",
    "name": "Integrador ERP",
    "email": "erp@empresa.com",
    "apiAccessEnabled": true,
    "apiTokenPreview": "slapi_df06...228682"
  },
  "apiToken": "slapi_df06c2b0d4be4f9b9fd74b7f228682"
}`,
  },
];

const errorCodes = [
  ["400", "Payload malformado ou parametro invalido."],
  ["401", "Token ausente, invalido ou sessao expirada."],
  ["403", "Usuario sem permissao para a acao."],
  ["404", "Recurso nao encontrado para o tenant atual."],
  ["409", "Conflito de negocio."],
  ["422", "Validacao negada pelo backend."],
  ["429", "Muitas requisicoes em sequencia."],
  ["500", "Erro interno do servidor."],
];

function methodTone(method: EndpointDoc["method"]) {
  if (method === "GET") return "cyan";
  if (method === "POST") return "green";
  if (method === "PATCH") return "amber";
  return "red";
}

function getPostmanCollection() {
  return JSON.stringify(
    {
      info: {
        name: "SETTE Log API",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      variable: [
        { key: "baseUrl", value: baseUrl },
        { key: "token", value: "SEU_TOKEN" },
      ],
      item: endpointDocs.map((endpoint) => ({
        name: endpoint.title,
        request: {
          method: endpoint.method,
          header:
            endpoint.path === "/auth/login"
              ? [{ key: "Content-Type", value: "application/json" }]
              : [
                  { key: "Authorization", value: "Bearer {{token}}" },
                  { key: "Content-Type", value: "application/json" },
                ],
          body: endpoint.requestBody
            ? {
                mode: "raw",
                raw: endpoint.requestBody,
                options: { raw: { language: "json" } },
              }
            : undefined,
          url: {
            raw: `{{baseUrl}}${endpoint.path}`,
          },
        },
      })),
    },
    null,
    2,
  );
}

function getInsomniaCollection() {
  return JSON.stringify(
    {
      _type: "export",
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: "sette-log-web",
      resources: endpointDocs.map((endpoint, index) => ({
        _id: `req_sette_${index + 1}`,
        _type: "request",
        parentId: "wrk_sette_log",
        name: endpoint.title,
        method: endpoint.method,
        url: `{{ base_url }}${endpoint.path}`,
        body: endpoint.requestBody
          ? { mimeType: "application/json", text: endpoint.requestBody }
          : {},
        headers:
          endpoint.path === "/auth/login"
            ? [{ name: "Content-Type", value: "application/json" }]
            : [
                { name: "Authorization", value: "Bearer {{ token }}" },
                { name: "Content-Type", value: "application/json" },
              ],
      })),
    },
    null,
    2,
  );
}

function JsonBlock({ value, onCopy }: { value: string; onCopy: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Exemplo
        </span>
        <Button variant="secondary" size="sm" onClick={onCopy}>
          <Copy size={14} />
          Copiar
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function ApiDocsPage() {
  const [activeModule, setActiveModule] =
    useState<keyof typeof moduleMeta>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string>("auth-login");

  const postmanCollection = useMemo(() => getPostmanCollection(), []);
  const insomniaCollection = useMemo(() => getInsomniaCollection(), []);

  const filteredEndpoints = useMemo(() => {
    return endpointDocs.filter((endpoint) => {
      const moduleMatches =
        activeModule === "all" || endpoint.module === activeModule;
      const queryMatches =
        !query.trim() ||
        `${endpoint.title} ${endpoint.path} ${endpoint.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return moduleMatches && queryMatches;
    });
  }, [activeModule, query]);

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    notify({
      title: "Conteudo copiado",
      description: `${label} foi copiado para a area de transferencia.`,
      tone: "success",
    });
  }

  function downloadText(value: string, fileName: string) {
    const blob = new Blob([value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4f1_0%,#f4f8f6_24%,#ecf2f5_100%)]">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="overflow-hidden rounded-lg border border-emerald-950/25 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.34),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.18),transparent_20%),linear-gradient(135deg,#020908_0%,#081311_34%,#0d1725_100%)] text-white shadow-[0_22px_50px_rgba(2,12,12,0.28)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] xl:p-8">
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  API do SETTE Log
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-100">
                  Documentacao publica para integrar com veiculos, motoristas,
                  abastecimentos, dashboard e tokens de API. Exemplos recolhidos
                  por padrao para a pagina respirar melhor.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    downloadText(
                      postmanCollection,
                      "sette-log-postman-collection.json",
                    )
                  }
                >
                  <Download size={16} />
                  Postman
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadText(
                      insomniaCollection,
                      "sette-log-insomnia-export.json",
                    )
                  }
                >
                  <Download size={16} />
                  Insomnia
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => copyText(postmanCollection, "Colecao Postman")}
                >
                  <Copy size={16} />
                  Copiar colecao
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/14 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                  Base URL
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-white">
                  {baseUrl}
                </div>
              </div>
              <div className="rounded-lg border border-white/14 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                  Auth
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  Bearer SEU_TOKEN
                </div>
              </div>
              <div className="rounded-lg border border-white/14 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                  Endpoints
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  {endpointDocs.length}
                </div>
              </div>
              <div className="rounded-lg border border-white/14 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                  Erros mapeados
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  {errorCodes.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Filtrar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-fleet-line bg-white px-3 py-2">
                  <Search size={16} className="text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar rota ou tag"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                </div>
                <div className="space-y-2">
                  {(
                    Object.keys(moduleMeta) as Array<keyof typeof moduleMeta>
                  ).map((key) => {
                    const item = moduleMeta[key];
                    const Icon = item.icon;
                    const active = activeModule === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveModule(key)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
                          active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm"
                            : "border-slate-200 bg-white text-zinc-600 hover:border-emerald-200 hover:bg-emerald-50/40"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon size={16} />
                          {item.label}
                        </span>
                        <Badge tone={item.tone}>
                          {key === "all"
                            ? endpointDocs.length
                            : endpointDocs.filter(
                                (entry) => entry.module === key,
                              ).length}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Erros HTTP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {errorCodes.map(([code, text]) => (
                  <div
                    key={code}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={Number(code) >= 500 ? "red" : "amber"}>
                        {code}
                      </Badge>
                      <span className="text-sm text-zinc-600">{text}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-4">
            {filteredEndpoints.map((endpoint) => {
              const isOpen = openId === endpoint.id;
              const Icon = moduleMeta[endpoint.module].icon;
              return (
                <Card
                  key={endpoint.id}
                  className="overflow-hidden bg-white/88 backdrop-blur"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? "" : endpoint.id)}
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={methodTone(endpoint.method)}>
                          {endpoint.method}
                        </Badge>
                        <Badge tone={moduleMeta[endpoint.module].tone}>
                          <span className="inline-flex items-center gap-1">
                            <Icon size={12} />
                            {moduleMeta[endpoint.module].label}
                          </span>
                        </Badge>
                        <code className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-fleet-ink">
                          {endpoint.path}
                        </code>
                      </div>
                      <div className="max-w-3xl">
                        <h3 className="text-base font-semibold text-fleet-ink">
                          {endpoint.title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {endpoint.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {endpoint.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-zinc-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`mt-1 shrink-0 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <CardContent className="border-t border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,0.94)_100%)]">
                      <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                        <div className="space-y-4">
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Obrigatorios
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {endpoint.requiredFields?.length ? (
                                endpoint.requiredFields.map((field) => (
                                  <Badge key={field} tone="green">
                                    {field}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  Sem campos obrigatorios no exemplo atual.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              Opcionais
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {endpoint.optionalFields?.length ? (
                                endpoint.optionalFields.map((field) => (
                                  <Badge key={field} tone="neutral">
                                    {field}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  Nenhum campo opcional destacado.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {endpoint.requestExample && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  copyText(
                                    endpoint.requestExample ?? "",
                                    `Requisicao ${endpoint.title}`,
                                  )
                                }
                              >
                                <Copy size={14} />
                                Copiar request
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                copyText(
                                  endpoint.responseExample,
                                  `Resposta ${endpoint.title}`,
                                )
                              }
                            >
                              <Copy size={14} />
                              Copiar response
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {endpoint.requestExample && (
                            <JsonBlock
                              value={endpoint.requestExample}
                              onCopy={() =>
                                copyText(
                                  endpoint.requestExample ?? "",
                                  `Requisicao ${endpoint.title}`,
                                )
                              }
                            />
                          )}
                          <JsonBlock
                            value={endpoint.responseExample}
                            onCopy={() =>
                              copyText(
                                endpoint.responseExample,
                                `Resposta ${endpoint.title}`,
                              )
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {filteredEndpoints.length === 0 && (
              <Card className="bg-white/84 backdrop-blur">
                <CardContent className="p-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Search size={22} />
                  </div>
                  <p className="mt-4 text-sm text-zinc-500">
                    Nenhum endpoint encontrado para esse filtro.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <FileCode2 size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-fleet-ink">
                  Endpoints reais
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Baseado nas rotas usadas no sistema hoje.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-fleet-ink">
                  Campos mapeados
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Obrigatorios e opcionais destacados por endpoint.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <KeyRound size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-fleet-ink">
                  Colecoes prontas
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Download direto para Postman e Insomnia.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

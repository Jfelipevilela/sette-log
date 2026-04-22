import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Car,
  Download,
  FileSpreadsheet,
  Fuel,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { FilterField, FilterPanel } from "../../components/ui/filter-panel";
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { StatCard } from "../../components/ui/stat-card";
import { Table, Td, Th } from "../../components/ui/table";
import { VehicleTypeIcon } from "../../components/vehicle-type-icon";
import { getDashboard, getDrivers, getVehicles } from "../../lib/api";
import { formatCurrency, formatDate, formatPercent, downloadTextFile, toCsv } from "../../lib/utils";

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "available", label: "Disponivel" },
  { value: "in_route", label: "Em rota" },
  { value: "stopped", label: "Parado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "inactive", label: "Inativo" },
  { value: "blocked", label: "Bloqueado" },
];

const statusLabels: Record<string, string> = {
  available: "Disponivel",
  in_route: "Em rota",
  stopped: "Parado",
  maintenance: "Manutenção",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

const statusTone: Record<string, "green" | "cyan" | "amber" | "red" | "neutral"> = {
  available: "green",
  in_route: "cyan",
  stopped: "amber",
  maintenance: "red",
  inactive: "neutral",
  blocked: "red",
};

const pieColors = ["#0f8f63", "#027f9f", "#d97706", "#dc2626", "#6b7280", "#1d4ed8"];

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatKmPerLiter(value: number) {
  if (!value) {
    return "-";
  }
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km/L`;
}

export function ReportsPage() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [filterMessage, setFilterMessage] = useState("Painel carregado com os filtros atuais.");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["reports-dashboard", from, to],
    queryFn: () => getDashboard({ from, to }),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
  });

  const searchTerm = search.trim().toLowerCase();

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const haystack = [
        vehicle.plate,
        vehicle.nickname,
        vehicle.brand,
        vehicle.model,
        vehicle.costCenter,
        vehicle.sector,
        vehicle.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!searchTerm || haystack.includes(searchTerm)) &&
        (!status || vehicle.status === status) &&
        (!sector || String(vehicle.sector ?? "").toLowerCase().includes(sector.toLowerCase())) &&
        (!city || String(vehicle.city ?? "").toLowerCase().includes(city.toLowerCase())) &&
        (!costCenter ||
          String(vehicle.costCenter ?? "").toLowerCase().includes(costCenter.toLowerCase()))
      );
    });
  }, [vehicles, searchTerm, status, sector, city, costCenter]);

  const filteredVehicleIds = useMemo(
    () => new Set(filteredVehicles.map((vehicle) => vehicle._id)),
    [filteredVehicles],
  );

  const filteredFuelByVehicle = useMemo(() => {
    return (dashboard?.fuelByVehicle ?? []).filter((item) =>
      filteredVehicleIds.has(item.vehicleId),
    );
  }, [dashboard?.fuelByVehicle, filteredVehicleIds]);

  const filteredCriticalVehicles = useMemo(() => {
    return (dashboard?.criticalVehicles ?? []).filter((vehicle) =>
      filteredVehicleIds.has(vehicle._id),
    );
  }, [dashboard?.criticalVehicles, filteredVehicleIds]);

  const filteredUpcomingMaintenance = useMemo(() => {
    return (dashboard?.upcomingMaintenance ?? []).filter((order) =>
      filteredVehicleIds.has(order.vehicleId),
    );
  }, [dashboard?.upcomingMaintenance, filteredVehicleIds]);

  const filteredExpiringDocuments = useMemo(() => {
    return (dashboard?.expiringDocuments ?? []).filter((document) => {
      if (document.entityType === "vehicle") {
        return filteredVehicleIds.has(document.entityId);
      }
      if (document.entityType === "driver") {
        const driver = drivers.find((item) => item._id === document.entityId);
        return driver?.assignedVehicleId
          ? filteredVehicleIds.has(driver.assignedVehicleId)
          : false;
      }
      return true;
    });
  }, [dashboard?.expiringDocuments, drivers, filteredVehicleIds]);

  const filteredDrivers = useMemo(() => {
    const relevantVehicleIds = filteredVehicleIds;
    return drivers.filter((driver) => {
      const haystack = [driver.name, driver.email, driver.licenseNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesVehicle = !driver.assignedVehicleId || relevantVehicleIds.has(driver.assignedVehicleId);
      return matchesSearch && matchesVehicle;
    });
  }, [drivers, filteredVehicleIds, searchTerm]);

  const monthlyCostSeries = useMemo(() => {
    return (dashboard?.costByMonth ?? []).slice(-12).map((point) => ({
      month: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
      combustivel: safeNumber(point.fuelCost ?? point.total),
      manutencao: safeNumber(point.maintenanceCost),
      despesas: safeNumber(point.expenseCost),
      total: safeNumber(point.total),
      litros: safeNumber(point.liters),
    }));
  }, [dashboard?.costByMonth]);

  const statusDistribution = useMemo(() => {
    return filteredVehicles.reduce<Array<{ name: string; value: number }>>((acc, vehicle) => {
      const key = vehicle.status;
      const existing = acc.find((item) => item.name === key);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: key, value: 1 });
      }
      return acc;
    }, []);
  }, [filteredVehicles]);

  const topExpenseVehicles = useMemo(() => {
    return [...filteredFuelByVehicle]
      .sort((left, right) => right.totalCost - left.totalCost)
      .slice(0, 10);
  }, [filteredFuelByVehicle]);

  const driverRanking = useMemo(() => {
    return [...filteredDrivers].sort((left, right) => right.score - left.score).slice(0, 10);
  }, [filteredDrivers]);

  const reportKpis = useMemo(() => {
    const totalOperationalCost = filteredFuelByVehicle.reduce(
      (total, item) => total + safeNumber(item.totalCost),
      0,
    );
    const totalLiters = filteredFuelByVehicle.reduce(
      (total, item) => total + safeNumber(item.totalLiters),
      0,
    );
    const totalDistance = filteredFuelByVehicle.reduce(
      (total, item) => total + safeNumber(item.distanceKm),
      0,
    );
    const totalEfficiencyLiters = filteredFuelByVehicle.reduce(
      (total, item) => total + safeNumber(item.efficiencyLiters),
      0,
    );
    const availableVehicles = filteredVehicles.filter((vehicle) => vehicle.status === "available").length;

    return {
      vehicles: filteredVehicles.length,
      available: availableVehicles,
      availability: filteredVehicles.length ? (availableVehicles / filteredVehicles.length) * 100 : 0,
      fuelCost: totalOperationalCost,
      averageCostPerVehicle: filteredVehicles.length ? totalOperationalCost / filteredVehicles.length : 0,
      averageKmPerLiter: totalEfficiencyLiters ? totalDistance / totalEfficiencyLiters : 0,
      openAlerts: dashboard?.recentAlerts?.length ?? 0,
      expiringDocuments: filteredExpiringDocuments.length,
      maintenanceOrders: filteredUpcomingMaintenance.length,
      totalLiters,
    };
  }, [dashboard?.recentAlerts?.length, filteredExpiringDocuments.length, filteredFuelByVehicle, filteredUpcomingMaintenance.length, filteredVehicles]);

  const vehicleRowsForExport = filteredFuelByVehicle.map((item) => ({
    placa: item.plate,
    veiculo: item.label,
    litros: item.totalLiters,
    custo_total: item.totalCost,
    km_l: item.averageKmPerLiter ?? "",
    preco_medio: item.averagePrice,
    lancamentos: item.records,
    ultima_data: item.lastFuelAt ? formatDate(item.lastFuelAt) : "",
  }));

  const driverRowsForExport = driverRanking.map((driver) => ({
    motorista: driver.name,
    cnh: driver.licenseNumber,
    categoria: driver.licenseCategory,
    score: driver.score,
    status: driver.status,
  }));

  const riskRowsForExport = filteredExpiringDocuments.map((item) => ({
    tipo: item.type,
    entidade: item.entityType,
    numero: item.number ?? "",
    vencimento: formatDate(item.expiresAt),
    status: item.status,
  }));

  if (isLoading || !dashboard) {
    return <LoadingState label="Carregando BI e relatorios..." />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">BI e Relatorios</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Visão executiva com custos, disponibilidade, risco operacional, consumo e ranking de desempenho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Download size={18} />
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile("relatorio-veiculos.csv", toCsv(vehicleRowsForExport))}
          >
            <FileSpreadsheet size={18} />
            Exportar veiculos
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile("relatorio-motoristas.csv", toCsv(driverRowsForExport))}
          >
            <FileSpreadsheet size={18} />
            Exportar motoristas
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile("relatorio-riscos.csv", toCsv(riskRowsForExport))}
          >
            <FileSpreadsheet size={18} />
            Exportar riscos
          </Button>
        </div>
      </section>

      <FilterPanel
        description="Filtre a analise por periodo, status da frota e recortes operacionais."
        isExpanded={filtersExpanded}
        onToggleExpanded={() => setFiltersExpanded((current) => !current)}
        searchSlot={
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
            <Input
              className="pl-10"
              placeholder="Buscar placa, modelo, motorista, setor ou centro de custo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
        expandedContent={
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <FilterField label="Data inicial">
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </FilterField>
              <FilterField label="Data final">
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </FilterField>
              <FilterField label="Status">
                <SearchableSelect
                  value={status}
                  onValueChange={setStatus}
                  options={statusOptions}
                  searchable={false}
                  placeholder="Todos os status"
                />
              </FilterField>
              <FilterField label="Setor">
                <Input value={sector} onChange={(event) => setSector(event.target.value)} placeholder="Ex.: Operacoes" />
              </FilterField>
              <FilterField label="Cidade">
                <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Manaus" />
              </FilterField>
              <FilterField label="Centro de custo" className="xl:col-span-2">
                <Input
                  value={costCenter}
                  onChange={(event) => setCostCenter(event.target.value)}
                  placeholder="Ex.: Frota propria"
                />
              </FilterField>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">{filterMessage}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setSector("");
                    setCity("");
                    setCostCenter("");
                    setFrom(monthStart);
                    setTo(today);
                    setFilterMessage("Filtros redefinidos para o periodo padrão.");
                  }}
                >
                  Limpar
                </Button>
                <Button
                  onClick={() =>
                    setFilterMessage(
                      `Analise atualizada para ${filteredVehicles.length} veiculo(s) no intervalo selecionado.`,
                    )
                  }
                >
                  <SlidersHorizontal size={18} />
                  Atualizar analise
                </Button>
              </div>
            </div>
          </div>
        }
      >
        {null}
      </FilterPanel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Veiculos analisados"
          value={String(reportKpis.vehicles)}
          detail={`${reportKpis.available} disponiveis no recorte atual`}
          icon={Car}
          tone="green"
        />
        <StatCard
          label="Disponibilidade"
          value={formatPercent(reportKpis.availability)}
          detail="Frota pronta para operação"
          icon={TrendingUp}
          tone="cyan"
        />
        <StatCard
          label="Custo operacional"
          value={formatCurrency(reportKpis.fuelCost)}
          detail={reportKpis.totalLiters.toLocaleString("pt-BR") + " L consolidados"}
          icon={Fuel}
          tone="amber"
        />
        <StatCard
          label="Km/L medio"
          value={formatKmPerLiter(reportKpis.averageKmPerLiter)}
          detail={formatCurrency(reportKpis.averageCostPerVehicle) + " por veiculo"}
          icon={BarChart3}
          tone="red"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Evolução mensal de custos</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Combustivel, manutenção e despesas no histórico de 12 meses.
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyCostSeries}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="combustivel" fill="#0f8f63" radius={[6, 6, 0, 0]} name="Combustivel" />
                <Bar dataKey="manutencao" fill="#d97706" radius={[6, 6, 0, 0]} name="Manutenção" />
                <Bar dataKey="despesas" fill="#027f9f" radius={[6, 6, 0, 0]} name="Despesas" />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Status operacional</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Distribuição atual dos veículos dentro do recorte filtrado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={3}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, statusLabels[String(name)] ?? String(name)]}
                />
                <Legend formatter={(value) => statusLabels[String(value)] ?? String(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ranking de custo por veiculo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Veiculos com maior gasto de combustivel no periodo analisado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topExpenseVehicles.slice(0, 8)} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="plate"
                  tickLine={false}
                  axisLine={false}
                  width={88}
                />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="totalCost" fill="#0f8f63" radius={[0, 6, 6, 0]} name="Custo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ranking de motoristas</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Score de condução para leitura rápida de performance.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {driverRanking.map((driver, index) => (
                <div key={driver._id} className="rounded-lg border border-fleet-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                        <UserRound size={18} />
                      </span>
                      <div>
                        <strong className="block text-sm">
                          {index + 1}. {driver.name}
                        </strong>
                        <span className="text-xs text-zinc-500">
                          CNH {driver.licenseNumber}
                        </span>
                      </div>
                    </div>
                    <Badge tone={driver.score >= 85 ? "green" : driver.score >= 70 ? "amber" : "red"}>
                      {driver.score} pts
                    </Badge>
                  </div>
                </div>
              ))}
              {driverRanking.length === 0 && (
                <p className="text-sm text-zinc-500">Sem motoristas no recorte atual.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Veiculos criticos</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Itens que merecem prioridade operacional.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {filteredCriticalVehicles.map((vehicle) => (
                <div key={vehicle._id} className="rounded-lg border border-fleet-line p-3">
                  <div className="flex items-center gap-3">
                    <VehicleTypeIcon type={vehicle.type} />
                    <div className="min-w-0">
                      <strong className="block text-sm">{vehicle.plate}</strong>
                      <span className="truncate text-xs text-zinc-500">
                        {vehicle.nickname ?? `${vehicle.brand} ${vehicle.model}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={statusTone[vehicle.status] ?? "neutral"}>
                      {statusLabels[vehicle.status] ?? vehicle.status}
                    </Badge>
                    {vehicle.city ? <Badge tone="neutral">{vehicle.city}</Badge> : null}
                    {vehicle.sector ? <Badge tone="neutral">{vehicle.sector}</Badge> : null}
                  </div>
                </div>
              ))}
              {filteredCriticalVehicles.length === 0 && (
                <p className="text-sm text-zinc-500">Nenhum veiculo critico neste recorte.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Manutenções próximas</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Ordens abertas, agendadas ou em execução.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {filteredUpcomingMaintenance.map((order) => (
                <div key={order._id} className="rounded-lg border border-fleet-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <Wrench size={18} />
                      </span>
                      <div>
                        <strong className="block text-sm">{order.type}</strong>
                        <span className="text-xs text-zinc-500">
                          {formatDate(order.scheduledAt)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={order.priority === "critical" ? "red" : order.priority === "high" ? "amber" : "cyan"}>
                      {order.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    Custo previsto: {formatCurrency(order.totalCost)}
                  </p>
                </div>
              ))}
              {filteredUpcomingMaintenance.length === 0 && (
                <p className="text-sm text-zinc-500">Nenhuma manutenção no período.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Risco documental</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Documentos vencendo ou vencidos no recorte.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {filteredExpiringDocuments.map((document) => (
                <div key={document._id} className="rounded-lg border border-fleet-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                        <ShieldAlert size={18} />
                      </span>
                      <div>
                        <strong className="block text-sm">{document.type}</strong>
                        <span className="text-xs text-zinc-500">
                          Vence em {formatDate(document.expiresAt)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={document.status === "expired" ? "red" : "amber"}>
                      {document.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {filteredExpiringDocuments.length === 0 && (
                <p className="text-sm text-zinc-500">Nenhum risco documental encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Consolidado por veiculo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Litros, custo, preco medio e eficiencia para leitura executiva.
              </p>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Veiculo</Th>
                  <Th>Litros</Th>
                  <Th>Custo</Th>
                  <Th>Preco medio</Th>
                  <Th>Km/L</Th>
                  <Th>Lançamentos</Th>
                  <Th>Último abastecimento</Th>
                </tr>
              </thead>
              <tbody>
                {filteredFuelByVehicle.map((item) => (
                  <tr key={item.vehicleId}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <VehicleTypeIcon type={item.type} />
                        <div>
                          <strong>{item.plate}</strong>
                          <span className="block text-xs text-zinc-500">{item.label}</span>
                        </div>
                      </div>
                    </Td>
                    <Td>{item.totalLiters.toLocaleString("pt-BR")} L</Td>
                    <Td>{formatCurrency(item.totalCost)}</Td>
                    <Td>{formatCurrency(item.averagePrice)}</Td>
                    <Td>{formatKmPerLiter(safeNumber(item.averageKmPerLiter))}</Td>
                    <Td>{item.records}</Td>
                    <Td>{item.lastFuelAt ? formatDate(item.lastFuelAt) : "-"}</Td>
                  </tr>
                ))}
                {filteredFuelByVehicle.length === 0 && (
                  <tr>
                    <td className="border-b border-slate-100 px-4 py-6 text-sm text-zinc-500" colSpan={7}>
                      Nenhum dado de abastecimento encontrado para este recorte.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Painel de risco</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Visão rápida do que exige ação imediata.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-600" size={20} />
                <div>
                  <strong className="block text-sm">Alertas recentes</strong>
                  <span className="text-xs text-zinc-500">
                    {reportKpis.openAlerts} evento(s) no painel principal
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-3">
                <CalendarClock className="text-amber-600" size={20} />
                <div>
                  <strong className="block text-sm">Documentos criticos</strong>
                  <span className="text-xs text-zinc-500">
                    {reportKpis.expiringDocuments} registro(s) proximos do vencimento
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-3">
                <Wrench className="text-cyan-700" size={20} />
                <div>
                  <strong className="block text-sm">Ordens de manutenção</strong>
                  <span className="text-xs text-zinc-500">
                    {reportKpis.maintenanceOrders} ordem(ns) em acompanhamento
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

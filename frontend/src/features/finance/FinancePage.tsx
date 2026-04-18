import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download, Filter, Fuel, Receipt, Search } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { Input } from '../../components/ui/input';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Table, Td, Th } from '../../components/ui/table';
import { downloadResourceExport, getDashboard, getVehicles, listResource } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

type ArrayItemWithAmount = {
  amount?: number;
};

export function FinancePage() {
  const [filters, setFilters] = useState({ search: '', status: '', costCenter: '', sector: '', city: '' });
  const { data = {
    kpis: {
      totalVehicles: 0,
      availableVehicles: 0,
      activeDrivers: 0,
      openAlerts: 0,
      availability: 0,
      totalFuelCost: 0,
      totalFuelLiters: 0,
      totalMaintenanceCost: 0,
      totalExpenseCost: 0,
      totalOperationalCost: 0,
      averageFuelCost: 0
    },
    vehiclesByStatus: [],
    criticalVehicles: [],
    upcomingMaintenance: [],
    expiringDocuments: [],
    costByMonth: [],
    fuelByVehicle: [],
    topFuelCostVehicles: [],
    dashboardPeriod: {
      from: new Date().toISOString(),
      to: new Date().toISOString()
    },
    recentAlerts: [],
    generatedAt: new Date().toISOString()
  } } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => getDashboard()
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getVehicles()
  });
  const { data: fines = [] } = useQuery({
    queryKey: ['finance-fines'],
    queryFn: () => listResource<ArrayItemWithAmount>('/finance/fines')
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ['finance-incidents'],
    queryFn: () => listResource<ArrayItemWithAmount>('/finance/incidents')
  });
  const finesAndIncidentsTotal = [...fines, ...incidents].reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const filteredVehicles = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return vehicles.filter((vehicle) => (
      (!term || `${vehicle.plate} ${vehicle.nickname ?? ''} ${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(term)) &&
      (!filters.status || vehicle.status === filters.status) &&
      (!filters.costCenter || String(vehicle.costCenter ?? '').toLowerCase().includes(filters.costCenter.toLowerCase())) &&
      (!filters.sector || String(vehicle.sector ?? '').toLowerCase().includes(filters.sector.toLowerCase())) &&
      (!filters.city || String(vehicle.city ?? '').toLowerCase().includes(filters.city.toLowerCase()))
    ));
  }, [vehicles, filters]);

  const pieData = [
    { name: 'Combustível', value: data.kpis.totalFuelCost, color: '#0f8f63' },
    { name: 'Manutenção e despesas', value: data.kpis.totalExpenseCost, color: '#027f9f' },
    { name: 'Multas e sinistros', value: finesAndIncidentsTotal, color: '#c2413b' }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Financeiro da frota</h2>
          <p className="mt-1 text-sm text-zinc-500">Abastecimentos, multas, seguros, impostos, pedagios e custo por km.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadResourceExport('fuel-records')}>
            <Download size={18} />
            Abastecimentos
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport('expenses')}>
            <Download size={18} />
            Despesas
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport('fines')}>
            <Download size={18} />
            Multas
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport('incidents')}>
            <Download size={18} />
            Sinistros
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport('insurances')}>
            <Download size={18} />
            Seguros
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <StatCard label="Combustível" value={formatCurrency(data.kpis.totalFuelCost)} detail={`${data.kpis.totalFuelLiters.toLocaleString('pt-BR')} L registrados`} icon={Fuel} tone="green" />
        <StatCard label="Despesas gerais" value={formatCurrency(data.kpis.totalExpenseCost)} detail="Custos operacionais extras" icon={Receipt} tone="cyan" />
        <StatCard label="Preço médio litro" value={formatCurrency(data.kpis.averageFuelCost)} detail="Média dos abastecimentos" icon={CreditCard} tone="amber" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_180px_170px_160px_160px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
              <Input className="pl-10" placeholder="Buscar placa, modelo ou apelido" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            </div>
            <SearchableSelect value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))} placeholder="Status" options={[{ value: '', label: 'Todos' }, { value: 'available', label: 'Disponível' }, { value: 'in_route', label: 'Em rota' }, { value: 'maintenance', label: 'Manutenção' }, { value: 'inactive', label: 'Inativo' }, { value: 'blocked', label: 'Bloqueado' }]} />
            <Input placeholder="Centro de custo" value={filters.costCenter} onChange={(event) => setFilters((current) => ({ ...current, costCenter: event.target.value }))} />
            <Input placeholder="Setor" value={filters.sector} onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))} />
            <Input placeholder="Cidade" value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} />
            <Button variant="secondary" onClick={() => setFilters({ search: '', status: '', costCenter: '', sector: '', city: '' })}>
              <Filter size={18} />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Distribuicao de custos</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo por veículo</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Placa</Th>
                  <Th>Centro de custo</Th>
                  <Th>Combustível</Th>
                  <Th>Despesas</Th>
                  <Th>Custo/km</Th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle._id}>
                    <Td>
                      <strong>{vehicle.plate}</strong>
                    </Td>
                    <Td>{vehicle.costCenter}</Td>
                    <Td>{formatCurrency(vehicle.financialSummary?.totalFuelCost ?? 0)}</Td>
                    <Td>{formatCurrency(vehicle.financialSummary?.totalExpenses ?? 0)}</Td>
                    <Td>
                      <Badge tone="cyan">{formatCurrency(vehicle.financialSummary?.costPerKm ?? 0)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

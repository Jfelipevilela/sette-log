import {
  BarChart3,
  Bell,
  Car,
  ClipboardCheck,
  Fuel,
  Gauge,
  Home,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Wrench
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { useAuthStore } from '../../store/auth-store';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/vehicles', label: 'Veiculos', icon: Car },
  { to: '/tracking', label: 'Rastreamento', icon: Map },
  { to: '/drivers', label: 'Motoristas', icon: UserRound },
  { to: '/maintenance', label: 'Manutencao', icon: Wrench },
  { to: '/fuel', label: 'Abastecimentos', icon: Fuel },
  { to: '/finance', label: 'Financeiro', icon: Gauge },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/reports', label: 'BI e Relatorios', icon: BarChart3 },
  { to: '/settings', label: 'Configuracoes', icon: Settings }
];

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-fleet-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-black/10 bg-fleet-ink text-white lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fleet-green">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <strong className="block text-lg font-semibold">Sette Log</strong>
            <span className="text-xs text-zinc-300">Operação corporativa</span>
          </div>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white',
                  isActive && 'bg-white text-fleet-ink hover:bg-white hover:text-fleet-ink'
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-fleet-line bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
              <Menu size={18} />
            </Button>
            <div>
              <p className="text-sm text-zinc-500">Central de controle</p>
              <h1 className="text-xl font-semibold text-fleet-ink">Gestão de frota em tempo real</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-md border border-fleet-line bg-white text-zinc-700">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fleet-red" />
            </button>
            <div className="hidden text-right sm:block">
              <strong className="block text-sm">{user?.name ?? 'Operador'}</strong>
              <span className="text-xs text-zinc-500">{user?.roles?.[0] ?? 'auditor'}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1520px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-80 max-w-[86vw] bg-fleet-ink p-4 text-white" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <strong>SETTE Log</strong>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                Fechar
              </Button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-md px-3 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white',
                      isActive && 'bg-white text-fleet-ink hover:bg-white hover:text-fleet-ink'
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

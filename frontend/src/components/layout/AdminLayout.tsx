import {
  BarChart3,
  Bell,
  Car,
  Fuel,
  Gauge,
  Home,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../../lib/api";
import { hasAnyPermission, PERMISSIONS } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/auth-store";
import { Button } from "../ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  { to: "/vehicles", label: "Veículos", icon: Car, permissions: [PERMISSIONS.VEHICLES_VIEW] },
  { to: "/drivers", label: "Motoristas", icon: UserRound, permissions: [PERMISSIONS.DRIVERS_VIEW] },
  { to: "/maintenance", label: "Manutenção", icon: Wrench, permissions: [PERMISSIONS.MAINTENANCE_VIEW] },
  {
    to: "/fuel",
    label: "Abastecimentos",
    icon: Fuel,
    permissions: [
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS,
    ],
  },
  { to: "/finance", label: "Financeiro", icon: Gauge, permissions: [PERMISSIONS.FINANCE_VIEW] },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck, permissions: [PERMISSIONS.COMPLIANCE_VIEW] },
  { to: "/reports", label: "BI e Relatórios", icon: BarChart3, permissions: [PERMISSIONS.REPORTS_VIEW] },
  {
    to: "/settings",
    label: "Configurações",
    icon: Settings,
    permissions: [
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 30_000,
    enabled: hasAnyPermission(user, [PERMISSIONS.DASHBOARD_VIEW]),
  });
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unreadCount = notifications.filter(
    (notification) => notification.status !== "read",
  ).length;
  const visibleNavItems = navItems.filter((item) =>
    hasAnyPermission(user, item.permissions),
  );

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        notificationsButtonRef.current?.contains(target) ||
        notificationsPanelRef.current?.contains(target)
      ) {
        return;
      }
      setNotificationsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen text-fleet-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-emerald-950/40 bg-[linear-gradient(180deg,#041010_0%,#041313_45%,#020b0b_100%)] text-white shadow-[16px_0_45px_rgba(2,12,12,0.34)] lg:flex lg:flex-col">
        <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-emerald-950/25">
              <img
                src="/brand/logo-sette-log.png"
                alt="SETTE Log"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div>
              <strong className="block text-lg font-semibold">SETTE Log</strong>
              <span className="text-xs text-zinc-300">Operação corporativa</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white",
                  isActive &&
                    "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_rgba(0,0,0,0.22)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute inset-y-2 left-0 w-1 rounded-r-full bg-transparent transition",
                      isActive &&
                        "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]",
                    )}
                  />
                  <item.icon
                    size={18}
                    className={cn(
                      "shrink-0 text-zinc-400 transition group-hover:text-white",
                      isActive && "text-white",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/8 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <UserRound size={16} />
              </div>
              <div className="min-w-0 truncate">
                <div className="truncate text-sm font-medium text-white">
                  {user?.name ?? "Operador"}
                </div>
                <div className="text-xs text-zinc-400">
                  {user?.roles?.[0] ?? "Usuário"}
                </div>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="flex h-8 w-8 items-center justify-center rounded border border-white/30 p-0 text-white hover:bg-white/20 hover:text-white"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-white/80 bg-white/85 px-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </Button>
            <div>
              <p className="text-sm text-zinc-500">Central de controle</p>
              <h1 className="text-xl font-semibold text-fleet-ink">
                Gestão de frota em tempo real
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasAnyPermission(user, [PERMISSIONS.DASHBOARD_VIEW]) && (
              <>
                <button
                  ref={notificationsButtonRef}
                  type="button"
                  className="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-zinc-700 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:border-emerald-200 hover:bg-emerald-50/40"
                  onClick={() => setNotificationsOpen((current) => !current)}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fleet-red px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
              <div
                ref={notificationsPanelRef}
                className="absolute right-4 top-16 z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-white/80 bg-white/95 p-2 shadow-[0_22px_60px_rgba(15,23,42,0.20)] ring-1 ring-slate-200/80 backdrop-blur-xl lg:right-8"
              >
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <strong className="text-sm">Notificações</strong>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="max-h-96 space-y-1 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-2 py-4 text-sm text-zinc-500">
                      Nenhuma notificação.
                    </p>
                  )}
                  {notifications.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-zinc-50"
                      onClick={() => markReadMutation.mutate(notification._id)}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <strong className="text-fleet-ink">
                          {notification.title}
                        </strong>
                        {notification.status !== "read" && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-fleet-red" />
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {notification.message}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
                )}
              </>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1520px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,#041010_0%,#041313_45%,#020b0b_100%)] text-white shadow-[12px_0_35px_rgba(22,24,22,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-emerald-950/25">
                  <img
                    src="/brand/logo-sette-log.png"
                    alt="SETTE Log"
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
                <div>
                  <strong className="block text-lg font-semibold">
                    SETTE Log
                  </strong>
                  <span className="text-xs text-zinc-300">
                    Operação corporativa
                  </span>
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white",
                      isActive &&
                        "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_rgba(0,0,0,0.22)]",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute inset-y-2 left-0 w-1 rounded-r-full bg-transparent transition",
                          isActive &&
                            "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]",
                        )}
                      />
                      <item.icon
                        size={18}
                        className={cn(
                          "shrink-0 text-zinc-400 transition group-hover:text-white",
                          isActive && "text-white",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto border-t border-white/8 px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <UserRound size={16} />
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="truncate text-sm font-medium text-white">
                      {user?.name ?? "Operador"}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {user?.roles?.[0] ?? "Usuário"}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  variant="ghost"
                  size="sm"
                  className="flex h-8 w-8 items-center justify-center rounded border border-white/30 p-0 text-white hover:bg-white/20 hover:text-white"
                  title="Sair"
                  aria-label="Sair"
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

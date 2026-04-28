import type { AuthUser } from "./types";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  VEHICLES_VIEW: "vehicles:view",
  VEHICLES_CREATE: "vehicles:create",
  VEHICLES_EDIT: "vehicles:edit",
  VEHICLES_DELETE: "vehicles:delete",
  TRACKING_VIEW: "tracking:view",
  TRACKING_EXPORT: "tracking:export",
  DRIVERS_VIEW: "drivers:view",
  DRIVERS_CREATE: "drivers:create",
  DRIVERS_EDIT: "drivers:edit",
  DRIVERS_DELETE: "drivers:delete",
  MAINTENANCE_VIEW: "maintenance:view",
  MAINTENANCE_CREATE: "maintenance:create",
  MAINTENANCE_EDIT: "maintenance:edit",
  MAINTENANCE_DELETE: "maintenance:delete",
  FINANCE_VIEW: "finance:view",
  FINANCE_CREATE: "finance:create",
  FINANCE_EDIT: "finance:edit",
  FINANCE_DELETE: "finance:delete",
  FUEL_DRIVER_PORTAL_ACCESS: "fuel_driver_portal:access",
  COMPLIANCE_VIEW: "compliance:view",
  COMPLIANCE_CREATE: "compliance:create",
  COMPLIANCE_EDIT: "compliance:edit",
  COMPLIANCE_DELETE: "compliance:delete",
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  SETTINGS_MANAGE: "settings:manage",
  USERS_MANAGE: "users:manage",
  INTEGRATIONS_MANAGE: "integrations:manage",
  ALERTS_MANAGE: "alerts:manage",
} as const;

const permissionRouteMap: Array<{ permissions: string[]; path: string }> = [
  { permissions: [PERMISSIONS.DASHBOARD_VIEW], path: "/" },
  { permissions: [PERMISSIONS.VEHICLES_VIEW], path: "/vehicles" },
  { permissions: [PERMISSIONS.TRACKING_VIEW], path: "/tracking" },
  { permissions: [PERMISSIONS.DRIVERS_VIEW], path: "/drivers" },
  { permissions: [PERMISSIONS.MAINTENANCE_VIEW], path: "/maintenance" },
  {
    permissions: [PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS],
    path: "/fuel",
  },
  { permissions: [PERMISSIONS.COMPLIANCE_VIEW], path: "/compliance" },
  { permissions: [PERMISSIONS.REPORTS_VIEW], path: "/reports" },
  {
    permissions: [
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    ],
    path: "/settings",
  },
];

export function hasPermission(
  user: AuthUser | undefined,
  permission: string,
) {
  return Boolean(user?.permissions?.includes(permission));
}

export function hasAnyPermission(
  user: AuthUser | undefined,
  permissions: string[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function getFirstAllowedRoute(user: AuthUser | undefined) {
  const match = permissionRouteMap.find((item) =>
    hasAnyPermission(user, item.permissions),
  );

  return match?.path ?? "/login";
}

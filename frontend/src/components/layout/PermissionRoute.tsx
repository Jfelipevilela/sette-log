import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import { getFirstAllowedRoute, hasAnyPermission } from "../../lib/permissions";

type PermissionRouteProps = {
  permissions: string[];
  children: JSX.Element;
};

export function PermissionRoute({
  permissions,
  children,
}: PermissionRouteProps) {
  const user = useAuthStore((state) => state.user);

  if (!hasAnyPermission(user, permissions)) {
    return <Navigate to={getFirstAllowedRoute(user)} replace />;
  }

  return children;
}

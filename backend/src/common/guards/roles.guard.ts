import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY, ROLES_KEY } from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (roles.length === 0 && permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Usuário não autenticado.");
    }

    if (user.roles.includes("super_admin")) {
      return true;
    }

    const hasRole =
      roles.length === 0 || roles.some((role) => user.roles.includes(role));
    const hasPermission =
      permissions.length === 0 ||
      permissions.every((permission) => user.permissions.includes(permission));

    if (!hasRole || !hasPermission) {
      throw new ForbiddenException(
        "Permissao insuficiente para executar esta ação.",
      );
    }

    return true;
  }
}

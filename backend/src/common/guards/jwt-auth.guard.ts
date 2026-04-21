import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = String(request.headers.authorization ?? '');
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!token) {
      throw new UnauthorizedException('Token de acesso não informado.');
    }

    if (token.startsWith('slapi_')) {
      const user = await this.usersService.findByApiToken(token);
      if (!user) {
        throw new UnauthorizedException('Token de API inválido.');
      }
      request.user = {
        sub: user._id.toString(),
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        branchId: user.branchId,
        roles: user.roles,
        permissions: user.permissions,
        authType: 'api_token'
      };
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}

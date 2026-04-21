import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/types';
import { UsersService } from '../users/users.service';

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret')
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Sessao invalida.');
    }

    return {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      permissions: user.permissions,
      authType: 'jwt'
    };
  }
}

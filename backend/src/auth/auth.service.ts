import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import type { StringValue } from 'ms';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const effectivePermissions = await this.usersService.syncUserPermissions(
      user.tenantId,
      user._id.toString(),
      user.roles ?? [],
    );

    const payload: TokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      permissions: effectivePermissions,
    };
    const tokens = await this.signTokens(payload);
    await this.usersService.setRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        ...this.usersService.toPublic(user.toObject()),
        permissions: effectivePermissions,
      },
      ...tokens
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret')
      });
      const user = await this.usersService.findById(payload.sub, true);
      if (!user || user.status !== 'active' || !user.refreshTokenHash) {
        throw new UnauthorizedException('Sessao invalida.');
      }

      const validRefresh = await compare(refreshToken, user.refreshTokenHash);
      if (!validRefresh) {
        throw new UnauthorizedException('Sessao invalida.');
      }

      const effectivePermissions = await this.usersService.syncUserPermissions(
        user.tenantId,
        user._id.toString(),
        user.roles ?? [],
      );

      const nextPayload: TokenPayload = {
        sub: user._id.toString(),
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        branchId: user.branchId,
        roles: user.roles,
        permissions: effectivePermissions,
      };
      const tokens = await this.signTokens(nextPayload);
      await this.usersService.setRefreshToken(user._id.toString(), tokens.refreshToken);

      return {
        user: {
          ...this.usersService.toPublic(user.toObject()),
          permissions: effectivePermissions,
        },
        ...tokens
      };
    } catch {
      throw new UnauthorizedException('Sessao invalida.');
    }
  }

  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId);
    return { success: true };
  }

  private async signTokens(payload: TokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
        expiresIn: this.jwtTtl('JWT_ACCESS_TTL', '15m')
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
        expiresIn: this.jwtTtl('JWT_REFRESH_TTL', '7d')
      })
    ]);

    return { accessToken, refreshToken };
  }

  private jwtTtl(key: string, fallback: StringValue): StringValue {
    return (this.config.get<string>(key) ?? fallback) as StringValue;
  }
}

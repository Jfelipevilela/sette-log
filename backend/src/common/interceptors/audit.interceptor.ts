import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, tap } from 'rxjs';
import { AuditLog } from '../../fleet/schemas/fleet.schemas';
import { AuthenticatedRequest } from '../types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const shouldAudit = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !request.path.includes('/auth/');

    return next.handle().pipe(
      tap({
        next: (data) => {
          if (!shouldAudit) {
            return;
          }

          this.auditLogModel
            .create({
              tenantId: request.user?.tenantId,
              actorUserId: request.user?.sub,
              action: request.method,
              resource: request.path,
              resourceId: request.params?.id ?? AuditInterceptor.extractResourceId(data),
              method: request.method,
              path: request.originalUrl,
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              after: AuditInterceptor.sanitize(data),
              status: 'success'
            })
            .catch((error: unknown) => this.logger.warn(`Failed to write audit log: ${String(error)}`));
        }
      })
    );
  }

  private static sanitize(value: unknown) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const json = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    delete json.password;
    delete json.passwordHash;
    delete json.refreshToken;
    delete json.refreshTokenHash;
    return json;
  }

  private static extractResourceId(value: unknown) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const record = value as { _id?: unknown; deletedId?: unknown };
    return record._id ? String(record._id) : record.deletedId ? String(record.deletedId) : undefined;
  }
}

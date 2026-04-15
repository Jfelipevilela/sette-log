import { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

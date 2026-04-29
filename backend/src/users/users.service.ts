import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { FilterQuery, Model } from "mongoose";
import { Types } from "mongoose";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PaginatedResponse } from "../common/types";
import { PERMISSIONS, ROLE_PERMISSIONS } from "./permissions";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { Role } from "./schemas/role.schema";
import { User } from "./schemas/user.schema";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async findByEmail(email: string, includeSecrets = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (includeSecrets) {
      query.select("+passwordHash +refreshTokenHash +apiTokenHash");
    }
    return query.exec();
  }

  async findById(id: string, includeSecrets = false) {
    const query = this.userModel.findById(id);
    if (includeSecrets) {
      query.select("+passwordHash +refreshTokenHash +apiTokenHash");
    }
    return query.exec();
  }

  async list(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const filter: FilterQuery<User> = { tenantId };
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: "i" } },
        { email: { $regex: query.search, $options: "i" } },
      ];
    }

    const page = query.page;
    const limit = query.limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir === "asc" ? 1 : -1;
    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data: data.map((item) => this.toPublic(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.userModel
      .findOne({ tenantId, email: dto.email.toLowerCase() })
      .lean();
    if (existing) {
      throw new ConflictException("JÃ¡ existe um usuÃ¡rio com este email.");
    }

    const roles = dto.roles?.length ? dto.roles : ["operator"];
    const user = await this.userModel.create({
      tenantId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      branchId: dto.branchId,
      roles,
      permissions: await this.expandPermissionsForTenant(tenantId, roles),
      passwordHash: await hash(dto.password, 12),
      status: "active",
    });

    return this.toPublic(user.toObject());
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.password) {
      update.passwordHash = await hash(dto.password, 12);
      delete update.password;
    }
    if (dto.roles) {
      update.permissions = await this.expandPermissionsForTenant(
        tenantId,
        dto.roles,
      );
    }

    const user = await this.userModel
      .findOneAndUpdate({ _id: id, tenantId }, update, { new: true })
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return this.toPublic(user);
  }

  async remove(tenantId: string, id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        "Você não pode excluir o próprio usuário.",
      );
    }
    const deleted = await this.userModel
      .findOneAndDelete({ _id: id, tenantId })
      .lean()
      .exec();
    if (!deleted) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return { success: true, deletedId: id };
  }

  async setRefreshToken(userId: string, refreshToken?: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash: refreshToken ? await hash(refreshToken, 12) : undefined,
    });
  }

  async syncUserPermissions(tenantId: string, userId: string, roles: string[]) {
    const permissions = await this.expandPermissionsForTenant(tenantId, roles);
    await this.userModel.updateOne(
      { _id: userId, tenantId },
      { permissions },
    );
    return permissions;
  }

  async enableApiAccess(tenantId: string, id: string) {
    const rawToken = `slapi_${randomBytes(24).toString("hex")}`;
    const apiTokenHash = this.hashApiToken(rawToken);
    const preview = `${rawToken.slice(0, 10)}...${rawToken.slice(-6)}`;
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        {
          apiAccessEnabled: true,
          apiTokenHash,
          apiTokenPreview: preview,
          lastApiTokenIssuedAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return {
      user: this.toPublic(user),
      apiToken: rawToken,
    };
  }

  async disableApiAccess(tenantId: string, id: string) {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        {
          apiAccessEnabled: false,
          apiTokenHash: undefined,
          apiTokenPreview: undefined,
          lastApiTokenIssuedAt: undefined,
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return this.toPublic(user);
  }

  async findByApiToken(apiToken: string, includeSecrets = false) {
    const query = this.userModel.findOne({
      apiAccessEnabled: true,
      apiTokenHash: this.hashApiToken(apiToken),
      status: "active",
    });
    if (includeSecrets) {
      query.select("+apiTokenHash");
    }
    return query.exec();
  }

  async listRoles(tenantId: string) {
    let customRoles = await this.roleModel
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (customRoles.length === 0) {
      await this.seedEditableDefaultRoles(tenantId);
      customRoles = await this.roleModel
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
    }

    const systemRoles = [
      {
        key: "super_admin",
        name: UsersService.systemRoleLabel("super_admin"),
        description: "Perfil padrão do sistema.",
        permissions: ROLE_PERMISSIONS.super_admin,
        status: "active",
        system: true,
      },
    ];

    return [
      ...systemRoles,
      ...customRoles.map((role) => ({
        ...this.serialize(role),
        system: false,
      })),
    ];
  }

  async createRole(tenantId: string, payload: Record<string, unknown>) {
    const key = UsersService.normalizeRoleKey(payload.key, payload.name);
    if (key === "super_admin") {
      throw new ConflictException(
        "Essa chave já pertence a um perfil padrão.",
      );
    }
    const existing = await this.roleModel
      .findOne({ tenantId, key })
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException("Já existe um grupo com essa chave.");
    }
    const role = await this.roleModel.create({
      tenantId,
      key,
      name: String(payload.name ?? "").trim(),
      description: payload.description
        ? String(payload.description).trim()
        : undefined,
      permissions: this.normalizePermissions(payload.permissions),
      status:
        String(payload.status ?? "active") === "inactive"
          ? "inactive"
          : "active",
    });
    return {
      ...this.serialize(role.toObject()),
      system: false,
    };
  }

  async updateRole(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const role = await this.roleModel.findOne({ _id: id, tenantId }).exec();
    if (!role) {
      throw new NotFoundException("Grupo de permissões não encontrado.");
    }

    const nextName = String(payload.name ?? role.name).trim();
    if (!nextName) {
      throw new BadRequestException("Nome do grupo é obrigatório.");
    }

    role.name = nextName;
    role.description = payload.description
      ? String(payload.description).trim()
      : undefined;
    role.permissions = this.normalizePermissions(
      payload.permissions ?? role.permissions,
    );
    role.status =
      String(payload.status ?? role.status) === "inactive"
        ? "inactive"
        : "active";
    await role.save();
    await this.recalculateUsersByRole(tenantId, role.key);
    return {
      ...this.serialize(role.toObject()),
      system: false,
    };
  }

  async removeRole(tenantId: string, id: string) {
    const role = await this.roleModel
      .findOneAndDelete({ _id: id, tenantId })
      .lean()
      .exec();
    if (!role) {
      throw new NotFoundException("Grupo de permissões não encontrado.");
    }
    await this.userModel.updateMany(
      { tenantId, roles: role.key },
      { $pull: { roles: role.key } },
    );
    await this.recalculateUsersByRole(tenantId);
    return { success: true, deletedId: id };
  }

  toPublic(user: object) {
    const clone = { ...(this.serialize(user) as Record<string, unknown>) };
    delete clone.passwordHash;
    delete clone.refreshTokenHash;
    return clone;
  }

  private serialize<T>(value: T): T {
    if (value instanceof Types.ObjectId) {
      return value.toString() as T;
    }
    if (value instanceof Date) {
      return value.toISOString() as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item)) as T;
    }
    if (value && typeof value === "object") {
      const objectIdLike = value as {
        _bsontype?: string;
        toString?: () => string;
      };
      if (objectIdLike._bsontype === "ObjectId" && objectIdLike.toString) {
        return objectIdLike.toString() as T;
      }
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.serialize(item),
        ]),
      ) as T;
    }
    return value;
  }

  static expandPermissions(roles: string[]) {
    return Array.from(
      new Set(
        roles.flatMap((role) =>
          role === "super_admin" ? (ROLE_PERMISSIONS.super_admin ?? []) : [],
        ),
      ),
    );
  }

  async expandPermissionsForTenant(tenantId: string, roles: string[]) {
    const staticPermissions = UsersService.expandPermissions(roles);
    const customRoles = await this.roleModel
      .find({
        tenantId,
        key: { $in: roles },
        status: "active",
      })
      .select("key permissions")
      .lean<Array<{ key: string; permissions: string[] }>>()
      .exec();

    return Array.from(
      new Set([
        ...staticPermissions,
        ...customRoles.flatMap((role) => role.permissions ?? []),
      ]),
    );
  }

  private hashApiToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private normalizePermissions(input: unknown) {
    const validPermissions = new Set(Object.values(PERMISSIONS) as string[]);
    const values = Array.isArray(input) ? input : [];
    return Array.from(
      new Set(
        values
          .map((value) => String(value).trim())
          .filter((value): value is string => validPermissions.has(value)),
      ),
    );
  }

  private async recalculateUsersByRole(tenantId: string, roleKey?: string) {
    const filter: FilterQuery<User> = roleKey
      ? { tenantId, roles: roleKey }
      : { tenantId };
    const users = await this.userModel
      .find(filter)
      .select("_id roles")
      .lean()
      .exec();
    await Promise.all(
      users.map(async (user) => {
        const permissions = await this.expandPermissionsForTenant(
          tenantId,
          user.roles ?? [],
        );
        await this.userModel.updateOne(
          { _id: user._id, tenantId },
          { permissions },
        );
      }),
    );
  }

  private static normalizeRoleKey(key: unknown, name: unknown) {
    const base = String(key ?? name ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) {
      throw new BadRequestException("Informe uma chave ou nome válido.");
    }
    return base;
  }

  private static systemRoleLabel(key: string) {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      fleet_manager: "Gestor de Frota",
      operator: "Operador",
      maintenance_analyst: "Analista de Manuten??o",
      finance: "Financeiro",
      driver: "Motorista",
      auditor: "Auditor / Visualizador",
    };
    return labels[key] ?? key;
  }

  private async seedEditableDefaultRoles(tenantId: string) {
    const defaultRoles = Object.entries(ROLE_PERMISSIONS).filter(
      ([key]) => key !== "super_admin",
    );

    await Promise.all(
      defaultRoles.map(async ([key, permissions]) => {
        await this.roleModel.updateOne(
          { tenantId, key },
          {
            $setOnInsert: {
              tenantId,
              key,
              name: UsersService.systemRoleLabel(key),
              description: "Perfil base inicial do sistema.",
              permissions,
              status: "active",
            },
          },
          { upsert: true },
        );
      }),
    );
  }
}

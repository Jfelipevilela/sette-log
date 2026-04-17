import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { hash } from "bcryptjs";
import { FilterQuery, Model } from "mongoose";
import { Types } from "mongoose";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PaginatedResponse } from "../common/types";
import { ROLE_PERMISSIONS } from "./permissions";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./schemas/user.schema";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async findByEmail(email: string, includeSecrets = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (includeSecrets) {
      query.select("+passwordHash +refreshTokenHash");
    }
    return query.exec();
  }

  async findById(id: string, includeSecrets = false) {
    const query = this.userModel.findById(id);
    if (includeSecrets) {
      query.select("+passwordHash +refreshTokenHash");
    }
    return query.exec();
  }

  async list(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<User>> {
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
      data,
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
      throw new ConflictException("Já existe um usuário com este email.");
    }

    const roles = dto.roles?.length ? dto.roles : ["operator"];
    const user = await this.userModel.create({
      tenantId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      branchId: dto.branchId,
      roles,
      permissions: UsersService.expandPermissions(roles),
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
      update.permissions = UsersService.expandPermissions(dto.roles);
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
      throw new BadRequestException("Você não pode excluir o próprio usuário.");
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
      new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])),
    );
  }
}

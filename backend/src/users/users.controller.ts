import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types';
import { PERMISSIONS } from './permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.usersService.list(user.tenantId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.tenantId, id, dto);
  }

  @Post(':id/api-access')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  enableApiAccess(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.enableApiAccess(user.tenantId, id);
  }

  @Delete(':id/api-access')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  disableApiAccess(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.disableApiAccess(user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.remove(user.tenantId, id, user.sub);
  }
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listRoles(user.tenantId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.usersService.createRole(user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.usersService.updateRole(user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.removeRole(user.tenantId, id);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { memoryStorage } from "multer";
import { BackupService } from "../backup/backup.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { RequirePermissions } from "../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../common/types";
import { PERMISSIONS } from "../users/permissions";
import {
  CreateDocumentDto,
  CreateDriverDto,
  CreateTelemetryEventDto,
  CreateVehicleDto,
  UpdateDriverDto,
  UpdateVehicleDto,
} from "./dto/fleet.dto";
import { FleetResource, FleetService } from "./fleet.service";
import { ImportsService } from "./imports.service";
import { TemplateGeneratorService } from "./template-generator.service";
import { DashboardQueryDto, FuelSeriesQueryDto } from "./dto/dashboard.dto";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

type GenericBody = Record<string, unknown>;
const financeResources: FleetResource[] = [
  "expenses",
  "fines",
  "incidents",
  "insurances",
];
const exportResources: FleetResource[] = [
  "vehicles",
  "drivers",
  "fuel-records",
  "maintenance-orders",
  "expenses",
  "fines",
  "incidents",
  "insurances",
  "documents",
  "compliance-checks",
  "alerts",
  "audit-logs",
];
type UploadedSpreadsheetFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @Public()
  health() {
    return {
      status: "ok",
      service: "sette-log-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @Public()
  async readiness() {
    const dbState = this.connection.readyState;
    const pingOk =
      dbState === 1
        ? await this.connection.db
            ?.admin()
            .ping()
            .then(() => true)
            .catch(() => false)
        : false;

    return {
      status: pingOk ? "ready" : "degraded",
      database: {
        connected: dbState === 1,
        ping: Boolean(pingOk),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.fleetService.dashboard(user.tenantId, query.from, query.to);
  }

  @Get("fuel-series")
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  fuelSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FuelSeriesQueryDto,
  ) {
    return this.fleetService.vehicleFuelSeries(
      user.tenantId,
      query.vehicleId,
      query.granularity,
      query.from,
      query.to,
    );
  }
}

@ApiTags("exports")
@ApiBearerAuth()
@Controller("exports")
export class ExportsController {
  constructor(private readonly fleetService: FleetService) {}

  @Get(":resource")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  async exportResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("resource") resource: string,
    @Res() response: Response,
  ) {
    if (!exportResources.includes(resource as FleetResource)) {
      throw new BadRequestException("Recurso de exportação invalido.");
    }
    const csv = await this.fleetService.exportCsv(
      resource as FleetResource,
      user.tenantId,
    );
    const fileName = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
    response.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
    response.send(`\ufeff${csv}`);
  }
}

@ApiTags("vehicles")
@ApiBearerAuth()
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VEHICLES_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("vehicles", user.tenantId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.VEHICLES_VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.get("vehicles", user.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VEHICLES_CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    const created = await this.fleetService.create(
      "vehicles",
      user.tenantId,
      dto as unknown as GenericBody,
    );
    await this.fleetService.createNotification(
      user.tenantId,
      user.sub ?? "",
      `Veículo ${created.plate} cadastrado`,
      `O veículo ${created.plate} foi adicionado à frota.`,
    );
    return created;
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.VEHICLES_EDIT)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    const updated = await this.fleetService.update(
      "vehicles",
      user.tenantId,
      id,
      dto as unknown as GenericBody,
    );
    await this.fleetService.createNotification(
      user.tenantId,
      user.sub ?? "",
      `Veículo ${updated.plate} atualizado`,
      `O veículo ${updated.plate} foi atualizado com sucesso.`,
    );
    return updated;
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.VEHICLES_DELETE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.remove("vehicles", user.tenantId, id);
  }
}

@ApiTags("drivers")
@ApiBearerAuth()
@Controller("drivers")
export class DriversController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DRIVERS_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("drivers", user.tenantId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.DRIVERS_VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.get("drivers", user.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DRIVERS_CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDriverDto,
  ) {
    const created = await this.fleetService.create(
      "drivers",
      user.tenantId,
      dto as unknown as GenericBody,
    );
    await this.fleetService.createNotification(
      user.tenantId,
      user.sub ?? "",
      `Motorista ${created.name} cadastrado`,
      `O motorista ${created.name} foi adicionado ao sistema.`,
    );
    return created;
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.DRIVERS_EDIT)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    const updated = await this.fleetService.update(
      "drivers",
      user.tenantId,
      id,
      dto as unknown as GenericBody,
    );
    await this.fleetService.createNotification(
      user.tenantId,
      user.sub ?? "",
      `Motorista ${updated.name} atualizado`,
      `O motorista ${updated.name} foi atualizado com sucesso.`,
    );
    return updated;
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.DRIVERS_DELETE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.remove("drivers", user.tenantId, id);
  }

  @Post(":id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.DRIVERS_EDIT)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  attachDriverFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.fleetService.attachDriverFile(user.tenantId, id, file);
  }

  @Get(":id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.DRIVERS_VIEW)
  async downloadDriverFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, fileName: originalFileName } =
      await this.fleetService.driverAttachmentStream(
        user.tenantId,
        id,
        fileName,
      );
    response.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${String(originalFileName ?? fileName).replace(/"/g, "")}"`,
    });
    return new StreamableFile(stream);
  }
}

@ApiTags("tracking")
@ApiBearerAuth()
@Controller("tracking")
export class TrackingController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("live")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  live(@CurrentUser() user: AuthenticatedUser) {
    return this.fleetService.trackingSnapshot(user.tenantId);
  }

  @Get("positions")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  positions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("gps-positions", user.tenantId, query);
  }

  @Get("vehicles/:vehicleId/playback")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  playback(
    @CurrentUser() user: AuthenticatedUser,
    @Param("vehicleId") vehicleId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.fleetService.routePlayback(user.tenantId, vehicleId, from, to);
  }

  @Get("geofences")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  geofences(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("geofences", user.tenantId, query);
  }

  @Post("geofences")
  @RequirePermissions(PERMISSIONS.ALERTS_MANAGE)
  createGeofence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("geofences", user.tenantId, body);
  }
}

@ApiTags("telemetry")
@ApiBearerAuth()
@Controller("telemetry")
export class TelemetryController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("events")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  events(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("telemetry-events", user.tenantId, query);
  }

  @Post("ingest")
  @RequirePermissions(PERMISSIONS.TRACKING_VIEW)
  ingest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTelemetryEventDto,
  ) {
    return this.fleetService.ingestTelemetry(
      user.tenantId,
      dto as unknown as GenericBody,
    );
  }
}

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller("maintenance")
export class MaintenanceController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("plans")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW)
  plans(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("maintenance-plans", user.tenantId, query);
  }

  @Post("plans")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE)
  createPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("maintenance-plans", user.tenantId, body);
  }

  @Get("orders")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW)
  orders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("maintenance-orders", user.tenantId, query);
  }

  @Post("orders")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE)
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("maintenance-orders", user.tenantId, body);
  }

  @Patch("orders/:id")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_EDIT)
  updateOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.update(
      "maintenance-orders",
      user.tenantId,
      id,
      body,
    );
  }

  @Delete("orders/:id")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_DELETE)
  removeOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.remove("maintenance-orders", user.tenantId, id);
  }

  @Post("orders/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_EDIT)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  attachOrderFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.fleetService.attachMaintenanceOrderFile(user.tenantId, id, file);
  }

  @Get("orders/:id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW)
  async downloadOrderFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, fileName: originalFileName } =
      await this.fleetService.maintenanceOrderAttachmentStream(
        user.tenantId,
        id,
        fileName,
      );
    response.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${String(originalFileName ?? fileName).replace(/"/g, "")}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete("orders/:id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.MAINTENANCE_DELETE)
  removeOrderFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
  ) {
    return this.fleetService.removeMaintenanceOrderAttachment(
      user.tenantId,
      id,
      fileName,
    );
  }
}

@ApiTags("finance")
@ApiBearerAuth()
@Controller("finance")
export class FinanceController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("fuel-records")
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  fuelRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("fuel-records", user.tenantId, query);
  }

  @Get("fuel-records/summary")
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  fuelRecordsSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.fleetService.fuelRecordsSummary(user.tenantId);
  }

  @Get("driver-portal/context")
  @RequirePermissions(PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS)
  driverPortalContext(@CurrentUser() user: AuthenticatedUser) {
    return this.fleetService.driverPortalContext(user.tenantId, user);
  }

  @Get("driver-portal/fuel-records")
  @RequirePermissions(PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS)
  driverPortalFuelRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.driverPortalFuelRecords(user.tenantId, user, query);
  }

  @Post("driver-portal/fuel-records")
  @RequirePermissions(PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS)
  driverPortalCreateFuelRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.createDriverPortalFuelRecord(
      user.tenantId,
      user,
      body,
    );
  }

  @Post("driver-portal/fuel-records/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        category: {
          type: "string",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  driverPortalAttachFuelRecordFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.fleetService.attachDriverPortalFuelRecordFile(
      user.tenantId,
      user,
      id,
      file,
      body,
    );
  }

  @Get("driver-portal/fuel-records/:id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS)
  async driverPortalDownloadFuelRecordFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, attachment } =
      await this.fleetService.driverPortalFuelRecordAttachmentStream(
        user.tenantId,
        user,
        id,
        fileName,
      );
    response.set({
      "Content-Type": String(attachment.mimeType ?? "application/octet-stream"),
      "Content-Disposition": `attachment; filename="${String(attachment.originalName ?? fileName).replace(/"/g, "")}"`,
    });
    return new StreamableFile(stream);
  }

  @Post("fuel-records")
  @RequirePermissions(PERMISSIONS.FINANCE_CREATE)
  createFuelRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("fuel-records", user.tenantId, body);
  }

  @Patch("fuel-records/:id")
  @RequirePermissions(PERMISSIONS.FINANCE_EDIT)
  updateFuelRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.update("fuel-records", user.tenantId, id, body);
  }

  @Delete("fuel-records/:id")
  @RequirePermissions(PERMISSIONS.FINANCE_DELETE)
  removeFuelRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.fleetService.remove("fuel-records", user.tenantId, id);
  }

  @Post("fuel-records/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        recalculateFuelTotal: {
          type: "boolean",
          description:
            "Quando true, recalcula valor_total de abastecimentos usando litros x preco_litro.",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.FINANCE_EDIT)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  attachFuelRecordFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.fleetService.attachFuelRecordFile(
      user.tenantId,
      id,
      file,
      body,
    );
  }

  @Get("fuel-records/:id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async downloadFuelRecordFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, attachment } =
      await this.fleetService.fuelRecordAttachmentStream(
        user.tenantId,
        id,
        fileName,
      );
    response.set({
      "Content-Type": String(attachment.mimeType ?? "application/octet-stream"),
      "Content-Disposition": `attachment; filename="${String(attachment.originalName ?? fileName).replace(/"/g, "")}"`,
    });
    return new StreamableFile(stream);
  }

  @Get(":resource")
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  listResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("resource") resource: string,
    @Query() query: PaginationQueryDto,
  ) {
    if (!financeResources.includes(resource as FleetResource)) {
      throw new BadRequestException("Recurso financeiro invalido.");
    }
    return this.fleetService.list(
      resource as FleetResource,
      user.tenantId,
      query,
    );
  }

  @Post(":resource")
  @RequirePermissions(PERMISSIONS.FINANCE_CREATE)
  createResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("resource") resource: string,
    @Body() body: GenericBody,
  ) {
    if (!financeResources.includes(resource as FleetResource)) {
      throw new BadRequestException("Recurso financeiro invalido.");
    }
    return this.fleetService.create(
      resource as FleetResource,
      user.tenantId,
      body,
    );
  }

  @Patch(":resource/:id")
  @RequirePermissions(PERMISSIONS.FINANCE_EDIT)
  updateResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    if (!financeResources.includes(resource as FleetResource)) {
      throw new BadRequestException("Recurso financeiro invalido.");
    }
    return this.fleetService.update(
      resource as FleetResource,
      user.tenantId,
      id,
      body,
    );
  }

  @Delete(":resource/:id")
  @RequirePermissions(PERMISSIONS.FINANCE_DELETE)
  removeResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("resource") resource: string,
    @Param("id") id: string,
  ) {
    if (!financeResources.includes(resource as FleetResource)) {
      throw new BadRequestException("Recurso financeiro invalido.");
    }
    return this.fleetService.remove(
      resource as FleetResource,
      user.tenantId,
      id,
    );
  }
}

@ApiTags("compliance")
@ApiBearerAuth()
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("documents")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  documents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("documents", user.tenantId, query);
  }

  @Post("documents")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_CREATE)
  createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.fleetService.create(
      "documents",
      user.tenantId,
      dto as unknown as GenericBody,
    );
  }

  @Patch("documents/:id")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_EDIT)
  updateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.update("documents", user.tenantId, id, body);
  }

  @Delete("documents/:id")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_DELETE)
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.fleetService.remove("documents", user.tenantId, id);
  }

  @Get("checks")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  checks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("compliance-checks", user.tenantId, query);
  }

  @Post("checks")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_CREATE)
  createCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("compliance-checks", user.tenantId, body);
  }

  @Patch("checks/:id")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_EDIT)
  updateCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.update(
      "compliance-checks",
      user.tenantId,
      id,
      body,
    );
  }

  @Delete("checks/:id")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_DELETE)
  removeCheck(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.remove("compliance-checks", user.tenantId, id);
  }

  @Post("checks/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.COMPLIANCE_EDIT)
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  attachCheckFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFiles() files?: UploadedSpreadsheetFile[],
  ) {
    return this.fleetService.attachComplianceCheckFiles(
      user.tenantId,
      id,
      files,
    );
  }

  @Get("checks/:id/attachments/:fileName")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  async downloadCheckFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, attachment } =
      await this.fleetService.complianceCheckAttachmentStream(
        user.tenantId,
        id,
        fileName,
      );
    response.set({
      "Content-Type": String(attachment.mimeType ?? "application/octet-stream"),
      "Content-Disposition": `attachment; filename="${String(attachment.originalName ?? fileName).replace(/"/g, "")}"`,
    });
    return new StreamableFile(stream);
  }

  @Get("audit-logs")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  auditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("audit-logs", user.tenantId, query);
  }

  @Get("audit-logs/entity/:id")
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  auditTrail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.auditTrailForEntity(user.tenantId, id);
  }
}

@ApiTags("alerts")
@ApiBearerAuth()
@Controller("alerts")
export class AlertsController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("alerts", user.tenantId, query);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ALERTS_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.update("alerts", user.tenantId, id, body);
  }
}

@ApiTags("settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly fleetService: FleetService,
    private readonly templateGenerator: TemplateGeneratorService,
    private readonly backupService: BackupService,
  ) {}

  @Get("branches")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  branches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("branches", user.tenantId, query);
  }

  @Post("branches")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  createBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("branches", user.tenantId, body);
  }

  @Get("integrations")
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  integrations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("integrations", user.tenantId, query);
  }

  @Post("integrations")
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  createIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("integrations", user.tenantId, body);
  }

  @Get("webhooks")
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  webhooks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("webhooks", user.tenantId, query);
  }

  @Post("webhooks")
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  createWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.create("webhooks", user.tenantId, body);
  }

  @Get("parameters")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  parameters(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.list("settings", user.tenantId, query);
  }

  @Post("parameters")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  createParameter(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenericBody,
  ) {
    return this.fleetService.upsertSetting(user.tenantId, body);
  }

  @Get("system-export")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async downloadSystemExport(
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.templateGenerator.generateSystemExport(
      user.tenantId,
    );
    response.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename=sette-log-dados-completos.xlsx",
      "Content-Length": buffer.length,
    });
    response.send(buffer);
  }

  @Get("backups")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  listBackups() {
    return this.backupService.listBackups();
  }

  @Post("backups/run")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async runBackup() {
    const filePath = await this.backupService.runBackup();
    return {
      success: true,
      filePath,
    };
  }

  @Get("backups/:fileName")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async downloadBackup(
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.backupService.backupStream(fileName);
    response.set({
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
    });
    return new StreamableFile(file.stream);
  }
}

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fleetService.listNotifications(
      user.tenantId,
      user.sub ?? "",
      query,
    );
  }

  @Post(":id/read")
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fleetService.markNotificationRead(
      user.tenantId,
      id,
      user.sub ?? "",
    );
  }
}

@ApiTags("imports")
@ApiBearerAuth()
@Controller("imports")
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly templateGenerator: TemplateGeneratorService,
  ) {}

  @Get("template")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async downloadTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.templateGenerator.generateTemplate(user.tenantId);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename=sette-log-importação-template.xlsx",
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  @Post("spreadsheet")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["resource", "file"],
      properties: {
        resource: {
          type: "string",
          enum: [
            "vehicles",
            "drivers",
            "fuel-records",
            "maintenance-orders",
            "expenses",
            "documents",
          ],
        },
        file: {
          type: "string",
          format: "binary",
        },
        recalculateFuelTotal: {
          type: "boolean",
          description:
            "Quando true, recalcula valor_total de abastecimentos usando litros x preco_litro.",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  importSpreadsheet(
    @CurrentUser() user: AuthenticatedUser,
    @Body("resource") resource: string,
    @Body("recalculateFuelTotal") recalculateFuelTotal?: string,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.importsService.importSpreadsheet(user.tenantId, resource, file, {
      recalculateFuelTotal: recalculateFuelTotal === "true",
    });
  }

  @Post("spreadsheet/complete")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  importCompleteLegacySpreadsheet(
    @CurrentUser() user: AuthenticatedUser,
    @Body("recalculateFuelTotal") recalculateFuelTotal?: string,
    @UploadedFile() file?: UploadedSpreadsheetFile,
  ) {
    return this.importsService.importCompleteLegacySpreadsheet(
      user.tenantId,
      file,
      {
        recalculateFuelTotal: recalculateFuelTotal === "true",
      },
    );
  }
}

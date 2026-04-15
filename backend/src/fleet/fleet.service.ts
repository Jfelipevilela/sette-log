import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { basename, extname, join, resolve } from 'path';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../common/types';
import {
  Alert,
  AuditLog,
  Branch,
  ComplianceCheck,
  DocumentRecord,
  Driver,
  Expense,
  Fine,
  FuelRecord,
  Geofence,
  GpsPosition,
  Incident,
  Insurance,
  Integration,
  MaintenanceHistory,
  MaintenanceOrder,
  MaintenancePlan,
  NotificationRecord,
  Setting,
  TelemetryEvent,
  Tracker,
  Trip,
  Vehicle,
  Webhook
} from './schemas/fleet.schemas';
import { User } from '../users/schemas/user.schema';

export type FleetResource =
  | 'branches'
  | 'vehicles'
  | 'drivers'
  | 'trackers'
  | 'telemetry-events'
  | 'gps-positions'
  | 'geofences'
  | 'trips'
  | 'maintenance-plans'
  | 'maintenance-orders'
  | 'maintenance-history'
  | 'fuel-records'
  | 'expenses'
  | 'fines'
  | 'incidents'
  | 'insurances'
  | 'documents'
  | 'compliance-checks'
  | 'notifications'
  | 'alerts'
  | 'audit-logs'
  | 'integrations'
  | 'webhooks'
  | 'settings';

type AnyRecord = Record<string, unknown>;
type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const resourceModels: Record<FleetResource, string> = {
  branches: Branch.name,
  vehicles: Vehicle.name,
  drivers: Driver.name,
  trackers: Tracker.name,
  'telemetry-events': TelemetryEvent.name,
  'gps-positions': GpsPosition.name,
  geofences: Geofence.name,
  trips: Trip.name,
  'maintenance-plans': MaintenancePlan.name,
  'maintenance-orders': MaintenanceOrder.name,
  'maintenance-history': MaintenanceHistory.name,
  'fuel-records': FuelRecord.name,
  expenses: Expense.name,
  fines: Fine.name,
  incidents: Incident.name,
  insurances: Insurance.name,
  documents: DocumentRecord.name,
  'compliance-checks': ComplianceCheck.name,
  notifications: NotificationRecord.name,
  alerts: Alert.name,
  'audit-logs': AuditLog.name,
  integrations: Integration.name,
  webhooks: Webhook.name,
  settings: Setting.name
};

const searchableFields: Partial<Record<FleetResource, string[]>> = {
  branches: ['name', 'code', 'city', 'state'],
  vehicles: ['plate', 'brand', 'model', 'vin', 'costCenter'],
  drivers: ['name', 'licenseNumber', 'cpf', 'email'],
  trackers: ['imei', 'provider'],
  geofences: ['name'],
  'maintenance-plans': ['name'],
  'maintenance-orders': ['type', 'priority', 'status'],
  expenses: ['category', 'description', 'costCenter'],
  documents: ['entityType', 'type', 'number'],
  alerts: ['type', 'severity', 'status'],
  integrations: ['type', 'provider'],
  webhooks: ['name', 'url'],
  settings: ['key', 'scope']
};

@Injectable()
export class FleetService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async list(resource: FleetResource, tenantId: string, query: PaginationQueryDto): Promise<PaginatedResponse<AnyRecord>> {
    const model = this.model(resource);
    const filter: FilterQuery<AnyRecord> = {
      tenantId,
      ...this.parseFilters(query.filters)
    };

    if (query.search) {
      const fields = searchableFields[resource] ?? [];
      filter.$or = fields.map((field) => ({ [field]: { $regex: query.search, $options: 'i' } }));
    }

    const page = query.page;
    const limit = query.limit;
    const sortBy = this.safeSortField(query.sortBy ?? 'createdAt');
    const sortDir = query.sortDir === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      model
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<AnyRecord[]>()
        .exec(),
      model.countDocuments(filter)
    ]);

    return {
      data: data.map((record) => this.serialize(record)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async get(resource: FleetResource, tenantId: string, id: string) {
    const record = await this.model(resource).findOne({ _id: id, tenantId }).lean<AnyRecord>().exec();
    if (!record) {
      throw new NotFoundException('Registro nao encontrado.');
    }
    return this.serialize(record);
  }

  async create(resource: FleetResource, tenantId: string, payload: AnyRecord) {
    const normalized = await this.beforeCreate(resource, tenantId, this.cleanPayload(payload));
    const created = await this.model(resource).create({ tenantId, ...normalized });
    await this.afterCreate(resource, tenantId, created.toObject() as AnyRecord);
    return this.serialize(created.toObject());
  }

  async update(resource: FleetResource, tenantId: string, id: string, payload: AnyRecord) {
    const before = await this.model(resource).findOne({ _id: id, tenantId }).lean<AnyRecord>().exec();
    if (!before) {
      throw new NotFoundException('Registro nao encontrado.');
    }

    const normalized = await this.beforeUpdate(resource, tenantId, id, this.cleanPayload(payload), before);
    const updated = await this.model(resource)
      .findOneAndUpdate({ _id: id, tenantId }, normalized, { new: true })
      .lean<AnyRecord>()
      .exec();
    if (!updated) {
      throw new NotFoundException('Registro nao encontrado.');
    }
    await this.afterUpdate(resource, tenantId, updated, before);
    return this.serialize(updated);
  }

  async remove(resource: FleetResource, tenantId: string, id: string) {
    const deleted = await this.model(resource).findOneAndDelete({ _id: id, tenantId }).lean<AnyRecord>().exec();
    if (!deleted) {
      throw new NotFoundException('Registro nao encontrado.');
    }
    await this.afterRemove(resource, tenantId, deleted);
    return { success: true, deletedId: id };
  }

  async upsertSetting(tenantId: string, payload: AnyRecord) {
    if (!payload.key) {
      throw new BadRequestException('Parametro precisa de uma chave.');
    }

    const scope = String(payload.scope ?? 'tenant');
    const scopeId = payload.scopeId ? String(payload.scopeId) : undefined;
    const setting = await this.model('settings')
      .findOneAndUpdate(
        { tenantId, scope, scopeId, key: String(payload.key) },
        {
          tenantId,
          scope,
          scopeId,
          key: String(payload.key),
          value: payload.value
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean<AnyRecord>()
      .exec();

    return this.serialize(setting);
  }

  async ingestTelemetry(tenantId: string, payload: AnyRecord) {
    const occurredAt = payload.occurredAt ? new Date(String(payload.occurredAt)) : new Date();
    const telemetry = await this.create('telemetry-events', tenantId, {
      ...payload,
      occurredAt
    });
    return telemetry;
  }

  async trackingSnapshot(tenantId: string) {
    const vehicles = await this.model('vehicles')
      .find({ tenantId, status: { $nin: ['inactive', 'blocked'] } })
      .sort({ updatedAt: -1 })
      .limit(250)
      .lean<AnyRecord[]>()
      .exec();
    const geofences = await this.model('geofences').find({ tenantId, status: 'active' }).lean<AnyRecord[]>().exec();

    return {
      vehicles: this.serialize(vehicles),
      geofences: this.serialize(geofences),
      refreshedAt: new Date().toISOString()
    };
  }

  async routePlayback(tenantId: string, vehicleId: string, from?: string, to?: string) {
    const filter: FilterQuery<AnyRecord> = { tenantId, vehicleId };
    if (from || to) {
      filter.occurredAt = {};
      if (from) {
        (filter.occurredAt as AnyRecord).$gte = new Date(from);
      }
      if (to) {
        (filter.occurredAt as AnyRecord).$lte = new Date(to);
      }
    }

    const positions = await this.model('gps-positions').find(filter).sort({ occurredAt: 1 }).limit(5000).lean<AnyRecord[]>().exec();
    return this.serialize(positions);
  }

  async dashboard(tenantId: string, from?: string, to?: string) {
    const vehicleModel = this.model('vehicles');
    const driverModel = this.model('drivers');
    const alertModel = this.model('alerts');
    const maintenanceModel = this.model('maintenance-orders');
    const fuelModel = this.model('fuel-records');
    const expenseModel = this.model('expenses');
    const documentModel = this.model('documents');
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const periodFrom = from ? new Date(from) : defaultFrom;
    const periodTo = to ? new Date(to) : now;
    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      throw new BadRequestException('Periodo invalido para dashboard.');
    }
    periodTo.setHours(23, 59, 59, 999);
    const fuelPeriodMatch = { tenantId, filledAt: { $gte: periodFrom, $lte: periodTo } };

    const [
      totalVehicles,
      availableVehicles,
      vehiclesByStatus,
      activeDrivers,
      openAlerts,
      criticalVehicles,
      upcomingMaintenance,
      expiringDocuments,
      fuelCost,
      expenseCost,
      costByMonth,
      fuelByVehicle,
      recentAlerts
    ] = await Promise.all([
      vehicleModel.countDocuments({ tenantId }),
      vehicleModel.countDocuments({ tenantId, status: { $in: ['available', 'in_route', 'stopped'] } }),
      vehicleModel.aggregate([{ $match: { tenantId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      driverModel.countDocuments({ tenantId, status: 'active' }),
      alertModel.countDocuments({ tenantId, status: 'open' }),
      vehicleModel
        .find({ tenantId, status: { $in: ['maintenance', 'blocked'] } })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean<AnyRecord[]>()
        .exec(),
      maintenanceModel
        .find({ tenantId, status: { $in: ['open', 'scheduled'] }, scheduledAt: { $lte: next30 } })
        .sort({ scheduledAt: 1 })
        .limit(8)
        .lean<AnyRecord[]>()
        .exec(),
      documentModel
        .find({ tenantId, expiresAt: { $lte: next30 }, status: { $ne: 'archived' } })
        .sort({ expiresAt: 1 })
        .limit(8)
        .lean<AnyRecord[]>()
        .exec(),
      fuelModel.aggregate([{ $match: fuelPeriodMatch }, { $group: { _id: null, total: { $sum: '$totalCost' }, liters: { $sum: '$liters' } } }]),
      expenseModel.aggregate([{ $match: { tenantId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      fuelModel.aggregate([
        { $match: fuelPeriodMatch },
        {
          $group: {
            _id: { year: { $year: '$filledAt' }, month: { $month: '$filledAt' } },
            total: { $sum: '$totalCost' },
            liters: { $sum: '$liters' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      fuelModel.aggregate([
        { $match: fuelPeriodMatch },
        {
          $group: {
            _id: '$vehicleId',
            totalCost: { $sum: '$totalCost' },
            totalLiters: { $sum: '$liters' },
            records: { $sum: 1 },
            lastFuelAt: { $max: '$filledAt' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]),
      alertModel.find({ tenantId }).sort({ triggeredAt: -1 }).limit(10).lean<AnyRecord[]>().exec()
    ]);

    const totalFuelCost = Number(fuelCost[0]?.total ?? 0);
    const totalFuelLiters = Number(fuelCost[0]?.liters ?? 0);
    const totalExpenseCost = Number(expenseCost[0]?.total ?? 0);
    const fuelVehicleIds = fuelByVehicle.map((item) => item._id).filter(Boolean).map(String);
    const fuelVehicles = fuelVehicleIds.length
      ? await vehicleModel
          .find({ tenantId, _id: { $in: fuelVehicleIds } })
          .select('plate brand model nickname tankCapacityLiters')
          .lean<AnyRecord[]>()
          .exec()
      : [];
    const vehicleById = new Map(fuelVehicles.map((vehicle) => [String(vehicle._id), vehicle]));
    const fuelByVehicleDetailed = fuelByVehicle.map((item) => {
      const vehicle = vehicleById.get(String(item._id));
      const totalLiters = Number(item.totalLiters ?? 0);
      const totalCost = Number(item.totalCost ?? 0);
      return {
        vehicleId: String(item._id),
        plate: vehicle?.plate ?? String(item._id),
        label: vehicle?.nickname || `${vehicle?.brand ?? ''} ${vehicle?.model ?? ''}`.trim() || vehicle?.plate || String(item._id),
        nickname: vehicle?.nickname,
        brand: vehicle?.brand,
        model: vehicle?.model,
        tankCapacityLiters: vehicle?.tankCapacityLiters,
        totalCost,
        totalLiters,
        records: Number(item.records ?? 0),
        averagePrice: totalLiters ? totalCost / totalLiters : 0,
        lastFuelAt: item.lastFuelAt
      };
    });

    return this.serialize({
      kpis: {
        totalVehicles,
        availableVehicles,
        activeDrivers,
        openAlerts,
        availability: totalVehicles ? Math.round((availableVehicles / totalVehicles) * 100) : 0,
        totalFuelCost,
        totalFuelLiters,
        totalExpenseCost,
        averageFuelCost: totalFuelLiters ? totalFuelCost / totalFuelLiters : 0
      },
      vehiclesByStatus,
      criticalVehicles,
      upcomingMaintenance,
      expiringDocuments,
      costByMonth,
      fuelByVehicle: fuelByVehicleDetailed,
      topFuelCostVehicles: fuelByVehicleDetailed.slice(0, 8),
      dashboardPeriod: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString()
      },
      recentAlerts,
      generatedAt: now.toISOString()
    });
  }

  async auditTrailForEntity(tenantId: string, entityId: string) {
    const auditLogs = await this.model('audit-logs')
      .find({
        tenantId,
        $or: [{ resourceId: entityId }, { 'after._id': entityId }, { 'after.deletedId': entityId }]
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<AnyRecord[]>()
      .exec();

    const actorIds = [...new Set(auditLogs.map((log) => log.actorUserId).filter(Boolean).map(String))];
    const users = actorIds.length
      ? await this.connection
          .model(User.name)
          .find({ tenantId, _id: { $in: actorIds } })
          .select('name email')
          .lean<Array<{ _id: unknown; name: string; email: string }>>()
          .exec()
      : [];
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    return this.serialize(
      auditLogs.map((log) => {
        const actor = log.actorUserId ? usersById.get(String(log.actorUserId)) : undefined;
        return {
          ...log,
          actorName: actor?.name ?? 'Sistema',
          actorEmail: actor?.email
        };
      })
    );
  }

  async attachFuelRecordFile(tenantId: string, id: string, file?: UploadedFile) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo "file".');
    }
    const record = await this.model('fuel-records').findOne({ tenantId, _id: id }).lean<AnyRecord>().exec();
    if (!record) {
      throw new NotFoundException('Abastecimento nao encontrado.');
    }

    const uploadsRoot = resolve(process.cwd(), 'uploads', 'fuel-records', tenantId, id);
    await mkdir(uploadsRoot, { recursive: true });
    const extension = extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${new Types.ObjectId().toString()}${extension}`;
    const targetPath = join(uploadsRoot, fileName);
    await writeFile(targetPath, file.buffer);

    const attachment = {
      originalName: file.originalname,
      fileName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };
    const updated = await this.model('fuel-records')
      .findOneAndUpdate({ tenantId, _id: id }, { $push: { attachments: attachment } }, { new: true })
      .lean<AnyRecord>()
      .exec();
    return this.serialize(updated);
  }

  async fuelRecordAttachmentStream(tenantId: string, id: string, fileName: string) {
    const safeFileName = basename(fileName);
    const record = await this.model('fuel-records').findOne({ tenantId, _id: id }).lean<AnyRecord>().exec();
    if (!record) {
      throw new NotFoundException('Abastecimento nao encontrado.');
    }
    const attachments = (record.attachments ?? []) as Array<Record<string, unknown>>;
    const attachment = attachments.find((item) => item.fileName === safeFileName);
    if (!attachment) {
      throw new NotFoundException('Anexo nao encontrado.');
    }
    const filePath = resolve(process.cwd(), 'uploads', 'fuel-records', tenantId, id, safeFileName);
    return {
      stream: createReadStream(filePath),
      attachment
    };
  }

  private model(resource: FleetResource): Model<AnyRecord> {
    const modelName = resourceModels[resource];
    if (!modelName) {
      throw new BadRequestException('Recurso invalido.');
    }
    return this.connection.model<AnyRecord>(modelName);
  }

  private parseFilters(filters?: string): AnyRecord {
    if (!filters) {
      return {};
    }

    try {
      const parsed = JSON.parse(filters) as AnyRecord;
      return Object.fromEntries(
        Object.entries(parsed).filter(([key, value]) => !key.startsWith('$') && value !== undefined && value !== null)
      );
    } catch {
      throw new BadRequestException('Filtros invalidos. Envie JSON valido.');
    }
  }

  private safeSortField(field: string) {
    if (field.startsWith('$') || field.includes('__')) {
      return 'createdAt';
    }
    return field;
  }

  private cleanPayload(payload: AnyRecord) {
    const clone = { ...payload };
    delete clone.tenantId;
    delete clone._id;
    delete clone.createdAt;
    delete clone.updatedAt;
    return clone;
  }

  private async beforeCreate(resource: FleetResource, tenantId: string, payload: AnyRecord) {
    if (resource === 'vehicles') {
      return this.prepareVehicle(tenantId, payload);
    }
    if (resource === 'drivers') {
      return this.prepareDriver(tenantId, payload);
    }
    if (resource === 'fuel-records') {
      return this.prepareFuel(payload, tenantId);
    }
    if (resource === 'documents') {
      return this.prepareDocument(payload);
    }
    if (resource === 'maintenance-orders') {
      return this.prepareMaintenanceOrder(payload);
    }
    return payload;
  }

  private async beforeUpdate(
    resource: FleetResource,
    tenantId: string,
    id: string,
    payload: AnyRecord,
    before: AnyRecord
  ) {
    if (resource === 'vehicles') {
      return this.prepareVehicle(tenantId, payload, id);
    }
    if (resource === 'drivers') {
      return this.prepareDriver(tenantId, payload, id);
    }
    if (resource === 'documents') {
      return this.prepareDocument({ ...before, ...payload });
    }
    if (resource === 'fuel-records') {
      return this.prepareFuel({ ...before, ...payload }, tenantId);
    }
    return payload;
  }

  private async afterCreate(resource: FleetResource, tenantId: string, record: AnyRecord) {
    if (resource === 'drivers' && record.assignedVehicleId) {
      await this.model('vehicles').updateOne({ _id: record.assignedVehicleId, tenantId }, { primaryDriverId: record._id });
    }
    if (resource === 'drivers') {
      await this.createDriverLicenseAlertIfNeeded(tenantId, record);
    }
    if (resource === 'vehicles' && record.primaryDriverId) {
      await this.model('drivers').updateOne({ _id: record.primaryDriverId, tenantId }, { assignedVehicleId: record._id });
    }
    if (resource === 'fuel-records') {
      await this.applyFuelImpact(tenantId, record);
    }
    if (resource === 'expenses' && record.vehicleId) {
      await this.applyExpenseImpact(tenantId, record.vehicleId as string, Number(record.amount ?? 0));
    }
    if ((resource === 'fines' || resource === 'incidents') && record.vehicleId) {
      await this.applyExpenseImpact(tenantId, record.vehicleId as string, Number(record.amount ?? 0));
    }
    if (resource === 'documents') {
      await this.createDocumentAlertIfNeeded(tenantId, record);
    }
    if (resource === 'maintenance-orders') {
      await this.applyMaintenanceImpact(tenantId, record);
    }
    if (resource === 'telemetry-events') {
      await this.applyTelemetryImpact(tenantId, record);
    }
  }

  private async afterUpdate(resource: FleetResource, tenantId: string, updated: AnyRecord, before: AnyRecord) {
    if (resource === 'drivers' && updated.assignedVehicleId !== before.assignedVehicleId) {
      if (before.assignedVehicleId) {
        await this.model('vehicles').updateOne({ _id: before.assignedVehicleId, tenantId }, { $unset: { primaryDriverId: '' } });
      }
      if (updated.assignedVehicleId) {
        await this.model('vehicles').updateOne({ _id: updated.assignedVehicleId, tenantId }, { primaryDriverId: updated._id });
      }
    }
    if (resource === 'vehicles' && updated.primaryDriverId !== before.primaryDriverId) {
      if (before.primaryDriverId) {
        await this.model('drivers').updateOne({ _id: before.primaryDriverId, tenantId }, { $unset: { assignedVehicleId: '' } });
      }
      if (updated.primaryDriverId) {
        await this.model('drivers').updateOne({ _id: updated.primaryDriverId, tenantId }, { assignedVehicleId: updated._id });
      }
    }
    if (resource === 'documents') {
      await this.createDocumentAlertIfNeeded(tenantId, updated);
    }
    if (resource === 'maintenance-orders') {
      await this.applyMaintenanceImpact(tenantId, updated);
    }
    if (resource === 'fuel-records') {
      const affectedVehicleIds = new Set([updated.vehicleId, before.vehicleId].filter(Boolean).map((vehicleId) => String(vehicleId)));
      await Promise.all([...affectedVehicleIds].map((vehicleId) => this.recalculateVehicleFinancialSummary(tenantId, vehicleId)));
    }
  }

  private async afterRemove(resource: FleetResource, tenantId: string, deleted: AnyRecord) {
    if (resource === 'drivers') {
      await this.model('vehicles').updateMany({ tenantId, primaryDriverId: String(deleted._id) }, { $unset: { primaryDriverId: '' } });
    }
    if (resource === 'vehicles') {
      const vehicleId = String(deleted._id);
      await this.model('drivers').updateMany({ tenantId, assignedVehicleId: vehicleId }, { $unset: { assignedVehicleId: '' } });
      await Promise.all([
        this.model('gps-positions').deleteMany({ tenantId, vehicleId }),
        this.model('telemetry-events').deleteMany({ tenantId, vehicleId }),
        this.model('alerts').deleteMany({ tenantId, vehicleId })
      ]);
    }
    if (resource === 'maintenance-orders' && deleted.status === 'in_progress' && deleted.vehicleId) {
      await this.model('vehicles').updateOne({ tenantId, _id: deleted.vehicleId, status: 'maintenance' }, { status: 'available' });
    }
    if (resource === 'fuel-records' && deleted.vehicleId) {
      await this.recalculateVehicleFinancialSummary(tenantId, String(deleted.vehicleId));
    }
  }

  private async prepareVehicle(tenantId: string, payload: AnyRecord, currentId?: string) {
    if (payload.plate) {
      payload.plate = String(payload.plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    if (payload.tankCapacityLiters !== undefined && payload.tankCapacityLiters !== null && payload.tankCapacityLiters !== '') {
      const tankCapacityLiters = Number(payload.tankCapacityLiters);
      if (!Number.isFinite(tankCapacityLiters) || tankCapacityLiters <= 0) {
        throw new BadRequestException('Capacidade do tanque precisa ser maior que zero.');
      }
      payload.tankCapacityLiters = tankCapacityLiters;
    }
    if (payload.primaryDriverId) {
      const existing = await this.model('vehicles')
        .findOne({
          tenantId,
          primaryDriverId: payload.primaryDriverId,
          ...(currentId ? { _id: { $ne: currentId } } : {})
        })
        .lean()
        .exec();
      if (existing) {
        throw new ConflictException('Motorista ja esta vinculado como principal a outro veiculo.');
      }
    }
    return payload;
  }

  private async prepareDriver(tenantId: string, payload: AnyRecord, currentId?: string) {
    if (payload.assignedVehicleId) {
      const existing = await this.model('drivers')
        .findOne({
          tenantId,
          assignedVehicleId: payload.assignedVehicleId,
          ...(currentId ? { _id: { $ne: currentId } } : {})
        })
        .lean()
        .exec();
      if (existing) {
        throw new ConflictException('Veiculo ja possui outro motorista principal vinculado.');
      }
    }
    if (payload.licenseExpiresAt) {
      payload.licenseExpiresAt = new Date(String(payload.licenseExpiresAt));
    }
    return payload;
  }

  private async prepareFuel(payload: AnyRecord, tenantId?: string) {
    const liters = Number(payload.liters ?? 0);
    const totalCost = Number(payload.totalCost ?? 0);
    const pricePerLiter = payload.pricePerLiter ? Number(payload.pricePerLiter) : totalCost / liters;
    if (liters <= 0 || totalCost < 0) {
      throw new BadRequestException('Abastecimento precisa ter litros e custo validos.');
    }
    if (!Number.isFinite(pricePerLiter) || pricePerLiter <= 0) {
      throw new BadRequestException('Valor por litro precisa ser maior que zero.');
    }
    const expectedTotal = liters * pricePerLiter;
    if (Math.abs(expectedTotal - totalCost) > 0.05) {
      throw new BadRequestException('Litros x valor por litro nao conferem com o valor total informado.');
    }
    if (tenantId && payload.vehicleId) {
      const vehicle = await this.model('vehicles').findOne({ tenantId, _id: payload.vehicleId }).lean<AnyRecord>().exec();
      const tankCapacityLiters = Number(vehicle?.tankCapacityLiters ?? 0);
      if (tankCapacityLiters > 0 && liters > tankCapacityLiters) {
        throw new BadRequestException(`Litros informados (${liters}) excedem a capacidade do tanque (${tankCapacityLiters} L).`);
      }
    }
    return {
      ...payload,
      liters,
      totalCost,
      pricePerLiter,
      filledAt: payload.filledAt ? new Date(String(payload.filledAt)) : new Date()
    };
  }

  private prepareDocument(payload: AnyRecord) {
    const expiresAt = payload.expiresAt ? new Date(String(payload.expiresAt)) : undefined;
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let status = payload.status ?? 'valid';
    if (expiresAt && expiresAt < now) {
      status = 'expired';
    } else if (expiresAt && expiresAt <= next30) {
      status = 'expiring';
    }

    return {
      ...payload,
      issuedAt: payload.issuedAt ? new Date(String(payload.issuedAt)) : payload.issuedAt,
      expiresAt,
      status
    };
  }

  private prepareMaintenanceOrder(payload: AnyRecord) {
    return {
      ...payload,
      scheduledAt: payload.scheduledAt ? new Date(String(payload.scheduledAt)) : payload.scheduledAt,
      startedAt: payload.startedAt ? new Date(String(payload.startedAt)) : payload.startedAt,
      closedAt: payload.closedAt ? new Date(String(payload.closedAt)) : payload.closedAt
    };
  }

  private async applyFuelImpact(tenantId: string, record: AnyRecord) {
    await this.model('vehicles').updateOne(
      { _id: record.vehicleId, tenantId },
      {
        ...(record.odometerKm ? { $max: { odometerKm: Number(record.odometerKm) } } : {})
      }
    );
    await this.recalculateVehicleFinancialSummary(tenantId, String(record.vehicleId));
  }

  private async applyExpenseImpact(tenantId: string, vehicleId: string, amount: number) {
    await this.model('vehicles').updateOne(
      { _id: vehicleId, tenantId },
      {
        $inc: {
          'financialSummary.totalExpenses': amount
        }
      }
    );
    await this.recalculateVehicleFinancialSummary(tenantId, vehicleId);
  }

  private async recalculateCostPerKm(tenantId: string, vehicleId: string) {
    const vehicle = await this.model('vehicles').findOne({ _id: vehicleId, tenantId }).lean<AnyRecord>().exec();
    if (!vehicle) {
      return;
    }
    const financial = (vehicle.financialSummary ?? {}) as Record<string, number>;
    const totalCost = Number(financial.totalFuelCost ?? 0) + Number(financial.totalExpenses ?? 0);
    const odometerKm = Number(vehicle.odometerKm ?? 0);
    await this.model('vehicles').updateOne(
      { _id: vehicleId, tenantId },
      { 'financialSummary.costPerKm': odometerKm > 0 ? totalCost / odometerKm : 0 }
    );
  }

  private async recalculateVehicleFinancialSummary(tenantId: string, vehicleId: string) {
    const [fuelSummary, expenseSummary, fineSummary, incidentSummary, maxFuelOdometer] = await Promise.all([
      this.model('fuel-records').aggregate([
        { $match: { tenantId, vehicleId } },
        { $group: { _id: null, totalFuelCost: { $sum: '$totalCost' }, totalFuelLiters: { $sum: '$liters' } } }
      ]),
      this.model('expenses').aggregate([{ $match: { tenantId, vehicleId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      this.model('fines').aggregate([{ $match: { tenantId, vehicleId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      this.model('incidents').aggregate([{ $match: { tenantId, vehicleId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      this.model('fuel-records').find({ tenantId, vehicleId, odometerKm: { $gt: 0 } }).sort({ odometerKm: -1 }).limit(1).lean<AnyRecord[]>().exec()
    ]);

    const totalFuelCost = Number(fuelSummary[0]?.totalFuelCost ?? 0);
    const totalFuelLiters = Number(fuelSummary[0]?.totalFuelLiters ?? 0);
    const totalExpenses =
      Number(expenseSummary[0]?.total ?? 0) + Number(fineSummary[0]?.total ?? 0) + Number(incidentSummary[0]?.total ?? 0);
    const vehicle = await this.model('vehicles').findOne({ _id: vehicleId, tenantId }).lean<AnyRecord>().exec();
    const odometerKm = Math.max(Number(vehicle?.odometerKm ?? 0), Number(maxFuelOdometer[0]?.odometerKm ?? 0));

    await this.model('vehicles').updateOne(
      { _id: vehicleId, tenantId },
      {
        $set: {
          odometerKm,
          financialSummary: {
            totalFuelCost,
            totalFuelLiters,
            totalExpenses,
            costPerKm: odometerKm > 0 ? (totalFuelCost + totalExpenses) / odometerKm : 0
          }
        }
      }
    );
  }

  private async applyMaintenanceImpact(tenantId: string, order: AnyRecord) {
    const status = String(order.status ?? 'open');
    if (status === 'in_progress') {
      await this.model('vehicles').updateOne({ _id: order.vehicleId, tenantId }, { status: 'maintenance' });
    }
    if (status === 'closed') {
      await this.model('vehicles').updateOne({ _id: order.vehicleId, tenantId }, { status: 'available' });
      const existing = await this.model('maintenance-history').findOne({ tenantId, orderId: order._id }).lean().exec();
      if (!existing) {
        await this.model('maintenance-history').create({
          tenantId,
          vehicleId: order.vehicleId,
          orderId: order._id,
          description: `Ordem ${order.type ?? 'manutencao'} encerrada`,
          cost: Number(order.totalCost ?? 0),
          performedAt: order.closedAt ?? new Date()
        });
      }
    }
    if (order.scheduledAt && new Date(String(order.scheduledAt)) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      await this.createAlert(tenantId, {
        vehicleId: order.vehicleId,
        type: 'maintenance_due',
        severity: status === 'open' ? 'warning' : 'info',
        payload: { orderId: order._id, scheduledAt: order.scheduledAt }
      });
    }
  }

  private async applyTelemetryImpact(tenantId: string, event: AnyRecord) {
    const vehicle = await this.model('vehicles').findOne({ _id: event.vehicleId, tenantId }).lean<AnyRecord>().exec();
    if (!vehicle) {
      return;
    }

    await this.model('gps-positions').create({
      tenantId,
      vehicleId: event.vehicleId,
      driverId: event.driverId,
      occurredAt: event.occurredAt ?? new Date(),
      location: event.location,
      speedKph: event.speedKph,
      heading: event.payload && typeof event.payload === 'object' ? (event.payload as AnyRecord).heading : undefined,
      source: 'telemetry'
    });

    const vehicleStatus = ['maintenance', 'inactive', 'blocked'].includes(String(vehicle.status))
      ? vehicle.status
      : Number(event.speedKph ?? 0) > 3
        ? 'in_route'
        : 'stopped';

    await this.model('vehicles').updateOne(
      { _id: event.vehicleId, tenantId },
      {
        $set: {
          lastPosition: event.location,
          status: vehicleStatus,
          telemetrySummary: {
            speedKph: event.speedKph,
            fuelLevel: event.fuelLevel,
            batteryVoltage: event.batteryVoltage,
            ignition: event.ignition,
            lastTelemetryAt: event.occurredAt ?? new Date()
          }
        },
        ...(event.odometerKm ? { $max: { odometerKm: Number(event.odometerKm) } } : {})
      }
    );

    const speedLimit = await this.getNumberSetting(tenantId, 'alerts.speed_limit_kph', 90);
    if (Number(event.speedKph ?? 0) > speedLimit) {
      await this.createAlert(tenantId, {
        vehicleId: event.vehicleId,
        driverId: event.driverId,
        type: 'speeding',
        severity: 'critical',
        payload: { speedKph: event.speedKph, limitKph: speedLimit, position: event.location }
      });
    }

    if (event.batteryVoltage && Number(event.batteryVoltage) < 11.8) {
      await this.createAlert(tenantId, {
        vehicleId: event.vehicleId,
        driverId: event.driverId,
        type: 'low_battery',
        severity: 'warning',
        payload: { batteryVoltage: event.batteryVoltage }
      });
    }

    await this.evaluateGeofences(tenantId, event);
  }

  private async evaluateGeofences(tenantId: string, event: AnyRecord) {
    const location = event.location as { coordinates?: [number, number] };
    if (!location?.coordinates) {
      return;
    }

    const previous = await this.model('gps-positions')
      .findOne({ tenantId, vehicleId: event.vehicleId, occurredAt: { $lt: event.occurredAt ?? new Date() } })
      .sort({ occurredAt: -1 })
      .lean<AnyRecord>()
      .exec();
    const geofences = await this.model('geofences')
      .find({ tenantId, status: 'active', type: 'circle', center: { $exists: true }, radiusMeters: { $gt: 0 } })
      .lean<AnyRecord[]>()
      .exec();

    await Promise.all(
      geofences.map(async (geofence) => {
        const center = geofence.center as { coordinates?: [number, number] };
        if (!center?.coordinates) {
          return;
        }
        const nowCoordinates = location.coordinates;
        const previousCoordinates = (previous?.location as { coordinates?: [number, number] } | undefined)?.coordinates;
        if (!nowCoordinates) {
          return;
        }
        const nowInside = this.distanceMeters(nowCoordinates, center.coordinates) <= Number(geofence.radiusMeters ?? 0);
        const wasInside = previousCoordinates
          ? this.distanceMeters(previousCoordinates, center.coordinates) <= Number(geofence.radiusMeters ?? 0)
          : nowInside;
        if (nowInside !== wasInside) {
          await this.createAlert(tenantId, {
            vehicleId: event.vehicleId,
            driverId: event.driverId,
            type: nowInside ? 'geofence_entry' : 'geofence_exit',
            severity: 'warning',
            payload: { geofenceId: geofence._id, geofenceName: geofence.name, position: event.location }
          });
        }
      })
    );
  }

  private async createDocumentAlertIfNeeded(tenantId: string, document: AnyRecord) {
    if (!['expired', 'expiring'].includes(String(document.status))) {
      return;
    }

    await this.createAlert(tenantId, {
      type: document.status === 'expired' ? 'document_expired' : 'document_expiring',
      severity: document.status === 'expired' ? 'critical' : 'warning',
      payload: {
        documentId: document._id,
        entityType: document.entityType,
        entityId: document.entityId,
        documentType: document.type,
        expiresAt: document.expiresAt
      }
    });
  }

  private async createDriverLicenseAlertIfNeeded(tenantId: string, driver: AnyRecord) {
    if (!driver.licenseExpiresAt) {
      return;
    }
    const expiresAt = new Date(String(driver.licenseExpiresAt));
    const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (expiresAt <= next30) {
      await this.createAlert(tenantId, {
        driverId: driver._id,
        type: expiresAt < new Date() ? 'driver_license_expired' : 'driver_license_expiring',
        severity: expiresAt < new Date() ? 'critical' : 'warning',
        payload: { driverId: driver._id, expiresAt }
      });
    }
  }

  private async createAlert(tenantId: string, payload: AnyRecord) {
    return this.model('alerts').create({
      tenantId,
      status: 'open',
      triggeredAt: new Date(),
      ...payload
    });
  }

  private async getNumberSetting(tenantId: string, key: string, fallback: number) {
    const setting = await this.model('settings').findOne({ tenantId, key }).lean<AnyRecord>().exec();
    const value = setting?.value;
    return typeof value === 'number' ? value : fallback;
  }

  private distanceMeters(a: [number, number], b: [number, number]) {
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const earthRadiusMeters = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const h =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return earthRadiusMeters * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
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
    if (value && typeof value === 'object') {
      const objectIdLike = value as { _bsontype?: string; toString?: () => string };
      if (objectIdLike._bsontype === 'ObjectId' && objectIdLike.toString) {
        return objectIdLike.toString() as T;
      }

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, this.serialize(item)])
      ) as T;
    }
    return value;
  }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
  address?: string;
};

const geoPointSchema = new MongooseSchema(
  {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true },
  address: String
  },
  { _id: false }
);

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  code: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;
}

export type BranchDocument = HydratedDocument<Branch>;
export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ tenantId: 1, code: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'drivers' })
export class Driver {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  branchId?: string;

  @Prop({ required: true, trim: true, index: 'text' })
  name: string;

  @Prop({ trim: true })
  cpf?: string;

  @Prop()
  phone?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true })
  licenseNumber: string;

  @Prop({ required: true })
  licenseCategory: string;

  @Prop({ required: true, index: true })
  licenseExpiresAt: Date;

  @Prop({ enum: ['active', 'inactive', 'blocked', 'vacation'], default: 'active', index: true })
  status: string;

  @Prop({ index: true })
  assignedVehicleId?: string;

  @Prop({ default: 100 })
  score: number;

  @Prop({ enum: ['checked_out', 'checked_in'], default: 'checked_out' })
  checkInStatus: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, unknown>;
}

export type DriverDocument = HydratedDocument<Driver>;
export const DriverSchema = SchemaFactory.createForClass(Driver);
DriverSchema.index({ tenantId: 1, licenseNumber: 1 }, { unique: true });
DriverSchema.index({ tenantId: 1, status: 1, assignedVehicleId: 1 });

@Schema({ timestamps: true, collection: 'vehicles' })
export class Vehicle {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  branchId?: string;

  @Prop({ required: true, uppercase: true, trim: true })
  plate: string;

  @Prop({ trim: true })
  vin?: string;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true, index: 'text' })
  model: string;

  @Prop({ trim: true })
  nickname?: string;

  @Prop()
  year?: number;

  @Prop({ enum: ['car', 'van', 'truck', 'bus', 'motorcycle', 'equipment'], default: 'car', index: true })
  type: string;

  @Prop({
    enum: ['available', 'in_route', 'stopped', 'maintenance', 'inactive', 'blocked'],
    default: 'available',
    index: true
  })
  status: string;

  @Prop({ default: 0 })
  odometerKm: number;

  @Prop()
  initialOdometerKm?: number;

  @Prop()
  tankCapacityLiters?: number;

  @Prop()
  costCenter?: string;

  @Prop({ index: true })
  sector?: string;

  @Prop({ index: true })
  city?: string;

  @Prop({ index: true })
  primaryDriverId?: string;

  @Prop({ index: true })
  trackerId?: string;

  @Prop({ type: geoPointSchema })
  lastPosition?: GeoPoint;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  telemetrySummary: Record<string, unknown>;

  @Prop({
    type: {
      totalFuelCost: { type: Number, default: 0 },
      totalFuelLiters: { type: Number, default: 0 },
      totalExpenses: { type: Number, default: 0 },
      costPerKm: { type: Number, default: 0 }
    },
    default: {}
  })
  financialSummary: Record<string, number>;
}

export type VehicleDocument = HydratedDocument<Vehicle>;
export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ tenantId: 1, plate: 1 }, { unique: true });
VehicleSchema.index({ tenantId: 1, status: 1, branchId: 1 });
VehicleSchema.index({ lastPosition: '2dsphere' });

@Schema({ timestamps: true, collection: 'trackers' })
export class Tracker {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  vehicleId?: string;

  @Prop({ required: true })
  imei: string;

  @Prop({ required: true })
  provider: string;

  @Prop({ default: 'http' })
  protocol: string;

  @Prop({ enum: ['active', 'inactive', 'lost', 'maintenance'], default: 'active', index: true })
  status: string;

  @Prop({ index: true })
  lastSeenAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, unknown>;
}

export type TrackerDocument = HydratedDocument<Tracker>;
export const TrackerSchema = SchemaFactory.createForClass(Tracker);
TrackerSchema.index({ tenantId: 1, imei: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'telemetry_events' })
export class TelemetryEvent {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  trackerId?: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ type: geoPointSchema, required: true })
  location: GeoPoint;

  @Prop()
  speedKph?: number;

  @Prop()
  fuelLevel?: number;

  @Prop()
  odometerKm?: number;

  @Prop()
  engineRpm?: number;

  @Prop()
  batteryVoltage?: number;

  @Prop()
  coolantTemperature?: number;

  @Prop()
  ignition?: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, unknown>;
}

export type TelemetryEventDocument = HydratedDocument<TelemetryEvent>;
export const TelemetryEventSchema = SchemaFactory.createForClass(TelemetryEvent);
TelemetryEventSchema.index({ tenantId: 1, vehicleId: 1, occurredAt: -1 });
TelemetryEventSchema.index({ location: '2dsphere' });

@Schema({ timestamps: true, collection: 'gps_positions' })
export class GpsPosition {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ type: geoPointSchema, required: true })
  location: GeoPoint;

  @Prop()
  speedKph?: number;

  @Prop()
  heading?: number;

  @Prop()
  accuracy?: number;

  @Prop({ default: 'tracker' })
  source: string;
}

export type GpsPositionDocument = HydratedDocument<GpsPosition>;
export const GpsPositionSchema = SchemaFactory.createForClass(GpsPosition);
GpsPositionSchema.index({ tenantId: 1, vehicleId: 1, occurredAt: -1 });
GpsPositionSchema.index({ location: '2dsphere' });

@Schema({ timestamps: true, collection: 'geofences' })
export class Geofence {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  branchId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['circle', 'polygon'], default: 'circle', index: true })
  type: string;

  @Prop({ type: geoPointSchema })
  center?: GeoPoint;

  @Prop()
  radiusMeters?: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  polygon?: Record<string, unknown>;

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;
}

export type GeofenceDocument = HydratedDocument<Geofence>;
export const GeofenceSchema = SchemaFactory.createForClass(Geofence);
GeofenceSchema.index({ tenantId: 1, status: 1 });
GeofenceSchema.index({ center: '2dsphere' });

@Schema({ timestamps: true, collection: 'trips' })
export class Trip {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  startedAt: Date;

  @Prop({ index: true })
  endedAt?: Date;

  @Prop({ default: 0 })
  distanceKm: number;

  @Prop({ enum: ['planned', 'running', 'completed', 'cancelled'], default: 'planned', index: true })
  status: string;

  @Prop({ type: geoPointSchema })
  origin?: GeoPoint;

  @Prop({ type: geoPointSchema })
  destination?: GeoPoint;

  @Prop({ type: MongooseSchema.Types.Mixed })
  routeGeometry?: Record<string, unknown>;
}

export type TripDocument = HydratedDocument<Trip>;
export const TripSchema = SchemaFactory.createForClass(Trip);
TripSchema.index({ tenantId: 1, vehicleId: 1, startedAt: -1 });

@Schema({ timestamps: true, collection: 'maintenance_plans' })
export class MaintenancePlan {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['km', 'hours', 'date', 'mixed'], default: 'mixed' })
  recurrenceType: string;

  @Prop()
  everyKm?: number;

  @Prop()
  everyHours?: number;

  @Prop()
  everyDays?: number;

  @Prop({ index: true })
  dueAt?: Date;

  @Prop({ index: true })
  dueOdometerKm?: number;

  @Prop({ enum: ['active', 'paused', 'completed'], default: 'active', index: true })
  status: string;
}

export type MaintenancePlanDocument = HydratedDocument<MaintenancePlan>;
export const MaintenancePlanSchema = SchemaFactory.createForClass(MaintenancePlan);
MaintenancePlanSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });

@Schema({ timestamps: true, collection: 'maintenance_orders' })
export class MaintenanceOrder {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ enum: ['preventive', 'corrective', 'predictive'], default: 'preventive', index: true })
  type: string;

  @Prop({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true })
  priority: string;

  @Prop({ enum: ['open', 'scheduled', 'in_progress', 'closed', 'cancelled'], default: 'open', index: true })
  status: string;

  @Prop({ index: true })
  scheduledAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  closedAt?: Date;

  @Prop()
  odometerKm?: number;

  @Prop({ type: [{ name: String, quantity: Number, unitCost: Number, totalCost: Number }], default: [] })
  items: Array<Record<string, unknown>>;

  @Prop({ default: 0 })
  totalCost: number;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];
}

export type MaintenanceOrderDocument = HydratedDocument<MaintenanceOrder>;
export const MaintenanceOrderSchema = SchemaFactory.createForClass(MaintenanceOrder);
MaintenanceOrderSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });
MaintenanceOrderSchema.index({ tenantId: 1, scheduledAt: 1 });

@Schema({ timestamps: true, collection: 'maintenance_history' })
export class MaintenanceHistory {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 0 })
  cost: number;

  @Prop({ required: true, index: true })
  performedAt: Date;
}

export type MaintenanceHistoryDocument = HydratedDocument<MaintenanceHistory>;
export const MaintenanceHistorySchema = SchemaFactory.createForClass(MaintenanceHistory);
MaintenanceHistorySchema.index({ tenantId: 1, vehicleId: 1, performedAt: -1 });

@Schema({ timestamps: true, collection: 'fuel_records' })
export class FuelRecord {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true })
  liters: number;

  @Prop({ required: true })
  totalCost: number;

  @Prop()
  pricePerLiter?: number;

  @Prop()
  odometerKm?: number;

  @Prop()
  distanceKm?: number;

  @Prop()
  kmPerLiter?: number;

  @Prop({ required: true, index: true })
  filledAt: Date;

  @Prop()
  station?: string;

  @Prop({ enum: ['gasoline', 'ethanol', 'diesel', 'gnv', 'electric'], default: 'diesel' })
  fuelType: string;

  @Prop({ type: [{ originalName: String, fileName: String, mimeType: String, size: Number, uploadedAt: Date }], default: [] })
  attachments: Array<Record<string, unknown>>;
}

export type FuelRecordDocument = HydratedDocument<FuelRecord>;
export const FuelRecordSchema = SchemaFactory.createForClass(FuelRecord);
FuelRecordSchema.index({ tenantId: 1, vehicleId: 1, filledAt: -1 });

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  vehicleId?: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ index: true })
  subcategory?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop()
  costCenter?: string;

  @Prop()
  vendor?: string;

  @Prop()
  documentNumber?: string;
}

export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ tenantId: 1, category: 1, subcategory: 1, occurredAt: -1 });

@Schema({ timestamps: true, collection: 'fines' })
export class Fine {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ index: true })
  dueAt?: Date;

  @Prop({ enum: ['open', 'paid', 'appealed', 'cancelled'], default: 'open', index: true })
  status: string;

  @Prop()
  infractionCode?: string;
}

export type FineDocument = HydratedDocument<Fine>;
export const FineSchema = SchemaFactory.createForClass(Fine);
FineSchema.index({ tenantId: 1, vehicleId: 1, occurredAt: -1 });

@Schema({ timestamps: true, collection: 'incidents' })
export class Incident {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true })
  severity: string;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: ['open', 'investigating', 'closed'], default: 'open', index: true })
  status: string;

  @Prop({ default: 0 })
  amount: number;
}

export type IncidentDocument = HydratedDocument<Incident>;
export const IncidentSchema = SchemaFactory.createForClass(Incident);
IncidentSchema.index({ tenantId: 1, vehicleId: 1, occurredAt: -1 });

@Schema({ timestamps: true, collection: 'insurances' })
export class Insurance {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  vehicleId: string;

  @Prop({ required: true })
  provider: string;

  @Prop({ required: true })
  policyNumber: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  premiumAmount: number;

  @Prop({ enum: ['active', 'expired', 'cancelled'], default: 'active', index: true })
  status: string;
}

export type InsuranceDocument = HydratedDocument<Insurance>;
export const InsuranceSchema = SchemaFactory.createForClass(Insurance);
InsuranceSchema.index({ tenantId: 1, vehicleId: 1, expiresAt: 1 });

@Schema({ timestamps: true, collection: 'documents' })
export class DocumentRecord {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  entityType: string;

  @Prop({ required: true, index: true })
  entityId: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop()
  number?: string;

  @Prop()
  issuedAt?: Date;

  @Prop({ index: true })
  expiresAt?: Date;

  @Prop()
  fileUrl?: string;

  @Prop({ enum: ['valid', 'expiring', 'expired', 'pending_review'], default: 'valid', index: true })
  status: string;
}

export type DocumentRecordDocument = HydratedDocument<DocumentRecord>;
export const DocumentRecordSchema = SchemaFactory.createForClass(DocumentRecord);
DocumentRecordSchema.index({ tenantId: 1, entityType: 1, entityId: 1, type: 1 });
DocumentRecordSchema.index({ tenantId: 1, expiresAt: 1, status: 1 });

@Schema({ timestamps: true, collection: 'compliance_checks' })
export class ComplianceCheck {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  vehicleId?: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true })
  checklistVersion: string;

  @Prop()
  templateId?: string;

  @Prop({ type: [{ key: String, label: String, section: String, result: String, notes: String }], default: [] })
  items: Array<Record<string, unknown>>;

  @Prop({ type: [{ originalName: String, fileName: String, mimeType: String, size: Number, uploadedAt: Date }], default: [] })
  attachments: Array<Record<string, unknown>>;

  @Prop({ enum: ['passed', 'failed', 'pending'], default: 'pending', index: true })
  status: string;

  @Prop({ required: true, index: true })
  performedAt: Date;
}

export type ComplianceCheckDocument = HydratedDocument<ComplianceCheck>;
export const ComplianceCheckSchema = SchemaFactory.createForClass(ComplianceCheck);
ComplianceCheckSchema.index({ tenantId: 1, vehicleId: 1, performedAt: -1 });

@Schema({ timestamps: true, collection: 'notifications' })
export class NotificationRecord {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ enum: ['platform', 'email', 'webhook', 'push', 'whatsapp'], default: 'platform', index: true })
  channel: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: ['pending', 'sent', 'read', 'failed'], default: 'pending', index: true })
  status: string;

  @Prop()
  readAt?: Date;
}

export type NotificationRecordDocument = HydratedDocument<NotificationRecord>;
export const NotificationRecordSchema = SchemaFactory.createForClass(NotificationRecord);
NotificationRecordSchema.index({ tenantId: 1, userId: 1, status: 1 });

@Schema({ timestamps: true, collection: 'alerts' })
export class Alert {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  vehicleId?: string;

  @Prop({ index: true })
  driverId?: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ enum: ['info', 'warning', 'critical'], default: 'warning', index: true })
  severity: string;

  @Prop({ enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true })
  status: string;

  @Prop({ required: true, index: true })
  triggeredAt: Date;

  @Prop()
  acknowledgedAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, unknown>;
}

export type AlertDocument = HydratedDocument<Alert>;
export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index({ tenantId: 1, status: 1, triggeredAt: -1 });
AlertSchema.index({ tenantId: 1, vehicleId: 1, type: 1, triggeredAt: -1 });

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ index: true })
  tenantId?: string;

  @Prop({ index: true })
  actorUserId?: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true, index: true })
  resource: string;

  @Prop({ index: true })
  resourceId?: string;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  before?: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  after?: Record<string, unknown>;

  @Prop({ enum: ['success', 'failed'], default: 'success', index: true })
  status: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ tenantId: 1, actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, resource: 1, createdAt: -1 });

@Schema({ timestamps: true, collection: 'integrations' })
export class Integration {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ required: true, index: true })
  provider: string;

  @Prop({ enum: ['active', 'inactive', 'error'], default: 'inactive', index: true })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  config: Record<string, unknown>;

  @Prop()
  credentialsRef?: string;
}

export type IntegrationDocument = HydratedDocument<Integration>;
export const IntegrationSchema = SchemaFactory.createForClass(Integration);
IntegrationSchema.index({ tenantId: 1, type: 1, provider: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'webhooks' })
export class Webhook {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: [String], default: [] })
  events: string[];

  @Prop()
  secretHash?: string;

  @Prop({ enum: ['active', 'inactive', 'failed'], default: 'active', index: true })
  status: string;
}

export type WebhookDocument = HydratedDocument<Webhook>;
export const WebhookSchema = SchemaFactory.createForClass(Webhook);
WebhookSchema.index({ tenantId: 1, name: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'settings' })
export class Setting {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ enum: ['tenant', 'branch', 'user'], default: 'tenant', index: true })
  scope: string;

  @Prop({ index: true })
  scopeId?: string;

  @Prop({ required: true })
  key: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: unknown;
}

export type SettingDocument = HydratedDocument<Setting>;
export const SettingSchema = SchemaFactory.createForClass(Setting);
SettingSchema.index({ tenantId: 1, scope: 1, scopeId: 1, key: 1 }, { unique: true });

export const fleetSchemaDefinitions = [
  { name: Branch.name, schema: BranchSchema },
  { name: Driver.name, schema: DriverSchema },
  { name: Vehicle.name, schema: VehicleSchema },
  { name: Tracker.name, schema: TrackerSchema },
  { name: TelemetryEvent.name, schema: TelemetryEventSchema },
  { name: GpsPosition.name, schema: GpsPositionSchema },
  { name: Geofence.name, schema: GeofenceSchema },
  { name: Trip.name, schema: TripSchema },
  { name: MaintenancePlan.name, schema: MaintenancePlanSchema },
  { name: MaintenanceOrder.name, schema: MaintenanceOrderSchema },
  { name: MaintenanceHistory.name, schema: MaintenanceHistorySchema },
  { name: FuelRecord.name, schema: FuelRecordSchema },
  { name: Expense.name, schema: ExpenseSchema },
  { name: Fine.name, schema: FineSchema },
  { name: Incident.name, schema: IncidentSchema },
  { name: Insurance.name, schema: InsuranceSchema },
  { name: DocumentRecord.name, schema: DocumentRecordSchema },
  { name: ComplianceCheck.name, schema: ComplianceCheckSchema },
  { name: NotificationRecord.name, schema: NotificationRecordSchema },
  { name: Alert.name, schema: AlertSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: Integration.name, schema: IntegrationSchema },
  { name: Webhook.name, schema: WebhookSchema },
  { name: Setting.name, schema: SettingSchema }
];

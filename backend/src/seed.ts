import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcryptjs';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from './app.module';
import { ROLE_PERMISSIONS } from './users/permissions';
import { Role } from './users/schemas/role.schema';
import { User } from './users/schemas/user.schema';
import {
  Alert,
  Branch,
  DocumentRecord,
  Driver,
  FuelRecord,
  Geofence,
  GpsPosition,
  Integration,
  MaintenanceOrder,
  MaintenancePlan,
  Setting,
  TelemetryEvent,
  Tracker,
  Vehicle,
  Webhook
} from './fleet/schemas/fleet.schemas';

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const config = app.get(ConfigService);
  const connection = app.get<Connection>(getConnectionToken());
  const tenantId = config.get<string>('DEFAULT_TENANT_ID', 'sette-demo');

  const modelsToReset = [
    Role.name,
    User.name,
    Branch.name,
    Driver.name,
    Vehicle.name,
    Tracker.name,
    TelemetryEvent.name,
    GpsPosition.name,
    Geofence.name,
    MaintenancePlan.name,
    MaintenanceOrder.name,
    FuelRecord.name,
    DocumentRecord.name,
    Alert.name,
    Integration.name,
    Webhook.name,
    Setting.name
  ];

  await Promise.all(modelsToReset.map((modelName) => connection.model(modelName).deleteMany({ tenantId })));

  const branch = await connection.model(Branch.name).create({
    tenantId,
    name: 'Matriz Sao Paulo',
    code: 'SP-MTZ',
    city: 'Sao Paulo',
    state: 'SP',
    status: 'active'
  });

  await connection.model(Role.name).insertMany(
    Object.entries(ROLE_PERMISSIONS).map(([key, permissions]) => ({
      tenantId,
      key,
      name: roleName(key),
      description: `Perfil ${roleName(key)} com permissoes padrao.`,
      permissions,
      status: 'active'
    }))
  );

  const passwordHash = await hash('admin123', 12);
  await connection.model(User.name).create({
    tenantId,
    branchId: branch._id.toString(),
    name: 'Administrador Sette Log',
    email: 'admin@settelog.local',
    passwordHash,
    roles: ['super_admin'],
    permissions: ROLE_PERMISSIONS.super_admin,
    status: 'active'
  });

  const [driverA, driverB, driverC] = await connection.model(Driver.name).insertMany([
    {
      tenantId,
      branchId: branch._id.toString(),
      name: 'Rafael Andrade',
      cpf: '11122233344',
      phone: '+55 11 90000-1101',
      email: 'rafael.andrade@example.com',
      licenseNumber: 'SP12345678',
      licenseCategory: 'E',
      licenseExpiresAt: new Date('2027-08-10T00:00:00.000Z'),
      status: 'active',
      score: 92
    },
    {
      tenantId,
      branchId: branch._id.toString(),
      name: 'Carla Nogueira',
      cpf: '22233344455',
      phone: '+55 11 90000-2202',
      email: 'carla.nogueira@example.com',
      licenseNumber: 'SP87654321',
      licenseCategory: 'D',
      licenseExpiresAt: new Date('2026-05-20T00:00:00.000Z'),
      status: 'active',
      score: 87
    },
    {
      tenantId,
      branchId: branch._id.toString(),
      name: 'Diego Martins',
      cpf: '33344455566',
      phone: '+55 11 90000-3303',
      email: 'diego.martins@example.com',
      licenseNumber: 'SP11223344',
      licenseCategory: 'E',
      licenseExpiresAt: new Date('2028-02-15T00:00:00.000Z'),
      status: 'active',
      score: 78
    }
  ]);

  const [vehicleA, vehicleB, vehicleC] = await connection.model(Vehicle.name).insertMany([
    {
      tenantId,
      branchId: branch._id.toString(),
      plate: 'FRT1A23',
      brand: 'Mercedes-Benz',
      model: 'Actros 2651',
      year: 2023,
      type: 'truck',
      status: 'in_route',
      odometerKm: 84210,
      costCenter: 'Operação Sudeste',
      primaryDriverId: driverA._id.toString(),
      lastPosition: {
        type: 'Point',
        coordinates: [-46.6333, -23.5505],
        address: 'Sao Paulo, SP'
      },
      telemetrySummary: { speedKph: 62, fuelLevel: 54, batteryVoltage: 12.7, ignition: true },
      financialSummary: { totalFuelCost: 12450, totalFuelLiters: 2850, totalExpenses: 3100, costPerKm: 0.18 }
    },
    {
      tenantId,
      branchId: branch._id.toString(),
      plate: 'LOG7B88',
      brand: 'Volkswagen',
      model: 'Delivery 11.180',
      year: 2022,
      type: 'truck',
      status: 'maintenance',
      odometerKm: 61200,
      costCenter: 'Distribuicao Urbana',
      primaryDriverId: driverB._id.toString(),
      lastPosition: {
        type: 'Point',
        coordinates: [-46.5742, -23.5898],
        address: 'Mooca, Sao Paulo'
      },
      telemetrySummary: { speedKph: 0, fuelLevel: 33, batteryVoltage: 12.2, ignition: false },
      financialSummary: { totalFuelCost: 9900, totalFuelLiters: 2210, totalExpenses: 5200, costPerKm: 0.25 }
    },
    {
      tenantId,
      branchId: branch._id.toString(),
      plate: 'SET4C11',
      brand: 'Fiat',
      model: 'Ducato Cargo',
      year: 2024,
      type: 'van',
      status: 'available',
      odometerKm: 18300,
      costCenter: 'Last Mile',
      primaryDriverId: driverC._id.toString(),
      lastPosition: {
        type: 'Point',
        coordinates: [-46.7018, -23.5614],
        address: 'Pinheiros, Sao Paulo'
      },
      telemetrySummary: { speedKph: 0, fuelLevel: 76, batteryVoltage: 12.9, ignition: false },
      financialSummary: { totalFuelCost: 3480, totalFuelLiters: 812, totalExpenses: 900, costPerKm: 0.24 }
    }
  ]);

  await Promise.all([
    connection.model(Driver.name).updateOne({ _id: driverA._id }, { assignedVehicleId: vehicleA._id.toString() }),
    connection.model(Driver.name).updateOne({ _id: driverB._id }, { assignedVehicleId: vehicleB._id.toString() }),
    connection.model(Driver.name).updateOne({ _id: driverC._id }, { assignedVehicleId: vehicleC._id.toString() })
  ]);

  const trackers = await connection.model(Tracker.name).insertMany([
    {
      tenantId,
      vehicleId: vehicleA._id.toString(),
      imei: '860000000000101',
      provider: 'Sette Log IoT',
      protocol: 'http',
      status: 'active',
      lastSeenAt: new Date()
    },
    {
      tenantId,
      vehicleId: vehicleB._id.toString(),
      imei: '860000000000102',
      provider: 'Sette Log IoT',
      protocol: 'mqtt',
      status: 'active',
      lastSeenAt: new Date()
    },
    {
      tenantId,
      vehicleId: vehicleC._id.toString(),
      imei: '860000000000103',
      provider: 'Sette Log IoT',
      protocol: 'http',
      status: 'active',
      lastSeenAt: new Date()
    }
  ]);

  await Promise.all([
    connection.model(Vehicle.name).updateOne({ _id: vehicleA._id }, { trackerId: trackers[0]._id.toString() }),
    connection.model(Vehicle.name).updateOne({ _id: vehicleB._id }, { trackerId: trackers[1]._id.toString() }),
    connection.model(Vehicle.name).updateOne({ _id: vehicleC._id }, { trackerId: trackers[2]._id.toString() })
  ]);

  await connection.model(Geofence.name).create({
    tenantId,
    branchId: branch._id.toString(),
    name: 'CD Sao Paulo - Raio operacional',
    type: 'circle',
    center: { type: 'Point', coordinates: [-46.6333, -23.5505] },
    radiusMeters: 8500,
    status: 'active'
  });

  await connection.model(GpsPosition.name).insertMany([
    gps(tenantId, vehicleA._id, driverA._id, [-46.661, -23.553], 58, -45),
    gps(tenantId, vehicleA._id, driverA._id, [-46.648, -23.551], 63, -35),
    gps(tenantId, vehicleA._id, driverA._id, [-46.6333, -23.5505], 62, -20),
    gps(tenantId, vehicleB._id, driverB._id, [-46.5742, -23.5898], 0, -5),
    gps(tenantId, vehicleC._id, driverC._id, [-46.7018, -23.5614], 0, -10)
  ]);

  await connection.model(TelemetryEvent.name).insertMany([
    telemetry(tenantId, vehicleA._id, trackers[0]._id, driverA._id, [-46.6333, -23.5505], 62, 54),
    telemetry(tenantId, vehicleB._id, trackers[1]._id, driverB._id, [-46.5742, -23.5898], 0, 33),
    telemetry(tenantId, vehicleC._id, trackers[2]._id, driverC._id, [-46.7018, -23.5614], 0, 76)
  ]);

  await connection.model(MaintenancePlan.name).insertMany([
    {
      tenantId,
      vehicleId: vehicleA._id.toString(),
      name: 'Revisao preventiva 90 mil km',
      recurrenceType: 'km',
      everyKm: 10000,
      dueOdometerKm: 90000,
      dueAt: addDays(28),
      status: 'active'
    },
    {
      tenantId,
      vehicleId: vehicleB._id.toString(),
      name: 'Troca de freios',
      recurrenceType: 'date',
      everyDays: 180,
      dueAt: addDays(5),
      status: 'active'
    }
  ]);

  await connection.model(MaintenanceOrder.name).insertMany([
    {
      tenantId,
      vehicleId: vehicleB._id.toString(),
      driverId: driverB._id.toString(),
      type: 'corrective',
      priority: 'high',
      status: 'in_progress',
      scheduledAt: addDays(1),
      startedAt: addDays(-1),
      odometerKm: 61200,
      items: [{ name: 'Pastilhas de freio', quantity: 2, unitCost: 420, totalCost: 840 }],
      totalCost: 1450
    },
    {
      tenantId,
      vehicleId: vehicleA._id.toString(),
      driverId: driverA._id.toString(),
      type: 'preventive',
      priority: 'medium',
      status: 'scheduled',
      scheduledAt: addDays(14),
      odometerKm: 84210,
      items: [{ name: 'Oleo e filtros', quantity: 1, unitCost: 680, totalCost: 680 }],
      totalCost: 680
    }
  ]);

  await connection.model(FuelRecord.name).insertMany([
    fuel(tenantId, vehicleA._id, driverA._id, 420, 2415, 83800, -20),
    fuel(tenantId, vehicleB._id, driverB._id, 280, 1610, 60920, -12),
    fuel(tenantId, vehicleC._id, driverC._id, 94, 520, 18040, -4)
  ]);

  await connection.model(DocumentRecord.name).insertMany([
    document(tenantId, 'vehicle', vehicleA._id, 'crlv', addDays(120), 'CRLV-2026-FRT1A23'),
    document(tenantId, 'vehicle', vehicleB._id, 'seguro', addDays(20), 'SEG-2026-LOG7B88'),
    document(tenantId, 'driver', driverB._id, 'cnh', addDays(36), 'CNH-SP87654321'),
    document(tenantId, 'driver', driverA._id, 'cnh', addDays(360), 'CNH-SP12345678')
  ]);

  await connection.model(Alert.name).insertMany([
    {
      tenantId,
      vehicleId: vehicleB._id.toString(),
      type: 'maintenance_due',
      severity: 'warning',
      status: 'open',
      triggeredAt: new Date(),
      payload: { message: 'Ordem corretiva em andamento.' }
    },
    {
      tenantId,
      driverId: driverB._id.toString(),
      type: 'driver_license_expiring',
      severity: 'warning',
      status: 'open',
      triggeredAt: new Date(),
      payload: { expiresAt: driverB.licenseExpiresAt }
    }
  ]);

  await connection.model(Integration.name).create({
    tenantId,
    type: 'map',
    provider: 'openstreetmap',
    status: 'active',
    config: { tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
  });

  await connection.model(Webhook.name).create({
    tenantId,
    name: 'Eventos operacionais',
    url: 'https://example.com/webhooks/fleet',
    events: ['speeding', 'maintenance_due', 'document_expiring'],
    status: 'inactive'
  });

  await connection.model(Setting.name).insertMany([
    { tenantId, scope: 'tenant', key: 'alerts.speed_limit_kph', value: 90 },
    { tenantId, scope: 'tenant', key: 'alerts.document_expiration_days', value: 30 },
    { tenantId, scope: 'tenant', key: 'fleet.default_idle_minutes', value: 20 }
  ]);

  logger.log(`Seed concluido para tenant ${tenantId}. Login: admin@settelog.local / admin123`);
  await app.close();
}

function roleName(key: string) {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function gps(tenantId: string, vehicleId: unknown, driverId: unknown, coordinates: [number, number], speedKph: number, minutes: number) {
  return {
    tenantId,
    vehicleId: String(vehicleId),
    driverId: String(driverId),
    occurredAt: new Date(Date.now() + minutes * 60 * 1000),
    location: { type: 'Point', coordinates },
    speedKph,
    source: 'seed'
  };
}

function telemetry(
  tenantId: string,
  vehicleId: unknown,
  trackerId: unknown,
  driverId: unknown,
  coordinates: [number, number],
  speedKph: number,
  fuelLevel: number
) {
  return {
    tenantId,
    vehicleId: String(vehicleId),
    trackerId: String(trackerId),
    driverId: String(driverId),
    occurredAt: new Date(),
    type: 'gps',
    location: { type: 'Point', coordinates },
    speedKph,
    fuelLevel,
    odometerKm: 0,
    batteryVoltage: 12.7,
    ignition: speedKph > 0,
    payload: { source: 'seed' }
  };
}

function fuel(tenantId: string, vehicleId: unknown, driverId: unknown, liters: number, totalCost: number, odometerKm: number, days: number) {
  return {
    tenantId,
    vehicleId: String(vehicleId),
    driverId: String(driverId),
    liters,
    totalCost,
    pricePerLiter: totalCost / liters,
    odometerKm,
    filledAt: addDays(days),
    station: 'Posto Rota Segura',
    fuelType: 'diesel'
  };
}

function document(tenantId: string, entityType: string, entityId: unknown, type: string, expiresAt: Date, number: string) {
  const next30 = addDays(30);
  return {
    tenantId,
    entityType,
    entityId: String(entityId),
    type,
    number,
    issuedAt: addDays(-300),
    expiresAt,
    status: expiresAt < new Date() ? 'expired' : expiresAt <= next30 ? 'expiring' : 'valid'
  };
}

seed().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

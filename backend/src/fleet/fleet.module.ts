import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AlertsController,
  ComplianceController,
  DashboardController,
  DriversController,
  FinanceController,
  ImportsController,
  MaintenanceController,
  SettingsController,
  TelemetryController,
  TrackingController,
  VehiclesController
} from './fleet.controllers';
import { FleetService } from './fleet.service';
import { ImportsService } from './imports.service';
import { fleetSchemaDefinitions } from './schemas/fleet.schemas';

@Module({
  imports: [MongooseModule.forFeature(fleetSchemaDefinitions)],
  controllers: [
    DashboardController,
    VehiclesController,
    DriversController,
    TrackingController,
    TelemetryController,
    MaintenanceController,
    FinanceController,
    ComplianceController,
    AlertsController,
    SettingsController,
    ImportsController
  ],
  providers: [FleetService, ImportsService],
  exports: [FleetService, MongooseModule]
})
export class FleetModule {}

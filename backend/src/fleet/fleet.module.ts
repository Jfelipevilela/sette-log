import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AlertsController,
  ComplianceController,
  DashboardController,
  DriversController,
  FinanceController,
  ImportsController,
  MaintenanceController,
  NotificationsController,
  SettingsController,
  TelemetryController,
  TrackingController,
  VehiclesController,
} from "./fleet.controllers";
import { FleetService } from "./fleet.service";
import { ImportsService } from "./imports.service";
import { TemplateGeneratorService } from "./template-generator.service";
import { fleetSchemaDefinitions } from "./schemas/fleet.schemas";

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
    NotificationsController,
    ImportsController,
  ],
  providers: [FleetService, ImportsService, TemplateGeneratorService],
  exports: [FleetService, MongooseModule],
})
export class FleetModule {}

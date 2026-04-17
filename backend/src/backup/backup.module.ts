import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BackupService } from "./backup.service";

@Module({
  imports: [ConfigModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}

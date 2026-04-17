import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { createGzip } from "zlib";
import { createWriteStream } from "fs";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { join, resolve } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { Connection } from "mongoose";

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>("BACKUP_ENABLED", "true") === "false") {
      this.logger.log("Backup diario desativado por BACKUP_ENABLED=false.");
      return;
    }
    this.scheduleNextBackup();
  }

  async runBackup() {
    const backupDir = resolve(
      process.cwd(),
      this.config.get<string>("BACKUP_DIR", "../backups/mongodb"),
    );
    await mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(backupDir, `sette-log-${timestamp}.json.gz`);
    const collections = await this.connection.db!.collections();
    const payload: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      database: this.connection.name,
      collections: {},
    };

    for (const collection of collections) {
      const docs = await collection.find({}).toArray();
      (payload.collections as Record<string, unknown[]>)[collection.collectionName] =
        docs;
    }

    await pipeline(
      Readable.from([JSON.stringify(payload)]),
      createGzip(),
      createWriteStream(filePath),
    );
    await this.pruneOldBackups(backupDir);
    this.logger.log(`Backup gerado: ${filePath}`);
    return filePath;
  }

  private scheduleNextBackup() {
    const hour = Number(this.config.get<string>("BACKUP_HOUR", "2"));
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next.getTime() - now.getTime();
    this.timer = setTimeout(async () => {
      try {
        await this.runBackup();
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error.message : "Falha ao gerar backup.",
        );
      } finally {
        this.scheduleNextBackup();
      }
    }, delay);
    this.logger.log(`Proximo backup diario agendado para ${next.toISOString()}`);
  }

  private async pruneOldBackups(backupDir: string) {
    const retentionDays = Number(
      this.config.get<string>("BACKUP_RETENTION_DAYS", "30"),
    );
    const maxAge = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = await readdir(backupDir);
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json.gz"))
        .map(async (file) => {
          const filePath = join(backupDir, file);
          const info = await stat(filePath);
          if (info.mtime.getTime() < maxAge) {
            await unlink(filePath);
          }
        }),
    );
  }
}

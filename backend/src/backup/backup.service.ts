import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import { Connection } from "mongoose";
import { join, resolve } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { spawn } from "child_process";

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
      this.logger.log("Backup diário desativado por BACKUP_ENABLED=false.");
      return;
    }
    this.scheduleNextBackup();
  }

  async runBackup() {
    const backupDir = this.getBackupDir();
    await mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivePath = join(backupDir, `sette-log-${timestamp}.archive.gz`);

    try {
      await this.runMongoDump(archivePath, backupDir);
      await this.pruneOldBackups(backupDir);
      this.logger.log(`Backup gerado com mongodump: ${archivePath}`);
      return archivePath;
    } catch (error) {
      this.logger.warn(
        `mongodump indisponível ou falhou. Fallback para JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const jsonPath = join(backupDir, `sette-log-${timestamp}.json.gz`);
    const collections = await this.connection.db!.collections();
    const payload: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      database: this.connection.name,
      collections: {},
      format: "json-fallback",
    };

    for (const collection of collections) {
      const docs = await collection.find({}).toArray();
      (payload.collections as Record<string, unknown[]>)[
        collection.collectionName
      ] = docs;
    }

    await pipeline(
      Readable.from([JSON.stringify(payload)]),
      createGzip(),
      createWriteStream(jsonPath),
    );
    await this.pruneOldBackups(backupDir);
    this.logger.log(`Backup JSON gerado: ${jsonPath}`);
    return jsonPath;
  }

  async listBackups() {
    const backupDir = this.getBackupDir();
    await mkdir(backupDir, { recursive: true });
    const files = await readdir(backupDir);

    const backups = await Promise.all(
      files
        .filter(
          (file) => file.endsWith(".json.gz") || file.endsWith(".archive.gz"),
        )
        .map(async (file) => {
          const filePath = join(backupDir, file);
          const info = await stat(filePath);
          return {
            fileName: file,
            size: info.size,
            format: file.endsWith(".archive.gz") ? "mongodump" : "json",
            createdAt: info.birthtime.toISOString(),
            updatedAt: info.mtime.toISOString(),
          };
        }),
    );

    return backups.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async backupStream(fileName: string) {
    if (
      !/^[a-zA-Z0-9._-]+$/.test(fileName) ||
      !(
        fileName.endsWith(".json.gz") || fileName.endsWith(".archive.gz")
      )
    ) {
      throw new NotFoundException("Backup não encontrado.");
    }

    const backupDir = this.getBackupDir();
    const filePath = join(backupDir, fileName);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException("Backup não encontrado.");
    }

    return {
      stream: createReadStream(filePath),
      fileName,
    };
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

    this.logger.log(`Próximo backup diário agendado para ${next.toISOString()}`);
  }

  private async pruneOldBackups(backupDir: string) {
    const retentionDays = Number(
      this.config.get<string>("BACKUP_RETENTION_DAYS", "30"),
    );
    const maxAge = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = await readdir(backupDir);

    await Promise.all(
      files
        .filter(
          (file) => file.endsWith(".json.gz") || file.endsWith(".archive.gz"),
        )
        .map(async (file) => {
          const filePath = join(backupDir, file);
          const info = await stat(filePath);
          if (info.mtime.getTime() < maxAge) {
            await unlink(filePath);
          }
        }),
    );
  }

  private async runMongoDump(archivePath: string, backupDir: string) {
    const uri = this.config.get<string>("MONGODB_URI");
    if (!uri) {
      throw new Error("MONGODB_URI ausente.");
    }

    const command = this.config.get<string>("MONGODUMP_PATH", "mongodump");
    const readPreference = this.config.get<string>(
      "MONGODUMP_READ_PREFERENCE",
      "secondaryPreferred",
    );
    const configFile = join(backupDir, `.mongodump-${Date.now()}.yml`);

    await writeFile(configFile, `uri: "${uri.replace(/"/g, '\\"')}"\n`, "utf8");

    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const child = spawn(
          command,
          [
            `--config=${configFile}`,
            `--archive=${archivePath}`,
            "--gzip",
            `--readPreference=${readPreference}`,
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          },
        );

        let stderr = "";

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("error", (error) => rejectPromise(error));
        child.on("close", (code) => {
          if (code === 0) {
            resolvePromise();
            return;
          }
          rejectPromise(
            new Error(stderr.trim() || `mongodump saiu com código ${code}`),
          );
        });
      });
    } finally {
      await unlink(configFile).catch(() => undefined);
    }
  }

  private getBackupDir() {
    return resolve(
      process.cwd(),
      this.config.get<string>("BACKUP_DIR", "../backups/mongodb"),
    );
  }
}

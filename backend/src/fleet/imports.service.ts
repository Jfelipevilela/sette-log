import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { Connection } from "mongoose";
import { FleetResource, FleetService } from "./fleet.service";
import {
  Driver,
  FuelRecord,
  MaintenanceOrder,
  Vehicle,
} from "./schemas/fleet.schemas";

type ImportResource =
  | "vehicles"
  | "drivers"
  | "fuel-records"
  | "maintenance-orders"
  | "expenses"
  | "documents";

type UploadedSpreadsheetFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type LegacyRow = Record<string, unknown>;

type ImportResult = {
  resource: ImportResource;
  fileName: string;
  totalRows: number;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  sampleColumns: string[];
};

type ImportOptions = {
  recalculateFuelTotal?: boolean;
};

const supportedResources: ImportResource[] = [
  "vehicles",
  "drivers",
  "fuel-records",
  "maintenance-orders",
  "expenses",
  "documents",
];

const resourceSheetAliases: Record<ImportResource, string[]> = {
  vehicles: ["vehicles", "veiculos"],
  drivers: ["drivers", "motoristas"],
  "fuel-records": [
    "fuel-records",
    "fuel_records",
    "abastecimentos",
    "combustível",
  ],
  "maintenance-orders": [
    "maintenance-orders",
    "maintenance_orders",
    "manutenções",
    "ordens_manutenção",
  ],
  expenses: ["expenses", "despesas", "lancamentos_financeiros", "financeiro"],
  documents: ["documents", "documentos"],
};

const columnAliases: Record<string, string[]> = {
  plate: ["placa", "plate", "veiculo_placa", "placa_veiculo"],
  brand: ["marca", "brand", "fabricante"],
  model: ["modelo", "model", "versao"],
  nickname: ["apelido", "nickname", "nome_veiculo", "nome_do_veiculo"],
  year: ["ano", "year", "ano_modelo", "ano_fabricação"],
  type: ["tipo", "type", "tipo_veiculo", "categoria_veiculo"],
  status: ["status", "situação"],
  odometerKm: [
    "odometro",
    "hodometro",
    "km",
    "quilometragem",
    "odometer",
    "odometerkm",
  ],
  initialOdometerKm: [
    "odometro_base",
    "odometro_base_consumo",
    "km_base",
    "km_inicial_consumo",
    "initial_odometer",
    "initialodometerkm",
  ],
  tankCapacityLiters: [
    "tanque",
    "capacidade_tanque",
    "capacidade_do_tanque",
    "tank_capacity",
    "tankcapacityliters",
  ],
  costCenter: [
    "centro_custo",
    "centro_de_custo",
    "cost_center",
    "costcenter",
    "operação",
  ],
  sector: ["setor", "sector", "departamento", "area"],
  city: ["cidade", "city", "municipio"],

  name: ["nome", "nome_motorista", "name", "motorista", "driver"],
  cpf: ["cpf", "documento_motorista"],
  phone: ["telefone", "celular", "phone"],
  email: ["email", "e_mail"],
  licenseNumber: [
    "cnh",
    "cnh_motorista",
    "numero_cnh",
    "numero_da_cnh",
    "registro_cnh",
    "registro",
    "numero_registro",
    "prontuario",
    "licenca",
    "license",
    "licensenumber",
    "driver_license",
    "driverlicense",
  ],
  licenseCategory: [
    "categoria_cnh",
    "categoria",
    "license_category",
    "licensecategory",
  ],
  licenseExpiresAt: [
    "validade",
    "validade_cnh",
    "vencimento_cnh",
    "license_expires_at",
    "licenseexpiresat",
  ],

  vehiclePlate: ["placa", "vehicle_plate", "vehicleplate", "placa_veiculo"],
  driverLicense: [
    "cnh",
    "cnh_motorista",
    "numero_cnh",
    "numero_da_cnh",
    "registro_cnh",
    "driver_license",
    "driverlicense",
  ],
  liters: ["litros", "liters", "volume", "quantidade_litros"],
  totalCost: [
    "valor_total",
    "total",
    "custo_total",
    "valor",
    "total_cost",
    "totalcost",
  ],
  pricePerLiter: [
    "preco_litro",
    "valor_litro",
    "price_per_liter",
    "priceperliter",
  ],
  filledAt: [
    "data_abastecimento",
    "abastecido_em",
    "filled_at",
    "filledat",
    "data",
  ],
  station: ["posto", "station", "fornecedor"],
  fuelType: ["combustível", "tipo_combustível", "fuel_type", "fueltype"],

  priority: ["prioridade", "priority"],
  scheduledAt: [
    "agendamento",
    "data_agendamento",
    "scheduled_at",
    "scheduledat",
    "data",
  ],

  entityType: ["tipo_entidade", "entidade", "entity_type", "entitytype"],
  entityReference: [
    "referencia",
    "placa",
    "cnh",
    "entity_reference",
    "entityreference",
  ],
  documentType: [
    "documento",
    "tipo_documento",
    "document_type",
    "documenttype",
  ],
  number: ["numero", "number", "numero_documento"],
  issuedAt: ["emissao", "data_emissao", "issued_at", "issuedat"],
  expiresAt: ["vencimento", "validade", "expires_at", "expiresat"],
  fileUrl: ["arquivo", "url", "file_url", "fileurl"],
  description: ["descricao", "description", "observacao", "observacoes"],
  category: ["categoria", "category", "tipo_despesa", "natureza"],
  subcategory: ["subcategoria", "subcategory", "detalhe"],
  amount: ["valor", "amount", "valor_total", "custo", "despesa"],
  occurredAt: ["data", "data_despesa", "ocorrida_em", "occurred_at", "occurredat"],
  vendor: ["fornecedor", "vendor", "orgao"],
  documentNumber: ["numero_documento", "document_number", "documentnumber", "numero"],
};

@Injectable()
export class ImportsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly fleetService: FleetService,
  ) {}

  async importSpreadsheet(
    tenantId: string,
    resource: string,
    file?: UploadedSpreadsheetFile,
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo "file".');
    }

    const importResource = resource as ImportResource;
    if (!supportedResources.includes(importResource)) {
      throw new BadRequestException(
        `Tipo de importação invalido. Use: ${supportedResources.join(", ")}.`,
      );
    }

    const rows = await this.parseSpreadsheet(file, importResource);
    if (rows.length === 0) {
      throw new BadRequestException("A planilha não possui linhas de dados.");
    }
    if (rows.length > 5000) {
      throw new BadRequestException(
        "Importação limitada a 5000 linhas por arquivo.",
      );
    }

    const result: ImportResult = {
      resource: importResource,
      fileName: file.originalname,
      totalRows: rows.length,
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
      sampleColumns: Object.keys(rows[0] ?? {}),
    };
    const seenKeys = new Set<string>();

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 2;
      try {
        const payload = await this.mapRow(
          tenantId,
          importResource,
          rawRow,
          options,
        );
        this.assertUniqueImportKey(importResource, payload, seenKeys);
        const upserted = await this.persist(tenantId, importResource, payload);
        if (upserted === "updated") {
          result.updated += 1;
        } else {
          result.imported += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    return result;
  }

  async importCompleteLegacySpreadsheet(
    tenantId: string,
    file?: UploadedSpreadsheetFile,
    options: ImportOptions = {},
  ): Promise<{
    fileName: string;
    totalResources: number;
    results: ImportResult[];
    summary: {
      totalImported: number;
      totalUpdated: number;
      totalFailed: number;
    };
  }> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo "file".');
    }

    // Ordem de importação respeitando dependências
    const importOrder: ImportResource[] = [
      "vehicles",
      "drivers",
      "fuel-records",
      "maintenance-orders",
      "expenses",
      "documents",
    ];

    const results: ImportResult[] = [];
    let totalImported = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const resource of importOrder) {
      try {
        const rows = await this.parseSpreadsheet(file, resource);
        if (rows.length === 0) {
          continue;
        }

        const result: ImportResult = {
          resource,
          fileName: file.originalname,
          totalRows: rows.length,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [],
          sampleColumns: Object.keys(rows[0] ?? {}),
        };
        const seenKeys = new Set<string>();

        for (const [index, rawRow] of rows.entries()) {
          const rowNumber = index + 2;
          try {
            const payload = await this.mapRow(
              tenantId,
              resource,
              rawRow,
              options,
            );
            this.assertUniqueImportKey(resource, payload, seenKeys);
            const upserted = await this.persist(tenantId, resource, payload);
            if (upserted === "updated") {
              result.updated += 1;
              totalUpdated += 1;
            } else {
              result.imported += 1;
              totalImported += 1;
            }
          } catch (error) {
            result.failed += 1;
            totalFailed += 1;
            result.errors.push({
              row: rowNumber,
              message:
                error instanceof Error ? error.message : "Erro desconhecido",
            });
          }
        }

        if (result.imported > 0 || result.updated > 0 || result.failed > 0) {
          results.push(result);
        }
      } catch (error) {
        // Se houver erro ao parsear uma aba, continua com as outras
        console.error(
          `Erro ao processar aba ${resource}:`,
          error instanceof Error ? error.message : "Erro desconhecido",
        );
      }
    }

    return {
      fileName: file.originalname,
      totalResources: results.length,
      results,
      summary: { totalImported, totalUpdated, totalFailed },
    };
  }

  private async parseSpreadsheet(
    file: UploadedSpreadsheetFile,
    resource: ImportResource,
  ): Promise<LegacyRow[]> {
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    if (extension === "csv") {
      const content = this.decodeCsv(file.buffer);
      const rows = parse(content, {
        columns: true,
        bom: true,
        delimiter: this.detectCsvDelimiter(content),
        skip_empty_lines: true,
        trim: true,
      }) as LegacyRow[];
      return rows.filter((row) => this.isImportableDataRow(resource, row));
    }

    if (extension === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const workbookBuffer = file.buffer as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0];
      await workbook.xlsx.load(workbookBuffer);
      const worksheet = this.selectWorksheet(workbook, resource);
      if (!worksheet) {
        return [];
      }

      const headerRowNumber = this.findHeaderRow(worksheet, resource);
      const headers = new Map<number, string>();
      worksheet.getRow(headerRowNumber).eachCell((cell, columnNumber) => {
        const value = this.cellToString(cell.value);
        if (value) {
          headers.set(columnNumber, value);
        }
      });

      const rows: LegacyRow[] = [];
      for (
        let rowNumber = headerRowNumber + 1;
        rowNumber <= worksheet.rowCount;
        rowNumber += 1
      ) {
        const row = worksheet.getRow(rowNumber);
        const record: LegacyRow = {};
        headers.forEach((header, columnNumber) => {
          record[header] = this.cellValue(row.getCell(columnNumber).value);
        });
        if (
          Object.values(record).some(
            (value) =>
              value !== undefined &&
              value !== null &&
              String(value).trim() !== "",
          ) &&
          this.isImportableDataRow(resource, record)
        ) {
          rows.push(record);
        }
      }
      return rows;
    }

    throw new BadRequestException("Formato não suportado. Envie CSV ou XLSX.");
  }

  private selectWorksheet(
    workbook: ExcelJS.Workbook,
    resource: ImportResource,
  ) {
    if (workbook.worksheets.length <= 1) {
      return workbook.worksheets[0];
    }

    const aliases = new Set(
      resourceSheetAliases[resource].map((alias) => this.normalizeKey(alias)),
    );
    const worksheet = workbook.worksheets.find((sheet) =>
      aliases.has(this.normalizeKey(sheet.name)),
    );
    if (!worksheet) {
      throw new BadRequestException(
        `Aba não encontrada para ${resource}. Use uma aba chamada: ${resourceSheetAliases[resource].join(", ")}.`,
      );
    }

    return worksheet;
  }

  private findHeaderRow(worksheet: ExcelJS.Worksheet, resource: ImportResource) {
    const expectedByResource: Record<ImportResource, string[]> = {
      vehicles: ["plate", "brand", "model"],
      drivers: ["name", "licenseNumber"],
      "fuel-records": ["vehiclePlate", "liters", "totalCost"],
      "maintenance-orders": ["vehiclePlate"],
      expenses: ["category", "description", "amount", "occurredAt"],
      documents: ["entityType", "entityReference", "documentType"],
    };
    const expected = expectedByResource[resource];
    const maxRows = Math.min(20, worksheet.rowCount);
    for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
      const values: LegacyRow = {};
      worksheet.getRow(rowNumber).eachCell((cell) => {
        const value = this.cellToString(cell.value);
        if (value) {
          values[value] = value;
        }
      });
      const normalized = this.normalizeRow(values);
      const matches = expected.filter((key) => normalized[key] !== undefined);
      if (matches.length >= Math.min(2, expected.length)) {
        return rowNumber;
      }
    }
    return 1;
  }

  private async mapRow(
    tenantId: string,
    resource: ImportResource,
    row: LegacyRow,
    options: ImportOptions = {},
  ) {
    const normalized = this.normalizeRow(row);

    if (resource === "vehicles") {
      const plate = this.requiredString(normalized, "plate", "placa");
      return {
        plate,
        brand: this.stringValue(normalized, "brand") ?? "Não informado",
        model: this.stringValue(normalized, "model") ?? "Não informado",
        nickname: this.stringValue(normalized, "nickname"),
        year: this.numberValue(normalized, "year") ?? new Date().getFullYear(),
        type: this.normalizeVehicleType(this.stringValue(normalized, "type")),
        status: this.normalizeVehicleStatus(
          this.stringValue(normalized, "status"),
        ),
        odometerKm: this.numberValue(normalized, "odometerKm") ?? 0,
        initialOdometerKm:
          this.numberValue(normalized, "initialOdometerKm") ??
          this.numberValue(normalized, "odometerKm") ??
          0,
        tankCapacityLiters: this.numberValue(normalized, "tankCapacityLiters"),
        costCenter: this.stringValue(normalized, "costCenter"),
        sector: this.stringValue(normalized, "sector"),
        city: this.stringValue(normalized, "city"),
      };
    }

    if (resource === "drivers") {
      return {
        name: this.requiredString(normalized, "name", "nome"),
        licenseNumber: this.normalizeLicenseNumber(
          this.requiredString(normalized, "licenseNumber", "CNH"),
        ),
        licenseCategory: this.stringValue(normalized, "licenseCategory") ?? "B",
        licenseExpiresAt:
          this.dateValue(normalized, "licenseExpiresAt") ??
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        cpf: this.stringValue(normalized, "cpf"),
        phone: this.stringValue(normalized, "phone"),
        email: this.stringValue(normalized, "email"),
        status: this.normalizeDriverStatus(
          this.stringValue(normalized, "status"),
        ),
      };
    }

    if (resource === "fuel-records") {
      const liters = this.requiredNumber(normalized, "liters", "litros");
      const pricePerLiter = this.numberValue(normalized, "pricePerLiter");
      const informedTotal = this.numberValue(normalized, "totalCost");
      const totalCost =
        options.recalculateFuelTotal && pricePerLiter
          ? Number((liters * pricePerLiter).toFixed(2))
          : this.requiredNumber(normalized, "totalCost", "valor total");

      const vehicleId = await this.vehicleIdByPlate(
        tenantId,
        this.requiredString(normalized, "vehiclePlate", "placa"),
      );
      const driverId = await this.driverIdByLicense(
        tenantId,
        this.stringValue(normalized, "driverLicense"),
      );
      return {
        vehicleId,
        driverId,
        liters,
        totalCost,
        pricePerLiter:
          pricePerLiter ??
          (informedTotal !== undefined ? informedTotal / liters : undefined),
        odometerKm: this.numberValue(normalized, "odometerKm"),
        filledAt: this.dateValue(normalized, "filledAt") ?? new Date(),
        station: this.stringValue(normalized, "station"),
        fuelType: this.normalizeFuelType(
          this.stringValue(normalized, "fuelType"),
        ),
      };
    }

    if (resource === "maintenance-orders") {
      const vehicleId = await this.vehicleIdByPlate(
        tenantId,
        this.requiredString(normalized, "vehiclePlate", "placa"),
      );
      return {
        vehicleId,
        type: this.normalizeMaintenanceType(
          this.stringValue(normalized, "type"),
        ),
        priority: this.normalizePriority(
          this.stringValue(normalized, "priority"),
        ),
        status: this.normalizeMaintenanceStatus(
          this.stringValue(normalized, "status"),
        ),
        scheduledAt: this.dateValue(normalized, "scheduledAt"),
        odometerKm: this.numberValue(normalized, "odometerKm"),
        totalCost: this.numberValue(normalized, "totalCost") ?? 0,
        description: this.stringValue(normalized, "description"),
      };
    }

    if (resource === "expenses") {
      const vehiclePlate = this.stringValue(normalized, "vehiclePlate");
      const driverLicense = this.stringValue(normalized, "driverLicense");
      return {
        vehicleId: vehiclePlate
          ? await this.vehicleIdByPlate(tenantId, vehiclePlate)
          : undefined,
        driverId: driverLicense
          ? await this.driverIdByLicense(tenantId, driverLicense)
          : undefined,
        category: this.normalizeExpenseCategory(
          this.requiredString(normalized, "category", "categoria"),
        ),
        subcategory: this.stringValue(normalized, "subcategory"),
        description: this.requiredString(normalized, "description", "descricao"),
        amount: this.requiredNumber(normalized, "amount", "valor"),
        occurredAt: this.dateValue(normalized, "occurredAt") ?? new Date(),
        costCenter: this.stringValue(normalized, "costCenter"),
        vendor: this.stringValue(normalized, "vendor"),
        documentNumber: this.stringValue(normalized, "documentNumber"),
      };
    }

    const entityType = this.normalizeEntityType(
      this.stringValue(normalized, "entityType") ??
        (this.stringValue(normalized, "driverLicense") ? "driver" : "vehicle"),
    );
    const entityReference = this.requiredString(
      normalized,
      "entityReference",
      "referencia",
    );
    return {
      entityType,
      entityId:
        entityType === "driver"
          ? await this.driverIdByLicense(tenantId, entityReference)
          : await this.vehicleIdByPlate(tenantId, entityReference),
      type: this.stringValue(normalized, "documentType") ?? "documento",
      number: this.stringValue(normalized, "number"),
      issuedAt: this.dateValue(normalized, "issuedAt"),
      expiresAt: this.dateValue(normalized, "expiresAt"),
      fileUrl: this.stringValue(normalized, "fileUrl"),
    };
  }

  private async persist(
    tenantId: string,
    resource: ImportResource,
    payload: Record<string, unknown>,
  ) {
    if (resource === "vehicles") {
      payload.plate = this.normalizePlate(String(payload.plate ?? ""));
      const existing = await this.connection
        .model(Vehicle.name)
        .findOne({ tenantId, plate: payload.plate })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "vehicles",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    if (resource === "drivers") {
      payload.licenseNumber = this.normalizeLicenseNumber(
        String(payload.licenseNumber ?? ""),
      );
      const existing = await this.connection
        .model(Driver.name)
        .findOne({ tenantId, licenseNumber: payload.licenseNumber })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "drivers",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    if (resource === "documents") {
      const existing = await this.connection
        .model("DocumentRecord")
        .findOne({
          tenantId,
          entityType: payload.entityType,
          entityId: payload.entityId,
          type: payload.type,
          ...(payload.number ? { number: payload.number } : {}),
        })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "documents",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    if (resource === "fuel-records") {
      const existing = await this.connection
        .model(FuelRecord.name)
        .findOne({
          tenantId,
          vehicleId: payload.vehicleId,
          filledAt: payload.filledAt,
          odometerKm: payload.odometerKm,
          liters: payload.liters,
          totalCost: payload.totalCost,
        })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "fuel-records",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    if (resource === "maintenance-orders") {
      const existing = await this.connection
        .model(MaintenanceOrder.name)
        .findOne({
          tenantId,
          vehicleId: payload.vehicleId,
          type: payload.type,
          scheduledAt: payload.scheduledAt,
          odometerKm: payload.odometerKm,
          totalCost: payload.totalCost,
        })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "maintenance-orders",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    if (resource === "expenses") {
      const existing = await this.connection
        .model("Expense")
        .findOne({
          tenantId,
          vehicleId: payload.vehicleId ?? null,
          driverId: payload.driverId ?? null,
          category: payload.category,
          description: payload.description,
          occurredAt: payload.occurredAt,
          amount: payload.amount,
        })
        .lean<{ _id: unknown }>()
        .exec();
      if (existing?._id) {
        await this.fleetService.update(
          "expenses",
          tenantId,
          String(existing._id),
          payload,
        );
        return "updated";
      }
    }

    await this.fleetService.create(
      resource as FleetResource,
      tenantId,
      payload,
    );
    return "imported";
  }

  private decodeCsv(buffer: Buffer) {
    const utf8 = buffer.toString("utf8");
    if (!utf8.includes("\uFFFD")) {
      return utf8;
    }
    return buffer.toString("latin1");
  }

  private detectCsvDelimiter(content: string) {
    const firstLine = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (!firstLine) {
      return ",";
    }

    const delimiters = [",", ";", "\t"];
    return (
      delimiters
        .map((delimiter) => ({
          delimiter,
          count: firstLine.split(delimiter).length - 1,
        }))
        .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
    );
  }

  private normalizeRow(row: LegacyRow) {
    const normalizedInput = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        this.normalizeKey(key),
        value,
      ]),
    );
    const output: LegacyRow = {};

    Object.entries(columnAliases).forEach(([target, aliases]) => {
      const match = aliases
        .map((alias) => this.normalizeKey(alias))
        .find((alias) => alias in normalizedInput);
      if (match) {
        output[target] = normalizedInput[match];
      }
    });

    return output;
  }

  private isImportableDataRow(resource: ImportResource, row: LegacyRow) {
    const normalized = this.normalizeRow(row);
    const requiredByResource: Record<ImportResource, string[]> = {
      vehicles: ["plate"],
      drivers: ["name", "licenseNumber"],
      "fuel-records": ["vehiclePlate", "liters"],
      "maintenance-orders": ["vehiclePlate"],
      expenses: ["category", "description", "amount", "occurredAt"],
      documents: ["entityReference", "documentType"],
    };
    const requiredValues = requiredByResource[resource]
      .map((key) => this.stringValue(normalized, key))
      .filter(Boolean) as string[];
    if (requiredValues.length < requiredByResource[resource].length) {
      return false;
    }

    const rowText = Object.values(row)
      .map((value) => this.normalizeKey(String(value ?? "")))
      .join(" ");
    const instructionTerms = [
      "campos_obrigatorios",
      "campo_obrigatorio",
      "marcados_com_asterisco",
      "dica",
      "atencao",
      "importe_veiculos",
      "importe_motoristas",
      "deve_ser_de_veiculo",
      "ja_cadastrado",
      "se_o_numero",
      "sera_atualizado",
      "combustível_gasolina",
      "status_active",
      "tipo_car",
      "categoria_cnh",
    ];
    return !instructionTerms.some((term) => rowText.includes(term));
  }

  private assertUniqueImportKey(
    resource: ImportResource,
    payload: Record<string, unknown>,
    seenKeys: Set<string>,
  ) {
    const key = this.importUniqueKey(resource, payload);
    if (!key) {
      return;
    }
    if (seenKeys.has(key)) {
      throw new Error(
        `Registro duplicado na planilha para ${this.resourceLabel(resource)} (${key.split(":")[1]}). Cada linha precisa ter uma chave única.`,
      );
    }
    seenKeys.add(key);
  }

  private importUniqueKey(
    resource: ImportResource,
    payload: Record<string, unknown>,
  ) {
    if (resource === "drivers") {
      return `drivers:${this.normalizeLicenseNumber(
        String(payload.licenseNumber ?? ""),
      )}`;
    }
    if (resource === "vehicles") {
      return `vehicles:${this.normalizePlate(String(payload.plate ?? ""))}`;
    }
    return undefined;
  }

  private resourceLabel(resource: ImportResource) {
    const labels: Record<ImportResource, string> = {
      vehicles: "veiculo",
      drivers: "motorista",
      "fuel-records": "abastecimento",
      "maintenance-orders": "manutenção",
      expenses: "despesa",
      documents: "documento",
    };
    return labels[resource];
  }

  private normalizeKey(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private requiredString(row: LegacyRow, key: string, label: string) {
    const value = this.stringValue(row, key);
    if (!value) {
      throw new Error(`Campo obrigatório ausente: ${label}.`);
    }
    return value;
  }

  private stringValue(row: LegacyRow, key: string) {
    const value = row[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      return undefined;
    }
    return String(value).trim();
  }

  private requiredNumber(row: LegacyRow, key: string, label: string) {
    const value = this.numberValue(row, key);
    if (value === undefined || Number.isNaN(value)) {
      throw new Error(
        `Campo numérico obrigatório ausente ou inválido: ${label}.`,
      );
    }
    return value;
  }

  private numberValue(row: LegacyRow, key: string) {
    const value = row[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      return undefined;
    }
    if (typeof value === "number") {
      return value;
    }
    const normalized = String(value)
      .replace(/[R$\s]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private dateValue(row: LegacyRow, key: string) {
    const value = row[key];
    if (!value) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "number") {
      return this.excelSerialToDate(value) ?? new Date(value);
    }
    const text = String(value).trim();
    if (/^\d{5}(\.\d+)?$/.test(text)) {
      const excelDate = this.excelSerialToDate(Number(text));
      if (excelDate) {
        return excelDate;
      }
    }
    const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (brMatch) {
      const day = brMatch[1]!;
      const month = brMatch[2]!;
      const year = brMatch[3]!;
      const normalizedYear = year.length === 2 ? `20${year}` : year;
      return new Date(Number(normalizedYear), Number(month) - 1, Number(day));
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private excelSerialToDate(value: number) {
    if (!Number.isFinite(value) || value < 1 || value > 60000) {
      return undefined;
    }
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
  }

  private async vehicleIdByPlate(tenantId: string, plate: string) {
    const vehicle = await this.connection
      .model(Vehicle.name)
      .findOne({ tenantId, plate: this.normalizePlate(plate) })
      .lean<{ _id: unknown }>()
      .exec();
    if (!vehicle?._id) {
      throw new Error(
        `Veículo não encontrado para placa ${plate}. Importe os veículos antes.`,
      );
    }
    return String(vehicle._id);
  }

  private async driverIdByLicense(tenantId: string, licenseNumber?: string) {
    if (!licenseNumber) {
      return undefined;
    }
    const normalizedLicenseNumber = this.normalizeLicenseNumber(licenseNumber);
    const driver = await this.connection
      .model(Driver.name)
      .findOne({ tenantId, licenseNumber: normalizedLicenseNumber })
      .lean<{ _id: unknown }>()
      .exec();
    return driver?._id ? String(driver._id) : undefined;
  }

  private cellToString(value: ExcelJS.CellValue) {
    const cellValue = this.cellValue(value);
    return cellValue === undefined || cellValue === null
      ? ""
      : String(cellValue).trim();
  }

  private cellValue(value: ExcelJS.CellValue): unknown {
    if (value && typeof value === "object") {
      if (value instanceof Date) {
        return value;
      }
      if ("text" in value) {
        return value.text;
      }
      if ("result" in value) {
        return value.result;
      }
      if ("richText" in value && Array.isArray(value.richText)) {
        return value.richText.map((item) => item.text).join("");
      }
    }
    return value;
  }

  private normalizeVehicleType(value?: string) {
    const normalized = this.normalizeKey(value ?? "car");
    if (
      ["van", "truck", "bus", "motorcycle", "equipment"].includes(normalized)
    ) {
      return normalized;
    }
    if (["caminhao", "truck"].includes(normalized)) {
      return "truck";
    }
    if (["onibus", "bus"].includes(normalized)) {
      return "bus";
    }
    if (["moto", "motocicleta", "motorcycle"].includes(normalized)) {
      return "motorcycle";
    }
    return "car";
  }

  private normalizeVehicleStatus(value?: string) {
    const normalized = this.normalizeKey(value ?? "available");
    if (
      ["available", "disponível", "ativo", "operacional"].includes(normalized)
    ) {
      return "available";
    }
    if (["in_route", "em_rota", "rota", "viagem"].includes(normalized)) {
      return "in_route";
    }
    if (["stopped", "parado", "ocioso"].includes(normalized)) {
      return "stopped";
    }
    if (["maintenance", "manutenção", "oficina"].includes(normalized)) {
      return "maintenance";
    }
    if (["inactive", "inativo"].includes(normalized)) {
      return "inactive";
    }
    if (["blocked", "bloqueado"].includes(normalized)) {
      return "blocked";
    }
    return "available";
  }

  private normalizeDriverStatus(value?: string) {
    const normalized = this.normalizeKey(value ?? "active");
    if (["inactive", "inativo"].includes(normalized)) {
      return "inactive";
    }
    if (["blocked", "bloqueado"].includes(normalized)) {
      return "blocked";
    }
    if (["vacation", "ferias"].includes(normalized)) {
      return "vacation";
    }
    return "active";
  }

  private normalizeFuelType(value?: string) {
    const normalized = this.normalizeKey(value ?? "diesel");
    if (
      ["gasoline", "ethanol", "diesel", "gnv", "electric"].includes(normalized)
    ) {
      return normalized;
    }
    if (["gasolina"].includes(normalized)) {
      return "gasoline";
    }
    if (["etanol", "alcool"].includes(normalized)) {
      return "ethanol";
    }
    if (["eletrico", "energia"].includes(normalized)) {
      return "electric";
    }
    return "diesel";
  }

  private normalizeMaintenanceType(value?: string) {
    const normalized = this.normalizeKey(value ?? "preventive");
    if (["corrective", "corretiva"].includes(normalized)) {
      return "corrective";
    }
    if (["predictive", "preditiva"].includes(normalized)) {
      return "predictive";
    }
    return "preventive";
  }

  private normalizePriority(value?: string) {
    const normalized = this.normalizeKey(value ?? "medium");
    if (["low", "baixa"].includes(normalized)) {
      return "low";
    }
    if (["high", "alta"].includes(normalized)) {
      return "high";
    }
    if (["critical", "critica", "critico"].includes(normalized)) {
      return "critical";
    }
    return "medium";
  }

  private normalizeMaintenanceStatus(value?: string) {
    const normalized = this.normalizeKey(value ?? "open");
    if (["scheduled", "agendada", "agendado"].includes(normalized)) {
      return "scheduled";
    }
    if (["in_progress", "em_andamento", "executando"].includes(normalized)) {
      return "in_progress";
    }
    if (
      [
        "closed",
        "completed",
        "fechada",
        "fechado",
        "concluida",
        "concluido",
      ].includes(
        normalized,
      )
    ) {
      return "closed";
    }
    if (["cancelled", "cancelada", "cancelado"].includes(normalized)) {
      return "cancelled";
    }
    return "open";
  }

  private normalizeExpenseCategory(value?: string) {
    const normalized = this.normalizeKey(value ?? "other");
    if (["maintenance", "manutencao"].includes(normalized)) {
      return "maintenance";
    }
    if (["documentation", "documentacao", "documento"].includes(normalized)) {
      return "documentation";
    }
    if (["toll", "pedagio"].includes(normalized)) {
      return "toll";
    }
    if (["tax", "imposto", "ipva", "licenciamento"].includes(normalized)) {
      return "tax";
    }
    if (["insurance", "seguro"].includes(normalized)) {
      return "insurance";
    }
    if (["fine", "multa"].includes(normalized)) {
      return "fine";
    }
    if (["incident", "sinistro"].includes(normalized)) {
      return "incident";
    }
    return "other";
  }

  private normalizeEntityType(value: string) {
    const normalized = this.normalizeKey(value);
    return ["driver", "motorista"].includes(normalized) ? "driver" : "vehicle";
  }

  private normalizePlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  private normalizeLicenseNumber(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
}

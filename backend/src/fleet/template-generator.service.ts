import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import ExcelJS from "exceljs";
import { Connection } from "mongoose";
import {
  DocumentRecord,
  Driver,
  Expense,
  FuelRecord,
  MaintenanceOrder,
  Vehicle,
} from "./schemas/fleet.schemas";

type TemplateColumn = {
  label: string;
  description: string;
  required: boolean;
  width?: number;
};

type TemplateSheet = {
  name: string;
  title: string;
  columns: TemplateColumn[];
  examples: unknown[][];
  rules: string[];
};

export const DATA_SHEETS: TemplateSheet[] = [
  {
    name: "veiculos",
    title: "Veículos",
    columns: [
      { label: "placa *", description: "Placa única do veículo.", required: true, width: 16 },
      { label: "marca *", description: "Fabricante do veículo.", required: true, width: 20 },
      { label: "modelo *", description: "Modelo do veículo.", required: true, width: 24 },
      { label: "apelido", description: "Nome interno opcional.", required: false, width: 22 },
      { label: "ano", description: "Ano do veículo.", required: false, width: 10 },
      { label: "tipo", description: "car, van, truck, bus, motorcycle, equipment.", required: false, width: 18 },
      { label: "status", description: "available, in_route, stopped, maintenance, inactive, blocked.", required: false, width: 18 },
      { label: "odometro", description: "Km atual acumulado.", required: false, width: 14 },
      { label: "odometro_base_consumo", description: "Km inicial para calculo de consumo.", required: false, width: 24 },
      { label: "capacidade_tanque", description: "Capacidade do tanque em litros.", required: false, width: 20 },
      { label: "centro_custo", description: "Centro de custo.", required: false, width: 20 },
      { label: "setor", description: "Setor responsavel.", required: false, width: 18 },
      { label: "cidade", description: "Cidade de operação.", required: false, width: 18 },
    ],
    examples: [
      ["ABC1D23", "Fiat", "Mobi", "Mobi Movida", 2026, "car", "available", 1200, 0, 47, "Operação", "Logistica", "Manaus"],
      ["LOG7B88", "Volkswagen", "Delivery", "Caminhao 01", 2022, "truck", "available", 61200, 58000, 120, "Distribuicao", "Entrega", "Sao Paulo"],
    ],
    rules: [
      "A placa e a chave única. Se já existir, o veículo será atualizado.",
      "Linhas sem placa não sao importadas.",
      "Veículo inativo ou bloqueado não deve ser usado como disponível na operação.",
    ],
  },
  {
    name: "motoristas",
    title: "Motoristas",
    columns: [
      { label: "nome *", description: "Nome completo.", required: true, width: 28 },
      { label: "cnh *", description: "CNH única do motorista.", required: true, width: 18 },
      { label: "categoria_cnh *", description: "A, B, C, D, E, AB, AC, AD, AE.", required: true, width: 18 },
      { label: "validade_cnh *", description: "Validade em DD/MM/AAAA.", required: true, width: 18 },
      { label: "cpf", description: "CPF opcional.", required: false, width: 18 },
      { label: "telefone", description: "Telefone opcional.", required: false, width: 20 },
      { label: "email", description: "Email opcional.", required: false, width: 28 },
      { label: "status", description: "active, inactive, blocked, vacation.", required: false, width: 14 },
    ],
    examples: [
      ["Joao Felipe Vilela", "CNH001", "B", "31/12/2027", "111.222.333-44", "11999990001", "joao@example.com", "active"],
      ["Maria Santos", "CNH002", "D", "31/12/2028", "222.333.444-55", "11999990002", "maria@example.com", "active"],
    ],
    rules: [
      "A CNH e a chave única. Se já existir, o motorista será atualizado.",
      "CNHs duplicadas dentro da mesma planilha sao bloqueadas.",
      "Linhas sem nome ou sem CNH não sao importadas.",
    ],
  },
  {
    name: "abastecimentos",
    title: "Abastecimentos",
    columns: [
      { label: "placa *", description: "Placa de veículo já cadastrado.", required: true, width: 16 },
      { label: "litros *", description: "Quantidade abastecida.", required: true, width: 12 },
      { label: "valor_total *", description: "Total pago.", required: true, width: 14 },
      { label: "cnh", description: "CNH do motorista, opcional.", required: false, width: 18 },
      { label: "preco_litro", description: "Valor por litro.", required: false, width: 14 },
      { label: "odometro", description: "Km no abastecimento.", required: false, width: 14 },
      { label: "data_abastecimento", description: "Data em DD/MM/AAAA.", required: false, width: 20 },
      { label: "posto", description: "Local do abastecimento.", required: false, width: 24 },
      { label: "combustível", description: "gasoline, ethanol, diesel, cng, electric.", required: false, width: 16 },
    ],
    examples: [
      ["ABC1D23", 70, 434, "CNH001", 6.2, 1300, "16/04/2026", "Posto Amazonas", "ethanol"],
      ["ABC1D23", 45, 279, "CNH001", 6.2, 1700, "25/04/2026", "Posto Amazonas", "ethanol"],
      ["LOG7B88", 280, 1610, "CNH002", 5.75, 62100, "16/04/2026", "Posto Rota BR", "diesel"],
    ],
    rules: [
      "A placa precisa existir na aba veículos ou no banco.",
      "Se informar CNH, ela precisa existir na aba motoristas ou no banco.",
      "Por padrao, litros x preco_litro precisa bater com valor_total. Na tela ha opcao para recalcular valor_total automaticamente.",
      "Para km/l por abastecimento, informe odômetro em abastecimentos consecutivos do mesmo veículo.",
    ],
  },
  {
    name: "manutenções",
    title: "Manutenções",
    columns: [
      { label: "placa *", description: "Placa de veículo já cadastrado.", required: true, width: 16 },
      { label: "tipo", description: "preventive, corrective, predictive.", required: false, width: 16 },
      { label: "prioridade", description: "low, medium, high, critical.", required: false, width: 14 },
      { label: "status", description: "open, scheduled, in_progress, closed, cancelled.", required: false, width: 18 },
      { label: "agendamento", description: "Data em DD/MM/AAAA.", required: false, width: 18 },
      { label: "odometro", description: "Km da manutenção.", required: false, width: 14 },
      { label: "valor_total", description: "Custo total.", required: false, width: 14 },
      { label: "descricao", description: "Descricao do serviço.", required: false, width: 42 },
    ],
    examples: [
      ["ABC1D23", "preventive", "medium", "scheduled", "30/04/2026", 1800, 780, "Troca de oleo e filtros"],
      ["LOG7B88", "corrective", "high", "closed", "05/03/2026", 61500, 1450, "Revisao de freios"],
    ],
    rules: [
      "A placa precisa existir na aba veículos ou no banco.",
      "Se valor_total ficar vazio, será gravado como zero.",
      "Manutenções entram nos custos acumulados da dashboard.",
    ],
  },
  {
    name: "despesas",
    title: "Despesas",
    columns: [
      { label: "placa", description: "Placa do veículo já cadastrado.", required: false, width: 16 },
      { label: "cnh", description: "CNH do motorista, opcional.", required: false, width: 18 },
      { label: "categoria *", description: "maintenance, documentation, toll, tax, insurance, fine, incident, other.", required: true, width: 20 },
      { label: "subcategoria", description: "Detalhe interno opcional.", required: false, width: 20 },
      { label: "descricao *", description: "Descrição da despesa.", required: true, width: 42 },
      { label: "valor *", description: "Valor da despesa.", required: true, width: 14 },
      { label: "data *", description: "Data em DD/MM/AAAA.", required: true, width: 16 },
      { label: "centro_custo", description: "Centro de custo opcional.", required: false, width: 20 },
      { label: "fornecedor", description: "Fornecedor ou órgão emissor.", required: false, width: 24 },
      { label: "numero_documento", description: "NF, boleto, auto ou referência.", required: false, width: 24 },
    ],
    examples: [
      ["ABC1D23", "CNH001", "toll", "Pedágio", "Pedágio Fernão Dias", 42.5, "16/04/2026", "Operação", "Sem Parar", "TAG-4451"],
      ["LOG7B88", "", "tax", "IPVA", "IPVA 2026 parcela única", 1890, "10/01/2026", "Fiscal", "SEFAZ", "IPVA-2026-01"],
    ],
    rules: [
      "Pode informar placa e/ou CNH, mas ao menos descrição, categoria, valor e data são obrigatórios.",
      "Se informar placa, ela precisa existir na aba veículos ou no banco.",
      "Se informar CNH, ela precisa existir na aba motoristas ou no banco.",
      "Despesas entram em Outras despesas na dashboard e no financeiro da frota.",
    ],
  },
  {
    name: "documentos",
    title: "Documentos",
    columns: [
      { label: "entidade *", description: "vehicle ou driver.", required: true, width: 14 },
      { label: "referencia *", description: "Placa do veículo ou CNH do motorista.", required: true, width: 20 },
      { label: "documento *", description: "Tipo do documento.", required: true, width: 18 },
      { label: "numero", description: "Numero do documento.", required: false, width: 24 },
      { label: "emissao", description: "Data em DD/MM/AAAA.", required: false, width: 16 },
      { label: "vencimento", description: "Data em DD/MM/AAAA.", required: false, width: 16 },
      { label: "url", description: "URL publica do arquivo.", required: false, width: 40 },
    ],
    examples: [
      ["vehicle", "ABC1D23", "crlv", "CRLV-2026-ABC1D23", "01/01/2026", "31/12/2026", ""],
      ["driver", "CNH001", "cnh", "CNH-CNH001", "01/01/2022", "31/12/2027", ""],
    ],
    rules: [
      "entidade aceita vehicle/driver ou veículo/motorista.",
      "referencia precisa existir: placa para vehicle, CNH para driver.",
      "Documento vencido alimenta compliance e alertas.",
    ],
  },
];

@Injectable()
export class TemplateGeneratorService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async generateTemplate(tenantId: string): Promise<Buffer> {
    const [vehicles, drivers] = await Promise.all([
      this.connection.model(Vehicle.name).find({ tenantId }).limit(20).lean(),
      this.connection.model(Driver.name).find({ tenantId }).limit(20).lean(),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sette Log";
    workbook.lastModifiedBy = "Sette Log";
    workbook.created = new Date();
    workbook.modified = new Date();

    this.buildInstructions(workbook);
    this.buildRules(workbook);
    DATA_SHEETS.forEach((sheet) =>
      this.buildDataSheet(
        workbook,
        sheet,
        this.examplesFromDatabase(sheet.name, vehicles, drivers) ?? sheet.examples,
      ),
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  async generateSystemExport(tenantId: string): Promise<Buffer> {
    const [
      vehicles,
      drivers,
      fuelRecords,
      maintenanceOrders,
      expenses,
      documents,
    ] = await Promise.all([
      this.connection
        .model(Vehicle.name)
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean(),
      this.connection
        .model(Driver.name)
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean(),
      this.connection
        .model(FuelRecord.name)
        .find({ tenantId })
        .sort({ filledAt: -1, createdAt: -1 })
        .lean(),
      this.connection
        .model(MaintenanceOrder.name)
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean(),
      this.connection
        .model(Expense.name)
        .find({ tenantId })
        .sort({ occurredAt: -1, createdAt: -1 })
        .lean(),
      this.connection
        .model(DocumentRecord.name)
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const vehicleById = new Map(
      vehicles.map((vehicle: Record<string, any>) => [String(vehicle._id), vehicle]),
    );
    const driverById = new Map(
      drivers.map((driver: Record<string, any>) => [String(driver._id), driver]),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sette Log";
    workbook.lastModifiedBy = "Sette Log";
    workbook.created = new Date();
    workbook.modified = new Date();

    this.buildInstructions(workbook);
    this.buildRules(workbook);

    const exportRowsBySheet: Record<string, unknown[][]> = {
      veiculos: vehicles.map((vehicle: Record<string, any>) => [
        vehicle.plate ?? "",
        vehicle.brand ?? "",
        vehicle.model ?? "",
        vehicle.nickname ?? "",
        vehicle.year ?? "",
        vehicle.type ?? "",
        vehicle.status ?? "",
        vehicle.odometerKm ?? 0,
        vehicle.initialOdometerKm ?? vehicle.odometerKm ?? 0,
        vehicle.tankCapacityLiters ?? "",
        vehicle.costCenter ?? "",
        vehicle.sector ?? "",
        vehicle.city ?? "",
      ]),
      motoristas: drivers.map((driver: Record<string, any>) => [
        driver.name ?? "",
        driver.licenseNumber ?? "",
        driver.licenseCategory ?? "",
        this.formatDate(driver.licenseExpiresAt),
        driver.cpf ?? "",
        driver.phone ?? "",
        driver.email ?? "",
        driver.status ?? "",
      ]),
      abastecimentos: fuelRecords.map((record: Record<string, any>) => [
        vehicleById.get(String(record.vehicleId))?.plate ?? "",
        record.liters ?? 0,
        record.totalCost ?? 0,
        driverById.get(String(record.driverId))?.licenseNumber ?? "",
        record.pricePerLiter ?? "",
        record.odometerKm ?? "",
        this.formatDate(record.filledAt),
        record.station ?? "",
        record.fuelType ?? "",
      ]),
      "manutenções": maintenanceOrders.map((order: Record<string, any>) => [
        vehicleById.get(String(order.vehicleId))?.plate ?? "",
        order.type ?? "",
        order.priority ?? "",
        order.status ?? "",
        this.formatDate(order.scheduledAt),
        order.odometerKm ?? "",
        order.totalCost ?? 0,
        order.description ?? "",
      ]),
      despesas: expenses.map((expense: Record<string, any>) => [
        vehicleById.get(String(expense.vehicleId))?.plate ?? "",
        driverById.get(String(expense.driverId))?.licenseNumber ?? "",
        expense.category ?? "",
        expense.subcategory ?? "",
        expense.description ?? "",
        expense.amount ?? 0,
        this.formatDate(expense.occurredAt),
        expense.costCenter ?? "",
        expense.vendor ?? "",
        expense.documentNumber ?? "",
      ]),
      documentos: documents.map((document: Record<string, any>) => [
        document.entityType ?? "",
        document.entityType === "driver"
          ? (driverById.get(String(document.entityId))?.licenseNumber ?? "")
          : (vehicleById.get(String(document.entityId))?.plate ?? ""),
        document.type ?? "",
        document.number ?? "",
        this.formatDate(document.issuedAt),
        this.formatDate(document.expiresAt),
        document.fileUrl ?? "",
      ]),
    };

    DATA_SHEETS.forEach((sheet) =>
      this.buildDataSheet(
        workbook,
        sheet,
        exportRowsBySheet[sheet.name] ?? [],
      ),
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private buildInstructions(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("instrucoes");
    sheet.columns = [{ width: 34 }, { width: 95 }];
    this.title(sheet, "Template de importação Sette Log", 2);
    [
      ["Ordem correta", "1 veículos, 2 motoristas, 3 abastecimentos, 4 manutenções, 5 despesas, 6 documentos."],
      ["Abas importáveis", "Preencha apenas veículos, motoristas, abastecimentos, manutenções, despesas e documentos."],
      ["Cabeçalho", "Não altere a primeira linha das abas importáveis."],
      ["Exemplos", "Apague ou substitua os exemplos antes de importar dados reais."],
      ["Datas", "Use DD/MM/AAAA ou AAAA-MM-DD."],
      ["Valores", "Use numeros sem simbolo de moeda. Ex: 434 ou 434,50."],
      ["Recalculo de combustível", "Na tela de importação, marque a opcao de recalcular valor_total quando quiser usar litros x preco_litro."],
    ].forEach((row) => sheet.addRow(row));
    this.styleReferenceSheet(sheet);
  }

  private buildRules(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("regras-importação");
    sheet.columns = [{ width: 22 }, { width: 32 }, { width: 95 }];
    this.title(sheet, "Regras e campos aceitos", 3);
    sheet.addRow(["Aba", "Campo", "Regra"]);
    DATA_SHEETS.forEach((item) => {
      item.columns.forEach((column) => {
        sheet.addRow([
          item.name,
          column.label,
          `${column.required ? "Obrigatorio. " : "Opcional. "}${column.description}`,
        ]);
      });
      item.rules.forEach((rule) => sheet.addRow([item.name, "regra", rule]));
    });
    this.styleReferenceSheet(sheet);
  }

  private buildDataSheet(
    workbook: ExcelJS.Workbook,
    definition: TemplateSheet,
    examples: unknown[][],
  ) {
    const sheet = workbook.addWorksheet(definition.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    definition.columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = column.width ?? 18;
    });

    const header = sheet.addRow(definition.columns.map((column) => column.label));
    header.height = 28;
    header.eachCell((cell, columnNumber) => {
      const required = definition.columns[columnNumber - 1]?.required;
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: required ? "14532D" : "1F2937" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    examples.forEach((example) => {
      const row = sheet.addRow(example);
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "hair", color: { argb: "CBD5E1" } },
          bottom: { style: "hair", color: { argb: "CBD5E1" } },
        };
      });
    });
  }

  private examplesFromDatabase(
    sheetName: string,
    vehicles: Record<string, any>[],
    drivers: Record<string, any>[],
  ) {
    if (sheetName === "veiculos" && vehicles.length > 0) {
      return vehicles.map((vehicle) => [
        vehicle.plate,
        vehicle.brand,
        vehicle.model,
        vehicle.nickname ?? "",
        vehicle.year ?? "",
        vehicle.type ?? "car",
        vehicle.status ?? "available",
        vehicle.odometerKm ?? 0,
        vehicle.initialOdometerKm ?? vehicle.odometerKm ?? 0,
        vehicle.tankCapacityLiters ?? "",
        vehicle.costCenter ?? "",
        vehicle.sector ?? "",
        vehicle.city ?? "",
      ]);
    }
    if (sheetName === "motoristas" && drivers.length > 0) {
      return drivers.map((driver) => [
        driver.name,
        driver.licenseNumber,
        driver.licenseCategory ?? "B",
        driver.licenseExpiresAt
          ? new Date(driver.licenseExpiresAt).toLocaleDateString("pt-BR")
          : "31/12/2030",
        driver.cpf ?? "",
        driver.phone ?? "",
        driver.email ?? "",
        driver.status ?? "active",
      ]);
    }
    return undefined;
  }

  private formatDate(value?: unknown) {
    if (!value) {
      return "";
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("pt-BR");
  }

  private title(sheet: ExcelJS.Worksheet, text: string, columns: number) {
    sheet.mergeCells(1, 1, 1, columns);
    const cell = sheet.getCell(1, 1);
    cell.value = text;
    cell.font = { bold: true, size: 15, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 34;
  }

  private styleReferenceSheet(sheet: ExcelJS.Worksheet) {
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        if (rowNumber === 2) {
          cell.font = { bold: true, color: { argb: "FFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "166534" },
          };
        }
      });
    });
  }
}

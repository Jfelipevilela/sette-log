import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import ExcelJS from "exceljs";
import { Connection } from "mongoose";
import { Driver, Vehicle } from "./schemas/fleet.schemas";

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

const DATA_SHEETS: TemplateSheet[] = [
  {
    name: "veiculos",
    title: "Veiculos",
    columns: [
      { label: "placa *", description: "Placa unica do veiculo.", required: true, width: 16 },
      { label: "marca *", description: "Fabricante do veiculo.", required: true, width: 20 },
      { label: "modelo *", description: "Modelo do veiculo.", required: true, width: 24 },
      { label: "apelido", description: "Nome interno opcional.", required: false, width: 22 },
      { label: "ano", description: "Ano do veiculo.", required: false, width: 10 },
      { label: "tipo", description: "car, van, truck, bus, motorcycle, equipment.", required: false, width: 18 },
      { label: "status", description: "available, in_route, stopped, maintenance, inactive, blocked.", required: false, width: 18 },
      { label: "odometro", description: "Km atual acumulado.", required: false, width: 14 },
      { label: "odometro_base_consumo", description: "Km inicial para calculo de consumo.", required: false, width: 24 },
      { label: "capacidade_tanque", description: "Capacidade do tanque em litros.", required: false, width: 20 },
      { label: "centro_custo", description: "Centro de custo.", required: false, width: 20 },
      { label: "setor", description: "Setor responsavel.", required: false, width: 18 },
      { label: "cidade", description: "Cidade de operacao.", required: false, width: 18 },
    ],
    examples: [
      ["ABC1D23", "Fiat", "Mobi", "Mobi Movida", 2026, "car", "available", 1200, 0, 47, "Operacao", "Logistica", "Manaus"],
      ["LOG7B88", "Volkswagen", "Delivery", "Caminhao 01", 2022, "truck", "available", 61200, 58000, 120, "Distribuicao", "Entrega", "Sao Paulo"],
    ],
    rules: [
      "A placa e a chave unica. Se ja existir, o veiculo sera atualizado.",
      "Linhas sem placa nao sao importadas.",
      "Veiculo inativo ou bloqueado nao deve ser usado como disponivel na operacao.",
    ],
  },
  {
    name: "motoristas",
    title: "Motoristas",
    columns: [
      { label: "nome *", description: "Nome completo.", required: true, width: 28 },
      { label: "cnh *", description: "CNH unica do motorista.", required: true, width: 18 },
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
      "A CNH e a chave unica. Se ja existir, o motorista sera atualizado.",
      "CNHs duplicadas dentro da mesma planilha sao bloqueadas.",
      "Linhas sem nome ou sem CNH nao sao importadas.",
    ],
  },
  {
    name: "abastecimentos",
    title: "Abastecimentos",
    columns: [
      { label: "placa *", description: "Placa de veiculo ja cadastrado.", required: true, width: 16 },
      { label: "litros *", description: "Quantidade abastecida.", required: true, width: 12 },
      { label: "valor_total *", description: "Total pago.", required: true, width: 14 },
      { label: "cnh", description: "CNH do motorista, opcional.", required: false, width: 18 },
      { label: "preco_litro", description: "Valor por litro.", required: false, width: 14 },
      { label: "odometro", description: "Km no abastecimento.", required: false, width: 14 },
      { label: "data_abastecimento", description: "Data em DD/MM/AAAA.", required: false, width: 20 },
      { label: "posto", description: "Local do abastecimento.", required: false, width: 24 },
      { label: "combustivel", description: "gasoline, ethanol, diesel, cng, electric.", required: false, width: 16 },
    ],
    examples: [
      ["ABC1D23", 70, 434, "CNH001", 6.2, 1300, "16/04/2026", "Posto Amazonas", "ethanol"],
      ["ABC1D23", 45, 279, "CNH001", 6.2, 1700, "25/04/2026", "Posto Amazonas", "ethanol"],
      ["LOG7B88", 280, 1610, "CNH002", 5.75, 62100, "16/04/2026", "Posto Rota BR", "diesel"],
    ],
    rules: [
      "A placa precisa existir na aba veiculos ou no banco.",
      "Se informar CNH, ela precisa existir na aba motoristas ou no banco.",
      "Por padrao, litros x preco_litro precisa bater com valor_total. Na tela ha opcao para recalcular valor_total automaticamente.",
      "Para km/l por abastecimento, informe odometro em abastecimentos consecutivos do mesmo veiculo.",
    ],
  },
  {
    name: "manutencoes",
    title: "Manutencoes",
    columns: [
      { label: "placa *", description: "Placa de veiculo ja cadastrado.", required: true, width: 16 },
      { label: "tipo", description: "preventive, corrective, predictive.", required: false, width: 16 },
      { label: "prioridade", description: "low, medium, high, critical.", required: false, width: 14 },
      { label: "status", description: "open, scheduled, in_progress, closed, cancelled.", required: false, width: 18 },
      { label: "agendamento", description: "Data em DD/MM/AAAA.", required: false, width: 18 },
      { label: "odometro", description: "Km da manutencao.", required: false, width: 14 },
      { label: "valor_total", description: "Custo total.", required: false, width: 14 },
      { label: "descricao", description: "Descricao do servico.", required: false, width: 42 },
    ],
    examples: [
      ["ABC1D23", "preventive", "medium", "scheduled", "30/04/2026", 1800, 780, "Troca de oleo e filtros"],
      ["LOG7B88", "corrective", "high", "closed", "05/03/2026", 61500, 1450, "Revisao de freios"],
    ],
    rules: [
      "A placa precisa existir na aba veiculos ou no banco.",
      "Se valor_total ficar vazio, sera gravado como zero.",
      "Manutencoes entram nos custos acumulados da dashboard.",
    ],
  },
  {
    name: "documentos",
    title: "Documentos",
    columns: [
      { label: "entidade *", description: "vehicle ou driver.", required: true, width: 14 },
      { label: "referencia *", description: "Placa do veiculo ou CNH do motorista.", required: true, width: 20 },
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
      "entidade aceita vehicle/driver ou veiculo/motorista.",
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

  private buildInstructions(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("instrucoes");
    sheet.columns = [{ width: 34 }, { width: 95 }];
    this.title(sheet, "Template de importacao Sette Log", 2);
    [
      ["Ordem correta", "1 veiculos, 2 motoristas, 3 abastecimentos, 4 manutencoes, 5 documentos."],
      ["Abas importaveis", "Preencha apenas veiculos, motoristas, abastecimentos, manutencoes e documentos."],
      ["Cabecalho", "Nao altere a primeira linha das abas importaveis."],
      ["Exemplos", "Apague ou substitua os exemplos antes de importar dados reais."],
      ["Datas", "Use DD/MM/AAAA ou AAAA-MM-DD."],
      ["Valores", "Use numeros sem simbolo de moeda. Ex: 434 ou 434,50."],
      ["Recalculo de combustivel", "Na tela de importacao, marque a opcao de recalcular valor_total quando quiser usar litros x preco_litro."],
    ].forEach((row) => sheet.addRow(row));
    this.styleReferenceSheet(sheet);
  }

  private buildRules(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("regras-importacao");
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

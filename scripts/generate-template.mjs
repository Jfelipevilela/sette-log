import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(
  __dirname,
  "..",
  "templates",
  "sette-log-importacao-template.xlsx",
);
mkdirSync(path.dirname(OUTPUT), { recursive: true });

// ─── Cores do sistema ────────────────────────────────────────────────────────
const COR_HEADER = "1A1A2E"; // fundo header (azul escuro)
const COR_HEADER_FONT = "FFFFFF"; // texto header
const COR_OBRIG = "E8F5E9"; // fundo coluna obrigatória (verde claro)
const COR_OPCIONAL = "F3F4F6"; // fundo coluna opcional (cinza claro)
const COR_EXEMPLO = "FFFFFF"; // fundo linhas de exemplo
const COR_INSTRUCAO_H = "1E3A5F"; // header da aba instrucoes
const COR_ALERTA = "FFF3CD"; // fundo linhas de alerta/aviso
const COR_SECAO = "E3F2FD"; // fundo linha de seção/destaque
const COR_BORDA = "CBD5E1"; // cor da borda

/** Aplica estilo ao cabeçalho de uma coluna */
function headerStyle(cell, label, obrigatorio = false) {
  cell.value = label;
  cell.font = { bold: true, color: { argb: COR_HEADER_FONT }, size: 11 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COR_HEADER },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: COR_BORDA } },
    left: { style: "thin", color: { argb: COR_BORDA } },
    bottom: { style: "thin", color: { argb: COR_BORDA } },
    right: { style: "thin", color: { argb: COR_BORDA } },
  };
  return cell;
}

/** Aplica estilo a uma célula de dado */
function dataStyle(cell, obrigatorio = false) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: obrigatorio ? COR_OBRIG : COR_EXEMPLO },
  };
  cell.alignment = { vertical: "middle", wrapText: false };
  cell.border = {
    top: { style: "hair", color: { argb: COR_BORDA } },
    left: { style: "hair", color: { argb: COR_BORDA } },
    bottom: { style: "hair", color: { argb: COR_BORDA } },
    right: { style: "hair", color: { argb: COR_BORDA } },
  };
}

/** Linha de nota auxiliar (fundo amarelo) */
function noteRow(sheet, colCount, text, bgColor = COR_ALERTA) {
  const row = sheet.addRow([text]);
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: bgColor },
  };
  row.getCell(1).font = { italic: true, size: 10, color: { argb: "374151" } };
  row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
  if (colCount > 1) {
    sheet.mergeCells(row.number, 1, row.number, colCount);
  }
  row.height = 24;
  return row;
}

/** Cria cabeçalho padronizado numa aba */
function buildSheet(wb, name, displayName, columns, examples, notes = []) {
  const sheet = wb.addWorksheet(displayName ?? name, {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  // Larguras
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width ?? 22;
  });

  // Linha de cabeçalho
  const headerRow = sheet.addRow(columns.map((c) => c.label));
  headerRow.height = 30;
  columns.forEach((col, i) => {
    headerStyle(headerRow.getCell(i + 1), col.label, col.required);
  });

  // Linhas de exemplo
  examples.forEach((ex) => {
    const row = sheet.addRow(ex);
    row.height = 20;
    ex.forEach((_, i) => {
      dataStyle(row.getCell(i + 1), columns[i]?.required);
    });
  });

  // Notas abaixo
  if (notes.length) {
    sheet.addRow([]);
    notes.forEach((note) => noteRow(sheet, columns.length, note));
  }

  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════════
const wb = new ExcelJS.Workbook();
wb.creator = "Sette Log";
wb.lastModifiedBy = "Sette Log";
wb.created = new Date();
wb.modified = new Date();

// ─── ABA: instrucoes ──────────────────────────────────────────────────────────
const instrSheet = wb.addWorksheet("instrucoes", {
  properties: { tabColor: { argb: "1A1A2E" } },
});
instrSheet.getColumn(1).width = 30;
instrSheet.getColumn(2).width = 80;

// Título principal
instrSheet.mergeCells("A1:B1");
const tituloCell = instrSheet.getCell("A1");
tituloCell.value = "🚛 Sette Log — Template de Importação de Dados Históricos";
tituloCell.font = { bold: true, size: 16, color: { argb: "FFFFFF" } };
tituloCell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: COR_INSTRUCAO_H },
};
tituloCell.alignment = { vertical: "middle", horizontal: "center" };
instrSheet.getRow(1).height = 40;

const instrucoes = [
  ["", ""],
  ["📋 COMO USAR", ""],
  ["1. Preencha cada aba com seus dados históricos.", ""],
  ["2. A 1ª linha de cada aba é o cabeçalho — não altere.", ""],
  ["3. Exclua as linhas de exemplo antes de enviar.", ""],
  [
    "4. Vá em Configurações → Importar dados antigos, selecione o tipo e envie este arquivo.",
    "",
  ],
  ["", ""],
  ["📌 ORDEM DE IMPORTAÇÃO (OBRIGATÓRIA)", ""],
  [
    "Etapa 1 → Veículos",
    "Preencha a aba 'veiculos'. Deve ser a primeira importação.",
  ],
  [
    "Etapa 2 → Motoristas",
    "Preencha a aba 'motoristas'. Pode ser importada junto com veículos.",
  ],
  [
    "Etapa 3 → Abastecimentos",
    "Use a placa do veículo e CNH do motorista (já cadastrados).",
  ],
  [
    "Etapa 4 → Manutenções",
    "Requer veículo cadastrado. Informe a placa na coluna 'placa'.",
  ],
  [
    "Etapa 5 → Documentos",
    "Vincule a veiculo (placa) ou motorista (CNH) já cadastrado.",
  ],
  ["", ""],
  ["📅 FORMATOS ACEITOS", ""],
  ["Datas", "DD/MM/AAAA  ou  AAAA-MM-DD  (ex: 15/04/2026 ou 2026-04-15)"],
  [
    "Valores monetários",
    "Use ponto ou vírgula decimal. Ex: 1.450,00 ou 1450.00",
  ],
  [
    "Placa",
    "Qualquer formato: ABC1234, ABC1D23 (Mercosul). Será normalizada automaticamente.",
  ],
  ["", ""],
  ["⚠️ CAMPOS OBRIGATÓRIOS", ""],
  ["veiculos", "placa, marca, modelo"],
  [
    "* Campos obrigatórios marcados com asterisco (*).",
    "tipo aceita: automovel, caminhao, van, onibus, moto, equipamento  |  status aceita: disponivel, em_rota, parado, manutencao, inativo, bloqueado",
    "Se omitido, tipo=automovel e status=disponivel são usados como padrão.",
    "Dica: preencha o odômetro atual do veículo (km acumulado) para que o sistema calcule consumo por km corretamente.",
  ],
  ["motoristas", "nome, cnh, categoria_cnh, validade_cnh"],
  [
    "* Campos obrigatórios: nome, cnh, categoria_cnh, validade_cnh.",
    "categoria_cnh aceita: A, B, C, D, E, AB, AC, AD, AE.",
    "status aceita: ativo, inativo, bloqueado, ferias  |  CPF e telefone são opcionais mas recomendados.",
    "Se o número de CNH já existir no sistema, o registro será ATUALIZADO.",
  ],
  ["abastecimentos", "placa, litros, valor_total"],
  [
    "* Campos obrigatórios: placa (deve ser de veículo já cadastrado), litros, valor_total.",
    "ATENÇÃO: Importe veículos e motoristas ANTES de importar abastecimentos.",
    "combustivel aceita: gasolina, etanol, diesel, gnv, eletrico.",
    "Dica: preencha o odômetro no momento do abastecimento para calcular km/litro automaticamente.",
    "O campo 'cnh' é opcional — vincula o abastecimento a um motorista específico.",
  ],
  ["manutencoes", "placa"],
  [
    "* Campo obrigatório: placa (veículo deve estar cadastrado previamente).",
    "tipo aceita: preventiva, corretiva.",
    "prioridade aceita: baixa, media, alta, critica.",
    "status aceita: aberta, agendada, em_andamento, concluida, cancelada.",
    "valor_total: custo total da manutenção (peças + mão de obra).",
  ],
  ["documentos", "entidade, referencia, documento"],
  [
    "* Campos obrigatórios: entidade (veiculo ou motorista), referencia (placa ou CNH), documento (tipo).",
    "entidade aceita: veiculo, motorista.",
    "Tipos comuns de documento para VEÍCULOS: crlv, ipva, seguro, licenca, visistoria.",
    "Tipos comuns de documento para MOTORISTAS: cnh, aso (atestado de saúde), treinamento.",
    "url: endereço público do arquivo digitalizado (opcional).",
  ],
  ["", ""],
  ["🔄 COMPORTAMENTO DE ATUALIZAÇÃO", ""],
  ["Veículos", "Se a placa já existir, os dados serão ATUALIZADOS."],
  ["Motoristas", "Se o número de CNH já existir, os dados serão ATUALIZADOS."],
  ["Abastecimentos", "Sempre inseridos como novos registros."],
  ["Manutenções", "Sempre inseridas como novas ordens."],
  ["Documentos", "Se já existir mesmo tipo/número, será ATUALIZADO."],
  ["", ""],
  [
    "📁 FORMATOS SUPORTADOS",
    "CSV (UTF-8 ou Latin-1) e XLSX — até 5.000 linhas por envio.",
  ],
];

instrucoes.forEach(([campo, instrucao], i) => {
  const row = instrSheet.addRow([campo, instrucao]);
  const isSection =
    campo.startsWith("📋") ||
    campo.startsWith("📌") ||
    campo.startsWith("📅") ||
    campo.startsWith("⚠️") ||
    campo.startsWith("🔄") ||
    campo.startsWith("📁") ||
    campo.startsWith("🚀") ||
    campo.startsWith("✅") ||
    campo.startsWith("💡");
  if (isSection) {
    row.getCell(1).font = { bold: true, size: 11, color: { argb: "1E3A5F" } };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COR_SECAO },
    };
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COR_SECAO },
    };
    instrSheet.mergeCells(row.number, 1, row.number, 2);
    row.height = 26;
  } else if (campo) {
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
    row.height = 20;
  }
});

// ─── ABA: veiculos ────────────────────────────────────────────────────────────
buildSheet(
  wb,
  "veiculos",
  "veiculos",
  [
    { label: "placa *", required: true, width: 16 },
    { label: "marca *", required: true, width: 20 },
    { label: "modelo *", required: true, width: 24 },
    { label: "apelido", required: false, width: 22 },
    { label: "ano", required: false, width: 10 },
    { label: "tipo", required: false, width: 18 },
    { label: "status", required: false, width: 16 },
    { label: "odometro", required: false, width: 14 },
    { label: "capacidade_tanque", required: false, width: 18 },
    { label: "centro_custo", required: false, width: 22 },
  ],
  [
    [
      "ABC1D23",
      "Toyota",
      "Corolla",
      "Carro Executivo",
      2021,
      "automovel",
      "disponivel",
      35000,
      55,
      "Operacao Urbana",
    ],
    [
      "LOG7B88",
      "Volkswagen",
      "Delivery 11.180",
      "",
      2022,
      "caminhao",
      "em rota",
      61200,
      120,
      "Distribuicao",
    ],
    [
      "MBZ2E34",
      "Mercedes",
      "Sprinter 415 CDI",
      "Van Executiva",
      2023,
      "van",
      "disponivel",
      18500,
      70,
      "Transporte VIP",
    ],
    [
      "ONI5F56",
      "Marcopolo",
      "Paradiso 1200",
      "",
      2020,
      "onibus",
      "disponivel",
      185000,
      300,
      "Rota Interestadual",
    ],
    [
      "MOT3G78",
      "Honda",
      "CG 160 Titan",
      "Moto Entrega 1",
      2022,
      "moto",
      "disponivel",
      12000,
      10,
      "Ultimo Km",
    ],
  ],
);

// ─── ABA: motoristas ─────────────────────────────────────────────────────────
buildSheet(
  wb,
  "motoristas",
  "motoristas",
  [
    { label: "nome *", required: true, width: 28 },
    { label: "cnh *", required: true, width: 18 },
    { label: "categoria_cnh *", required: true, width: 16 },
    { label: "validade_cnh *", required: true, width: 16 },
    { label: "cpf", required: false, width: 18 },
    { label: "telefone", required: false, width: 20 },
    { label: "email", required: false, width: 28 },
    { label: "status", required: false, width: 14 },
  ],
  [
    [
      "Joao Silva",
      "SP12345678",
      "E",
      "10/08/2027",
      "111.222.333-44",
      "+55 11 90000-0001",
      "joao.silva@example.com",
      "ativo",
    ],
    [
      "Maria Santos",
      "SP87654321",
      "D",
      "20/05/2027",
      "222.333.444-55",
      "+55 11 90000-0002",
      "maria.santos@example.com",
      "ativo",
    ],
    [
      "Carlos Lima",
      "MG11223344",
      "B",
      "15/03/2026",
      "333.444.555-66",
      "+55 31 90000-0003",
      "carlos.lima@example.com",
      "ativo",
    ],
    [
      "Ana Ferreira",
      "RJ55667788",
      "A",
      "22/11/2028",
      "444.555.666-77",
      "+55 21 90000-0004",
      "ana.ferreira@example.com",
      "ferias",
    ],
    [
      "Pedro Rocha",
      "SP99887766",
      "C",
      "30/06/2025",
      "555.666.777-88",
      "+55 11 90000-0005",
      "",
      "inativo",
    ],
  ],
);

// ─── ABA: abastecimentos ─────────────────────────────────────────────────────
buildSheet(
  wb,
  "abastecimentos",
  "abastecimentos",
  [
    { label: "placa *", required: true, width: 16 },
    { label: "litros *", required: true, width: 12 },
    { label: "valor_total *", required: true, width: 14 },
    { label: "cnh", required: false, width: 18 },
    { label: "preco_litro", required: false, width: 14 },
    { label: "odometro", required: false, width: 14 },
    { label: "data_abastecimento", required: false, width: 22 },
    { label: "posto", required: false, width: 22 },
    { label: "combustivel", required: false, width: 16 },
  ],
  [
    [
      "ABC1D23",
      52.4,
      318.7,
      "SP12345678",
      6.08,
      35120,
      "12/04/2026",
      "Posto Central",
      "gasolina",
    ],
    [
      "ABC1D23",
      48.0,
      291.84,
      "SP12345678",
      6.08,
      35640,
      "28/04/2026",
      "Posto Central",
      "gasolina",
    ],
    [
      "LOG7B88",
      280.0,
      1610.0,
      "SP87654321",
      5.75,
      61340,
      "13/04/2026",
      "Posto Rota BR",
      "diesel",
    ],
    [
      "LOG7B88",
      260.0,
      1495.0,
      "SP87654321",
      5.75,
      62100,
      "25/04/2026",
      "Posto Rota BR",
      "diesel",
    ],
    [
      "MBZ2E34",
      60.0,
      414.0,
      "",
      6.9,
      18700,
      "14/04/2026",
      "Posto Shell Cid",
      "diesel",
    ],
    [
      "MOT3G78",
      8.5,
      54.4,
      "",
      6.4,
      12060,
      "10/04/2026",
      "Auto Posto Alfa",
      "gasolina",
    ],
  ],
);

// ─── ABA: manutencoes ────────────────────────────────────────────────────────
buildSheet(
  wb,
  "manutencoes",
  "manutencoes",
  [
    { label: "placa *", required: true, width: 16 },
    { label: "tipo", required: false, width: 16 },
    { label: "prioridade", required: false, width: 14 },
    { label: "status", required: false, width: 16 },
    { label: "agendamento", required: false, width: 18 },
    { label: "odometro", required: false, width: 14 },
    { label: "valor_total", required: false, width: 14 },
    { label: "descricao", required: false, width: 40 },
  ],
  [
    [
      "ABC1D23",
      "preventiva",
      "media",
      "agendada",
      "30/04/2026",
      36000,
      780.0,
      "Troca de óleo e filtro de ar",
    ],
    [
      "ABC1D23",
      "corretiva",
      "alta",
      "concluida",
      "05/03/2026",
      33200,
      1200.0,
      "Substituição pastilha de freio dianteira",
    ],
    [
      "LOG7B88",
      "corretiva",
      "alta",
      "em andamento",
      "15/04/2026",
      61380,
      1450.0,
      "Revisão sistema de freios e embreagem",
    ],
    [
      "LOG7B88",
      "preventiva",
      "media",
      "concluida",
      "10/02/2026",
      58000,
      650.0,
      "Troca de óleo câmbio e diferencial",
    ],
    [
      "MBZ2E34",
      "preventiva",
      "baixa",
      "aberta",
      "05/05/2026",
      19000,
      0,
      "Revisão 20.000 km agendada",
    ],
    [
      "MOT3G78",
      "preventiva",
      "media",
      "agendada",
      "20/04/2026",
      13000,
      280.0,
      "Troca de óleo motor e filtro",
    ],
  ],
);

// ─── ABA: documentos ─────────────────────────────────────────────────────────
buildSheet(
  wb,
  "documentos",
  "documentos",
  [
    { label: "entidade *", required: true, width: 14 },
    { label: "referencia *", required: true, width: 20 },
    { label: "documento *", required: true, width: 18 },
    { label: "numero", required: false, width: 24 },
    { label: "emissao", required: false, width: 16 },
    { label: "vencimento", required: false, width: 16 },
    { label: "url", required: false, width: 40 },
  ],
  [
    [
      "veiculo",
      "ABC1D23",
      "crlv",
      "CRLV-2026-ABC1D23",
      "01/01/2026",
      "31/12/2026",
      "",
    ],
    [
      "veiculo",
      "ABC1D23",
      "ipva",
      "IPVA-2026-12345",
      "01/01/2026",
      "30/04/2026",
      "",
    ],
    [
      "veiculo",
      "LOG7B88",
      "crlv",
      "CRLV-2026-LOG7B88",
      "01/01/2026",
      "31/12/2026",
      "",
    ],
    [
      "veiculo",
      "LOG7B88",
      "seguro",
      "POL-2026-98765",
      "15/01/2026",
      "14/01/2027",
      "https://exemplo.com/seguro.pdf",
    ],
    [
      "motorista",
      "SP12345678",
      "cnh",
      "CNH-SP12345678",
      "10/08/2022",
      "10/08/2027",
      "",
    ],
    [
      "motorista",
      "SP87654321",
      "cnh",
      "CNH-SP87654321",
      "20/05/2022",
      "20/05/2027",
      "",
    ],
    [
      "motorista",
      "SP12345678",
      "aso",
      "ASO-2026-11122233344",
      "15/03/2026",
      "15/03/2027",
      "",
    ],
  ],
);

// ─── ABA: guia-relacionamentos ────────────────────────────────────────────────
const guiaSheet = wb.addWorksheet("guia-relacionamentos", {
  properties: { tabColor: { argb: "059669" } },
});
guiaSheet.getColumn(1).width = 18;
guiaSheet.getColumn(2).width = 40;
guiaSheet.getColumn(3).width = 50;

// Título
guiaSheet.mergeCells("A1:C1");
const guiaTitulo = guiaSheet.getCell("A1");
guiaTitulo.value = "🔗 Relacionamentos entre Dados";
guiaTitulo.font = { bold: true, size: 14, color: { argb: "FFFFFF" } };
guiaTitulo.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "059669" },
};
guiaTitulo.alignment = { vertical: "middle", horizontal: "center" };
guiaSheet.getRow(1).height = 35;

const relacionamentos = [
  ["Tipo", "Descrição", "Exemplos de Uso"],
  ["", "", ""],
  [
    "VEÍCULO",
    "Entidade base do sistema",
    "Todos os registros de combustível, manutenção e documentos devem estar vinculados a um veículo via PLACA",
  ],
  ["", "", ""],
  [
    "MOTORISTA",
    "Condutor do veículo",
    "Pode ser vinculado a abastecimentos (CNH) e ter documentos próprios (CNH, ASO, Treinamentos)",
  ],
  ["", "", ""],
  [
    "ABASTECIMENTO",
    "Registro de combustível",
    "Obrigatoriamente vinculado a um VEÍCULO (placa)",
  ],
  [
    "",
    "",
    "Opcionalmente vinculado a um MOTORISTA (CNH) — quem fez o abastecimento",
  ],
  ["", "", ""],
  [
    "MANUTENÇÃO",
    "Ordem de serviço",
    "Obrigatoriamente vinculado a um VEÍCULO (placa)",
  ],
  ["", "", "Registra tipo, prioridade, status e custo da manutenção"],
  ["", "", ""],
  [
    "DOCUMENTO",
    "Registro de documento",
    "Pode ser de VEÍCULO (CRLV, IPVA, Seguro) ou MOTORISTA (CNH, ASO)",
  ],
  [
    "",
    "",
    "Deve informar a entidade (veiculo/motorista) e referência (placa/CNH)",
  ],
];

relacionamentos.forEach((row, i) => {
  const xlsRow = guiaSheet.addRow(row);
  xlsRow.height = row[0] === "Tipo" ? 24 : row[0] === "" ? 12 : 30;

  if (row[0] === "Tipo") {
    // Header row
    row.forEach((_, colIndex) => {
      const cell = xlsRow.getCell(colIndex + 1);
      cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0F766E" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
    });
  } else if (row[0]) {
    xlsRow.getCell(1).font = {
      bold: true,
      size: 10,
      color: { argb: "059669" },
    };
    xlsRow.getCell(2).font = { size: 9, italic: true };
    xlsRow.getCell(3).font = { size: 9 };
    row.forEach((_, colIndex) => {
      xlsRow.getCell(colIndex + 1).alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
    });
  }
});

// ─── ABA: checklist-validacao ─────────────────────────────────────────────────
const checklistSheet = wb.addWorksheet("checklist-validacao", {
  properties: { tabColor: { argb: "7C3AED" } },
});
checklistSheet.getColumn(1).width = 6;
checklistSheet.getColumn(2).width = 45;
checklistSheet.getColumn(3).width = 50;

// Título
checklistSheet.mergeCells("A1:C1");
const checklistTitulo = checklistSheet.getCell("A1");
checklistTitulo.value = "✅ Checklist de Validação Antes de Importar";
checklistTitulo.font = { bold: true, size: 14, color: { argb: "FFFFFF" } };
checklistTitulo.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "6D28D9" },
};
checklistTitulo.alignment = { vertical: "middle", horizontal: "center" };
checklistSheet.getRow(1).height = 35;

const checklist = [
  ["✓", "Item a Verificar", "Descrição / O que verificar"],
  ["", "", ""],
  [
    "",
    "Dados Obrigatórios - VEÍCULOS",
    "Cada veículo tem: placa, marca e modelo preenchidos?",
  ],
  [
    "",
    "Dados Obrigatórios - MOTORISTAS",
    "Cada motorista tem: nome, CNH, categoria e validade preenchidos?",
  ],
  [
    "",
    "Dados Obrigatórios - ABASTECIMENTOS",
    "Cada abastecimento tem: placa, litros e valor_total preenchidos?",
  ],
  [
    "",
    "Placas Consistentes",
    "As placas usadas em abastecimentos/manutenções estão cadastradas em veículos?",
  ],
  [
    "",
    "CNHs Consistentes",
    "As CNHs usadas em abastecimentos estão cadastradas em motoristas?",
  ],
  [
    "",
    "Datas Válidas",
    "Todas as datas estão em formato DD/MM/AAAA ou AAAA-MM-DD? (sem caracteres especiais)",
  ],
  [
    "",
    "Valores Positivos",
    "Litros, valores e km são números positivos (sem símbolos de moeda)?",
  ],
  [
    "",
    "Entidades de Documentos",
    "Campo 'entidade' contém apenas 'veiculo' ou 'motorista'?",
  ],
  [
    "",
    "Referências de Documentos",
    "Referências de documentos (placa/CNH) existem nos dados cadastrados?",
  ],
  [
    "",
    "Sem Duplicatas",
    "Não há linhas duplicadas (mesmos dados em múltiplas linhas)?",
  ],
  [
    "",
    "Linhas Vazias Removidas",
    "Não existem linhas completamente vazias entre dados?",
  ],
  [
    "",
    "Exemplos Excluídos",
    "Todas as linhas de exemplo foram removidas das abas de dados?",
  ],
  ["", "Arquivo em Excel", "O arquivo está em formato .xlsx e não corrompido?"],
];

checklist.forEach((row, i) => {
  const xlsRow = checklistSheet.addRow(row);
  xlsRow.height = 22;

  if (row[1] === "Item a Verificar") {
    row.forEach((_, colIndex) => {
      const cell = xlsRow.getCell(colIndex + 1);
      cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "6D28D9" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });
  } else if (row[1]) {
    xlsRow.getCell(1).font = { size: 14, bold: true };
    xlsRow.getCell(1).alignment = { vertical: "center", horizontal: "center" };
    xlsRow.getCell(2).font = { bold: true, size: 9 };
    xlsRow.getCell(3).font = { size: 9 };
    xlsRow.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "EDE9FE" },
    };
    xlsRow.getCell(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F3E8FF" },
    };
  }
});

// ─── ABA: dados-completos ─────────────────────────────────────────────────────
const completosSheet = wb.addWorksheet("dados-completos", {
  properties: { tabColor: { argb: "0891B2" } },
});
completosSheet.getColumn(1).width = 25;
for (let i = 2; i <= 30; i++) {
  completosSheet.getColumn(i).width = 18;
}

// Título descritivo
completosSheet.mergeCells("A1:Z1");
const completosTitulo = completosSheet.getCell("A1");
completosTitulo.value = "📊 Visão Completa de Todos os Dados (Referência)";
completosTitulo.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
completosTitulo.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "0891B2" },
};
completosTitulo.alignment = { vertical: "middle", horizontal: "center" };
completosSheet.getRow(1).height = 28;

// Informações de estrutura
const descricao = [
  "",
  "Esta aba consolida a estrutura de dados do sistema para referência.",
  "Preencha APENAS as abas específicas (veiculos, motoristas, abastecimentos, manutencoes, documentos).",
  "As colunas abaixo mostram a ordem e os tipos de campo que o sistema espera:",
  "",
];

descricao.forEach((text, i) => {
  const row = completosSheet.addRow([text]);
  row.height = 18;
  if (
    text.includes("Esta aba") ||
    text.includes("As colunas") ||
    text.includes("Preencha")
  ) {
    row.getCell(1).font = { italic: true, size: 9, color: { argb: "475569" } };
  }
});

// Estrutura por tipo
const estruturaDados = [
  ["", ""],
  ["VEÍCULOS", ""],
  ["Coluna", "Descrição"],
  ["placa *", "Identificador único do veículo (ex: ABC1D23 ou LOG7B88)"],
  ["marca *", "Fabricante (ex: Toyota, Volkswagen, Mercedes)"],
  ["modelo *", "Modelo do veículo (ex: Corolla, Delivery)"],
  ["apelido", "Apelido ou nome customizado do veículo"],
  ["ano", "Ano de fabricação (ex: 2021)"],
  ["tipo", "Tipo: automovel, caminhao, van, onibus, moto, equipamento"],
  [
    "status",
    "Status: disponivel, em_rota, parado, manutencao, inativo, bloqueado",
  ],
  ["odometro", "Quilometragem acumulada do veículo"],
  ["capacidade_tanque", "Capacidade do tanque em litros"],
  ["centro_custo", "Centro de custo ou departamento responsável"],

  ["", ""],
  ["MOTORISTAS", ""],
  ["Coluna", "Descrição"],
  ["nome *", "Nome completo do motorista"],
  ["cnh *", "Número da Carteira Nacional de Habilitação"],
  ["categoria_cnh *", "Categoria da CNH: A, B, C, D, E, AB, AC, AD, AE"],
  ["validade_cnh *", "Data de validade da CNH (DD/MM/AAAA)"],
  ["cpf", "Número do CPF do motorista"],
  ["telefone", "Telefone de contato"],
  ["email", "Endereço de e-mail"],
  ["status", "Status: ativo, inativo, bloqueado, ferias"],

  ["", ""],
  ["ABASTECIMENTOS", ""],
  ["Coluna", "Descrição"],
  ["placa *", "Placa do veículo (deve estar cadastrado)"],
  ["litros *", "Quantidade de litros abastecidos"],
  ["valor_total *", "Valor total do abastecimento"],
  ["cnh", "CNH do motorista que abasteceu (opcional)"],
  ["preco_litro", "Preço unitário por litro"],
  ["odometro", "Quilometragem no momento do abastecimento"],
  ["data_abastecimento", "Data do abastecimento (DD/MM/AAAA)"],
  ["posto", "Nome ou identificação do posto de combustível"],
  ["combustivel", "Tipo: gasolina, etanol, diesel, gnv, eletrico"],

  ["", ""],
  ["MANUTENÇÕES", ""],
  ["Coluna", "Descrição"],
  ["placa *", "Placa do veículo (deve estar cadastrado)"],
  ["tipo", "Tipo: preventiva, corretiva"],
  ["prioridade", "Prioridade: baixa, media, alta, critica"],
  ["status", "Status: aberta, agendada, em_andamento, concluida, cancelada"],
  ["agendamento", "Data de agendamento (DD/MM/AAAA)"],
  ["odometro", "Quilometragem no momento da manutenção"],
  ["valor_total", "Custo total (peças + mão de obra)"],
  ["descricao", "Descrição detalhada do serviço"],

  ["", ""],
  ["DOCUMENTOS", ""],
  ["Coluna", "Descrição"],
  ["entidade *", "Tipo: veiculo ou motorista"],
  ["referencia *", "Placa (para veículo) ou CNH (para motorista)"],
  ["documento *", "Tipo: crlv, ipva, seguro, cnh, aso, treinamento, etc"],
  ["numero", "Número do documento"],
  ["emissao", "Data de emissão (DD/MM/AAAA)"],
  ["vencimento", "Data de vencimento (DD/MM/AAAA)"],
  ["url", "URL pública do arquivo digitalizado"],
];

estruturaDados.forEach((row, i) => {
  const xlsRow = completosSheet.addRow(row);
  xlsRow.height = 20;

  if (row[1] === "" && row[0] !== "" && !row[0].includes("Coluna")) {
    // Seções de tipo (VEÍCULOS, MOTORISTAS, etc)
    xlsRow.getCell(1).font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFF" },
    };
    xlsRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "0891B2" },
    };
    completosSheet.mergeCells(xlsRow.number, 1, xlsRow.number, 2);
  } else if (row[0] === "Coluna") {
    // Headers
    xlsRow.getCell(1).font = {
      bold: true,
      color: { argb: "FFFFFF" },
      size: 10,
    };
    xlsRow.getCell(2).font = {
      bold: true,
      color: { argb: "FFFFFF" },
      size: 10,
    };
    xlsRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "06B6D4" },
    };
    xlsRow.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "06B6D4" },
    };
  } else if (row[0] && row[0] !== "") {
    xlsRow.getCell(1).font = { bold: true, size: 9 };
    xlsRow.getCell(2).font = { size: 9 };
  }
});

// Colorir abas
wb.getWorksheet("instrucoes").properties.tabColor = { argb: "1E3A5F" };
wb.getWorksheet("veiculos").properties.tabColor = { argb: "166534" };
wb.getWorksheet("motoristas").properties.tabColor = { argb: "1D4ED8" };
wb.getWorksheet("abastecimentos").properties.tabColor = { argb: "B45309" };
wb.getWorksheet("manutencoes").properties.tabColor = { argb: "991B1B" };
wb.getWorksheet("documentos").properties.tabColor = { argb: "6D28D9" };
wb.getWorksheet("guia-relacionamentos").properties.tabColor = {
  argb: "059669",
};
wb.getWorksheet("checklist-validacao").properties.tabColor = { argb: "7C3AED" };
wb.getWorksheet("dados-completos").properties.tabColor = { argb: "0891B2" };

// Reordenar abas para melhor fluxo
const worksheetOrder = [
  "instrucoes",
  "guia-relacionamentos",
  "checklist-validacao",
  "dados-completos",
  "veiculos",
  "motoristas",
  "abastecimentos",
  "manutencoes",
  "documentos",
];
worksheetOrder.forEach((name, index) => {
  const ws = wb.getWorksheet(name);
  if (ws) {
    wb.worksheets.splice(wb.worksheets.indexOf(ws), 1);
    wb.worksheets.splice(index, 0, ws);
  }
});

await wb.xlsx.writeFile(OUTPUT);
console.log("✅ Template gerado em:", OUTPUT);

import ExcelJS from "exceljs"

type Registro = Record<string, any>
export type DadosRelatorio = { cortes: Registro[]; producao: Registro[]; itens: Registro[] }

function numero(valor: unknown): number {
  const convertido = Number(String(valor ?? 0).trim().replace(",", "."))
  return Number.isFinite(convertido) ? convertido : 0
}

function dataExcel(valor: unknown): Date | null {
  if (!valor) return null
  const data = valor instanceof Date
    ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`
    : String(valor).slice(0, 10)
  return new Date(`${data}T00:00:00.000Z`)
}

function minutos(inicio: string, fim: string) {
  if (!inicio || !fim) return 0
  const converter = (hora: string) => { const [h, m] = hora.split(":").map(Number); return h * 60 + m }
  const duracao = converter(fim) - converter(inicio)
  return Number.isFinite(duracao) ? (duracao < 0 ? duracao + 1440 : duracao) : 0
}

function folhas(registro: Registro) {
  return Math.max(0, numero(registro.folha_parou) - numero(registro.folha_inicio))
}

type Coluna = { titulo: string; largura: number; formato?: string }

export async function gerarRelatorioExcel(dados: DadosRelatorio, filtros: Record<string, string>, agora = new Date()) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Dimepor — Controle de Corte"
  workbook.created = agora
  const gerado = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
  const rotulos: Record<string, string> = { numero: "Corte", produto: "Produto", data_inicial: "De", data_final: "Até", status: "Status" }
  const descricao = Object.entries(filtros).filter(([, valor]) => valor).map(([chave, valor]) => `${rotulos[chave]}: ${valor}`).join(" · ") || "Todos os cortes"

  function aba(nome: string, colunas: Coluna[], linhas: ExcelJS.CellValue[][]) {
    const sheet = workbook.addWorksheet(nome, {
      views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })
    sheet.columns = colunas.map(coluna => ({ width: coluna.largura, style: { font: { name: "Calibri", size: 11 }, numFmt: coluna.formato ?? "General" } }))
    for (const linha of [1, 2, 3]) sheet.mergeCells(linha, 1, linha, colunas.length)
    sheet.getCell("A1").value = `Dimepor | ${nome}`
    sheet.getCell("A1").font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF142740" } }
    sheet.getRow(1).height = 32
    sheet.getCell("A2").value = `Gerado em ${gerado} (Brasília) · ${descricao}`
    sheet.getCell("A3").value = "O período filtra a última produção do corte. Produção e PIs incluem o histórico completo dos cortes encontrados."
    for (const linha of [2, 3]) {
      sheet.getCell(linha, 1).alignment = { wrapText: true, vertical: "middle" }
      sheet.getRow(linha).height = 30
    }
    const cabecalho = sheet.getRow(5)
    cabecalho.values = colunas.map(coluna => coluna.titulo)
    cabecalho.height = 34
    cabecalho.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142740" } }
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { wrapText: true, vertical: "middle" }
    })
    for (const valores of linhas) {
      // Strings permanecem texto: nomes iniciados por '=' nunca viram fórmulas.
      const row = sheet.addRow(valores)
      row.height = 32
      row.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { vertical: "middle", wrapText: true }
        if (row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F5FC" } }
      })
    }
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, sheet.rowCount), column: colunas.length } }
    sheet.pageSetup.printTitlesRow = "1:5"
  }

  const texto = (titulo: string, largura = 24): Coluna => ({ titulo, largura })
  const inteiro = (titulo: string): Coluna => ({ titulo, largura: 18, formato: "0" })
  const decimal = (titulo: string): Coluna => ({ titulo, largura: 19, formato: "#,##0.00" })
  const data = (titulo: string): Coluna => ({ titulo, largura: 20, formato: "dd/mm/yyyy" })
  const duracao = { titulo: "Tempo de produção", largura: 22, formato: "[h]:mm" }
  const porNumero = new Map(dados.cortes.map(corte => [Number(corte.numero), corte]))
  const totais = new Map(dados.cortes.map(corte => [Number(corte.numero), { folhas: 0, minutos: 0, pecas: 0, metragem: 0, sobra: 0, perda: 0, faltantes: 0 }]))
  for (const p of dados.producao) {
    const total = totais.get(Number(p.numero_corte))
    if (total) { total.folhas += folhas(p); total.minutos += minutos(p.hora_inicio, p.hora_fim) }
  }
  for (const item of dados.itens) {
    const total = totais.get(Number(item.numero_corte))
    if (!total) continue
    total.pecas += numero(item.quantidade_pecas)
    total.metragem += numero(item.metragem_usada)
    total.sobra += numero(item.sobra_metros)
    total.perda += numero(item.perda_metros)
    total.faltantes += numero(item.metros_faltantes)
  }
  aba("Cortes", [inteiro("Corte"), texto("Produto", 42), texto("Mesa", 14), data("Última produção"), texto("Status", 22),
    inteiro("Última folha"), inteiro("Folhas produzidas"), duracao, inteiro("Peças"), decimal("Metragem usada (m)"),
    decimal("Sobra (m)"), decimal("Perda (m)"), decimal("Metros faltantes (m)"), texto("PIs confirmados", 19)],
    dados.cortes.map(c => {
      const total = totais.get(Number(c.numero))!
      return [numero(c.numero), String(c.produto ?? ""), String(c.mesa ?? ""), dataExcel(c.data), String(c.status ?? "SEM LANÇAMENTO"),
        c.folha_parou == null ? null : numero(c.folha_parou), total.folhas, total.minutos / 1440, total.pecas,
        total.metragem, total.sobra, total.perda, total.faltantes, Number(c.itens_finalizados) === 1 ? "Sim" : "Não"]
    }))
  aba("Produção", [inteiro("Corte"), texto("Produto", 42), data("Data"), texto("Turno", 18), texto("Operador", 28),
    texto("Hora inicial", 16), texto("Hora final", 16), duracao, inteiro("Folha inicial"), inteiro("Folha final"), inteiro("Folhas produzidas"), texto("Status", 22)],
    dados.producao.map(p => [numero(p.numero_corte), String(porNumero.get(Number(p.numero_corte))?.produto ?? ""), dataExcel(p.data),
      String(p.turno ?? ""), String(p.operador ?? ""), String(p.hora_inicio ?? "").slice(0, 5), String(p.hora_fim ?? "").slice(0, 5),
      minutos(p.hora_inicio, p.hora_fim) / 1440, numero(p.folha_inicio), numero(p.folha_parou), folhas(p), String(p.status ?? "")]))
  aba("PIs", [inteiro("Corte"), texto("Produto", 42), texto("Modelo", 30), texto("Cor"), texto("Tecido", 30),
    decimal("Metragem usada (m)"), decimal("Sobra (m)"), decimal("Perda (m)"), decimal("Metros faltantes (m)"), inteiro("Quantidade de peças")],
    dados.itens.map(item => [numero(item.numero_corte), String(porNumero.get(Number(item.numero_corte))?.produto ?? ""),
      String(item.modelo ?? ""), String(item.cor ?? ""), String(item.tecido ?? ""), numero(item.metragem_usada),
      numero(item.sobra_metros), numero(item.perda_metros), numero(item.metros_faltantes), numero(item.quantidade_pecas)]))
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

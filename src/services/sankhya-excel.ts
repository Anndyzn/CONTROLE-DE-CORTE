import ExcelJS from "exceljs"
import type { carregarConferenciaSankhya } from "./sankhya-preparacao"
import { ErroRegra } from "./corte-bloqueado"

export async function gerarGuiaSankhyaExcel(dados: Awaited<ReturnType<typeof carregarConferenciaSankhya>>) {
  if (!dados.completa || !dados.total_ops || dados.itens.some(item => item.pendencias.length || !item.ordens.length)) {
    throw new ErroRegra(409, "Complete as correspondências de todos os itens antes de gerar o guia de lançamento.")
  }
  const livro = new ExcelJS.Workbook()
  livro.creator = "Controle de Corte — Dimepor"
  livro.created = new Date()
  const gerado = livro.created.toLocaleString("pt-BR", {timeZone: "America/Sao_Paulo"})
  function planilha(nome: string, cabecalhos: string[], larguras: number[]) {
    const aba = livro.addWorksheet(nome, {views: [{state: "frozen", ySplit: 5}],
      pageSetup: {orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5"}})
    larguras.forEach((largura, indice) => { aba.getColumn(indice + 1).width = largura })
    for (const [indice, texto] of [
      `Guia de lançamento manual — Corte ${dados.corte.numero} — ${dados.corte.produto}`,
      "Documento de apoio. Nenhuma OP foi criada por esta exportação. Não é um arquivo de importação do Sankhya.",
      `Gerado em ${gerado} (Brasília). Confira os cadastros e as OPs já existentes no ERP antes de lançar.`
    ].entries()) {
      aba.mergeCells(indice + 1, 1, indice + 1, cabecalhos.length)
      const celula = aba.getCell(indice + 1, 1)
      celula.value = texto
      celula.alignment = {wrapText: true, vertical: "middle"}
      celula.font = {name: "Calibri", size: indice ? 11 : 15, bold: indice === 0, color: {argb: "FF142640"}}
      aba.getRow(indice + 1).height = indice ? 32 : 38
    }
    const topo = aba.getRow(5)
    topo.values = cabecalhos
    topo.height = 30
    topo.eachCell(c => {
      c.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FF142640"}}
      c.font = {bold: true, color: {argb: "FFFFFFFF"}}
      c.alignment = {wrapText: true, vertical: "middle"}
    })
    return aba
  }
  const ordens = planilha("OPs para lançar", ["Corte", "Item de origem", "Modelo no controle", "Cor no controle", "Código produto Sankhya", "Produto no Sankhya", "Controle (cor) Sankhya", "Quantidade de peças", "Nº OP lançada (preencher)"], [12,16,30,22,22,48,26,22,26])
  for (const item of dados.itens) for (const ordem of item.ordens) {
    ordens.addRow([Number(dados.corte.numero), Number(item.id), item.modelo, item.cor, ordem.codigo_produto,
      ordem.produto, ordem.controle || "Sem controle", ordem.quantidade, null])
  }
  const itens = planilha("Consumo por item", ["Corte", "Item de origem", "Modelo", "Cor", "Tecido", "Metragem total (m)", "Quantidade no controle"], [12,16,34,24,26,24,26])
  for (const item of dados.itens) itens.addRow([Number(dados.corte.numero), Number(item.id), item.modelo, item.cor,
    item.tecido, Number(item.metragem_usada), Number(item.quantidade_pecas)])
  itens.getColumn(6).numFmt = "#,##0.00"
  const notas = livro.addWorksheet("Como usar")
  notas.getColumn(1).width = 115
  for (const texto of ["Guia para lançamento manual no Sankhya",
    "1. Confira produto, código, controle de cor e quantidade na aba OPs para lançar. Cada linha representa uma OP prevista.",
    "Quando a coluna Controle indicar Sem controle, deixe esse campo vazio no ERP. A cor do PI original permanece registrada no guia.",
    "2. Verifique se a OP já foi lançada manualmente no ERP. Exportar novamente não registra nem impede duplicações no Sankhya.",
    "3. Crie as OPs pelo procedimento habitual e anote seus números na última coluna, se desejar.",
    "4. O processo produtivo, a planta, a unidade e os demais campos devem ser conferidos no ERP. Este guia não define esses valores.",
    "5. Na aba Consumo por item, a metragem aparece uma única vez por item original. Ela não foi dividida nem repetida entre blazer, vestido ou outros produtos.",
    "6. Use a composição do Sankhya para o consumo previsto e ajuste o consumo real no apontamento. Confirme e finalize a operação no ERP.",
    "7. Os códigos e controles são cadastrados manualmente e não foram validados por API. OPs anotadas no Excel não retornam automaticamente ao controle.",
    "8. O arquivo retrata os dados salvos no momento da geração. Gere outro guia após corrigir os itens ou suas correspondências."
  ]) {
    const linha = notas.addRow([texto]); linha.height = 45; linha.alignment = {wrapText: true, vertical: "middle"}
  }
  notas.getRow(1).font = {bold: true, size: 16}
  for (const aba of [ordens, itens]) {
    aba.autoFilter = {from: {row: 5, column: 1}, to: {row: aba.rowCount, column: aba.columnCount}}
    for (let i = 6; i <= aba.rowCount; i++) {
      const linha = aba.getRow(i)
      linha.height = 38
      linha.eachCell(c => {
        c.alignment = {wrapText: true, vertical: "middle"}
        if (i % 2 === 0) c.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FFF1F5F9"}}
      })
    }
  }
  return livro.xlsx.writeBuffer()
}

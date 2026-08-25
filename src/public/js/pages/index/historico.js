import {
  formatarData,
  calcularDuracao
} from "../../utils/formatters.js"

import {
  apiGet
} from "../../core/api.js"

export async function carregarHistorico(numeroCorte) {
  try {
    const historico = await apiGet(`/producao/${numeroCorte}`)

    const tabelaHistorico =
      document.getElementById("historicoCorte")

    tabelaHistorico.innerHTML = ""

    historico.forEach((item) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${formatarData(item.data)}</td>
        <td>${item.turno}</td>
        <td>${item.operador}</td>
        <td>${item.hora_inicio ?? "-"}</td>
        <td>${item.hora_fim ?? "-"}</td>
        <td>${calcularDuracao(item.hora_inicio, item.hora_fim)}</td>
        <td>${item.folha_inicio}</td>
        <td>${item.folha_parou}</td>
        <td>${item.status}</td>
      `

      tabelaHistorico.appendChild(linha)
    })
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro)
  }
}
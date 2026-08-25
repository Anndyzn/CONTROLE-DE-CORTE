import { apiGet } from "../../core/api.js"

import {
  maiusculo,
  formatarData
} from "../../utils/formatters.js"

import {
  carregarHistoricoConsulta,
  carregarItensConsulta
} from "./historico.js"

import {
  carregarDashboardCorte
} from "./dashboard.js"


let corteConsultaAtual = null


// ========================================
// CORTE ATUALMENTE SELECIONADO
// ========================================

export function obterCorteConsultaAtual() {
  return corteConsultaAtual
}


// ========================================
// CARREGAR RESULTADOS DA CONSULTA
// ========================================

export async function carregarResultadosConsulta() {
  const numero =
    document.getElementById("filtroNumero").value

  const produto =
    document
      .getElementById("filtroProduto")
      .value
      .trim()

  const dataInicial =
    document.getElementById("filtroDataInicial").value

  const dataFinal =
    document.getElementById("filtroDataFinal").value

  const status =
    document.getElementById("filtroStatus").value


  const params =
    new URLSearchParams()


  if (numero) {
    params.append(
      "numero",
      numero
    )
  }

  if (produto) {
    params.append(
      "produto",
      produto
    )
  }

  if (dataInicial) {
    params.append(
      "data_inicial",
      dataInicial
    )
  }

  if (dataFinal) {
    params.append(
      "data_final",
      dataFinal
    )
  }

  if (status) {
    params.append(
      "status",
      status
    )
  }


  try {
    const resultados =
      await apiGet(
        `/consultar-cortes?${params.toString()}`
      )


    document.getElementById(
      "totalConsulta"
    ).textContent =
      resultados.length


    const tabela =
      document.getElementById(
        "resultadoFiltros"
      )


    tabela.innerHTML = ""


    // Quando uma nova consulta é feita,
    // limpamos o corte anteriormente selecionado.
    corteConsultaAtual = null


    document.getElementById(
      "dashboardCorte"
    ).style.display = "none"


    document.getElementById(
      "historicoConsulta"
    ).innerHTML = ""


    document.getElementById(
      "itensConsulta"
    ).innerHTML = ""


    // ========================================
    // NENHUM RESULTADO
    // ========================================

    if (resultados.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Nenhum corte encontrado
          </td>
        </tr>
      `

      return
    }


    // ========================================
    // MONTAR TABELA
    // ========================================

    resultados.forEach((item) => {

      const statusClasse =
        item.status === "FINALIZADO"
          ? "status-badge status-finalizado"
          : item.status === "EM PRODUÇÃO"
          ? "status-badge status-em-producao"
          : "status-badge status-default"


      const linha =
        document.createElement("tr")


      linha.innerHTML = `
        <td>
          ${item.numero}
        </td>

        <td>
          ${maiusculo(item.produto)}
        </td>

        <td>
          ${maiusculo(item.mesa)}
        </td>

        <td>
          ${formatarData(item.data)}
        </td>

        <td>
          ${item.folha_parou ?? "-"}
        </td>

        <td>
          <span class="${statusClasse}">
            ${item.status ?? "-"}
          </span>
        </td>
      `


      linha.style.cursor = "pointer"


      // ========================================
      // CLICAR EM UM CORTE
      // ========================================

      linha.addEventListener(
        "click",
        async () => {

          corteConsultaAtual =
            item.numero


          await carregarHistoricoConsulta(
            item.numero
          )


          await carregarItensConsulta(
            item.numero
          )


          await carregarDashboardCorte(
            item.numero
          )
        }
      )


      tabela.appendChild(linha)
    })

  } catch (erro) {
    console.error(
      "Erro ao consultar cortes:",
      erro
    )
  }
}


// ========================================
// INICIALIZAR FILTROS
// ========================================

export function inicializarFiltros() {
  const botaoBuscarFiltros =
    document.getElementById(
      "buscarFiltros"
    )


  botaoBuscarFiltros.addEventListener(
    "click",
    carregarResultadosConsulta
  )
}
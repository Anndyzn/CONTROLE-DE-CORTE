import {
  apiGet
} from "../../core/api.js"

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
// LIMPAR DETALHES DO CORTE
// ========================================

function limparDetalhesCorte() {
  corteConsultaAtual = null

  const detalheCorte =
    document.getElementById(
      "detalheCorte"
    )

  const dashboardCorte =
    document.getElementById(
      "dashboardCorte"
    )

  const historicoConsulta =
    document.getElementById(
      "historicoConsulta"
    )

  const itensConsulta =
    document.getElementById(
      "itensConsulta"
    )


  if (detalheCorte) {
    detalheCorte.style.display =
      "none"
  }


  if (dashboardCorte) {
    dashboardCorte.style.display =
      "none"
  }


  if (historicoConsulta) {
    historicoConsulta.innerHTML = ""
  }


  if (itensConsulta) {
    itensConsulta.innerHTML = ""
  }
}


// ========================================
// DESTACAR CORTE SELECIONADO
// ========================================

function destacarLinhaSelecionada(
  linhaSelecionada
) {
  document
    .querySelectorAll(
      "#resultadoFiltros tr"
    )
    .forEach((linha) => {
      linha.classList.remove(
        "consulta-linha-selecionada"
      )
    })


  linhaSelecionada.classList.add(
    "consulta-linha-selecionada"
  )
}


// ========================================
// ABRIR DETALHES DO CORTE
// ========================================

async function abrirDetalhesCorte(
  item,
  linha
) {
  try {

    // Guarda o número do corte atual
    corteConsultaAtual =
      item.numero


    // Destaca visualmente a linha
    destacarLinhaSelecionada(
      linha
    )


    // Carrega histórico
    await carregarHistoricoConsulta(
      item.numero
    )


    // Carrega itens
    await carregarItensConsulta(
      item.numero
    )


    // Carrega dashboard
    await carregarDashboardCorte(
      item.numero
    )


    // ========================================
    // MOSTRAR DETALHES
    // ========================================

    const detalheCorte =
      document.getElementById(
        "detalheCorte"
      )


    if (detalheCorte) {
      detalheCorte.style.display =
        "grid"
    }


    // ========================================
    // SCROLL AUTOMÁTICO
    // ========================================

    setTimeout(() => {

      detalheCorte
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })

    }, 100)

  } catch (erro) {
    console.error(
      "Erro ao abrir detalhes do corte:",
      erro
    )
  }
}


// ========================================
// CARREGAR RESULTADOS DA CONSULTA
// ========================================

export async function carregarResultadosConsulta() {

  const campoNumero =
    document.getElementById(
      "filtroNumero"
    )

  const campoProduto =
    document.getElementById(
      "filtroProduto"
    )

  const campoDataInicial =
    document.getElementById(
      "filtroDataInicial"
    )

  const campoDataFinal =
    document.getElementById(
      "filtroDataFinal"
    )

  const campoStatus =
    document.getElementById(
      "filtroStatus"
    )


  const numero =
    campoNumero?.value ?? ""

  const produto =
    campoProduto?.value
      ?.trim() ?? ""

  const dataInicial =
    campoDataInicial?.value ?? ""

  const dataFinal =
    campoDataFinal?.value ?? ""

  const status =
    campoStatus?.value ?? ""


  // ========================================
  // MONTAR PARÂMETROS
  // ========================================

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

    // ========================================
    // CONSULTAR API
    // ========================================

    const resultados =
      await apiGet(
        `/consultar-cortes?${params.toString()}`
      )


    // ========================================
    // TOTAL ENCONTRADO
    // ========================================

    const totalConsulta =
      document.getElementById(
        "totalConsulta"
      )


    if (totalConsulta) {
      totalConsulta.textContent =
        resultados.length
    }


    // ========================================
    // TABELA
    // ========================================

    const tabela =
      document.getElementById(
        "resultadoFiltros"
      )


    if (!tabela) {
      console.error(
        "Tabela resultadoFiltros não encontrada."
      )

      return
    }


    tabela.innerHTML = ""


    // Nova pesquisa:
    // remove detalhes do corte anterior.
    limparDetalhesCorte()


    // ========================================
    // NENHUM RESULTADO
    // ========================================

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
  // LIMITAR RESULTADOS EXIBIDOS
  // ========================================

  const resultadosExibidos =
    produto
      ? resultados
      : resultados.slice(0, 20)


  // ========================================
  // MONTAR RESULTADOS
  // ========================================

  resultadosExibidos.forEach((item) => {

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
        ${maiusculo(
          item.produto ?? "-"
        )}
      </td>

      <td>
        ${maiusculo(
          item.mesa ?? "-"
        )}
      </td>

      <td>
        ${
          item.data
            ? formatarData(item.data)
            : "-"
        }
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


    linha.style.cursor =
      "pointer"


    linha.addEventListener(
      "click",
      async () => {

        await abrirDetalhesCorte(
          item,
          linha
        )
      }
    )


    tabela.appendChild(
      linha
    )
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


  if (!botaoBuscarFiltros) {
    console.error(
      "Botão buscarFiltros não encontrado."
    )

    return
  }


  botaoBuscarFiltros.addEventListener(
    "click",
    carregarResultadosConsulta
  )
}
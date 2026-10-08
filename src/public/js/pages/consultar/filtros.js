import {
  apiGet
} from "../../core/api.js"

import {
  definirCarregamento
} from "../../core/ui.js"

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


const QUANTIDADE_POR_PAGINA =
  20

let corteConsultaAtual =
  null

let resultadosConsulta =
  []

let quantidadeResultadosVisiveis =
  QUANTIDADE_POR_PAGINA

let consultaComProduto =
  false


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
  corteConsultaAtual =
    null

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
    historicoConsulta.innerHTML =
      ""
  }


  if (itensConsulta) {
    itensConsulta.innerHTML =
      ""
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
    corteConsultaAtual =
      item.numero


    destacarLinhaSelecionada(
      linha
    )


    await carregarHistoricoConsulta(
      item.numero
    )


    await carregarItensConsulta(
      item.numero
    )


    await carregarDashboardCorte(
      item.numero
    )


    const detalheCorte =
      document.getElementById(
        "detalheCorte"
      )


    if (detalheCorte) {
      detalheCorte.style.display =
        "grid"
    }


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
// RESULTADOS DA CONSULTA
// ========================================

function obterClasseStatus(status) {
  return status === "FINALIZADO"
    ? "status-badge status-finalizado"
    : status === "EM PRODUÇÃO"
    ? "status-badge status-em-producao"
    : "status-badge status-default"
}


function criarLinhaResultado(item) {
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
      <span class="${obterClasseStatus(item.status)}">
        ${item.status ?? "-"}
      </span>
    </td>
  `


  linha.addEventListener(
    "click",
    async () => {
      await abrirDetalhesCorte(
        item,
        linha
      )
    }
  )


  if (
    String(item.numero) ===
    String(corteConsultaAtual)
  ) {
    linha.classList.add(
      "consulta-linha-selecionada"
    )
  }


  return linha
}


function atualizarControleCarregarMais() {
  const area =
    document.getElementById(
      "consultaCarregarMais"
    )

  const botao =
    document.getElementById(
      "carregarMaisCortes"
    )

  const resumo =
    document.getElementById(
      "consultaExibidos"
    )


  if (!area || !botao || !resumo) {
    return
  }


  const total =
    resultadosConsulta.length

  const exibidos =
    consultaComProduto
      ? total
      : Math.min(
          quantidadeResultadosVisiveis,
          total
        )

  const restantes =
    total - exibidos


  resumo.textContent =
    `Mostrando ${exibidos} de ${total} cortes`


  if (
    consultaComProduto ||
    restantes <= 0
  ) {
    area.style.display =
      "none"

    botao.disabled =
      true

    return
  }


  area.style.display =
    "flex"

  botao.disabled =
    false

  botao.textContent =
    restantes > QUANTIDADE_POR_PAGINA
      ? `Carregar mais ${QUANTIDADE_POR_PAGINA}`
      : `Carregar mais ${restantes}`
}


function renderizarResultadosConsulta() {
  const tabela =
    document.getElementById(
      "resultadoFiltros"
    )


  if (!tabela) {
    console.error(
      "Tabela resultadoFiltros nao encontrada."
    )

    return
  }


  tabela.innerHTML =
    ""


  if (resultadosConsulta.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="6">
          Nenhum corte encontrado
        </td>
      </tr>
    `

    atualizarControleCarregarMais()

    return
  }


  const resultadosExibidos =
    consultaComProduto
      ? resultadosConsulta
      : resultadosConsulta.slice(
          0,
          quantidadeResultadosVisiveis
        )


  resultadosExibidos.forEach((item) => {
    tabela.appendChild(
      criarLinhaResultado(item)
    )
  })


  atualizarControleCarregarMais()
}


function carregarMaisResultadosConsulta() {
  quantidadeResultadosVisiveis +=
    QUANTIDADE_POR_PAGINA

  renderizarResultadosConsulta()
}


// ========================================
// CARREGAR RESULTADOS DA CONSULTA
// ========================================

export async function carregarResultadosConsulta() {
  const botaoBuscar =
    document.getElementById(
      "buscarFiltros"
    )

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
    definirCarregamento(
      botaoBuscar,
      true,
      "Buscar"
    )

    const resultados =
      await apiGet(
        `/consultar-cortes?${params.toString()}`
      )

    const totalConsulta =
      document.getElementById(
        "totalConsulta"
      )


    if (totalConsulta) {
      totalConsulta.textContent =
        resultados.length
    }


    resultadosConsulta =
      resultados

    consultaComProduto =
      Boolean(produto)

    quantidadeResultadosVisiveis =
      consultaComProduto
        ? resultadosConsulta.length
        : QUANTIDADE_POR_PAGINA


    limparDetalhesCorte()

    renderizarResultadosConsulta()

  } catch (erro) {
    console.error(
      "Erro ao consultar cortes:",
      erro
    )

  } finally {
    definirCarregamento(
      botaoBuscar,
      false,
      "Buscar"
    )
  }
}


function limparFiltrosConsulta() {
  const campos =
    [
      "filtroNumero",
      "filtroProduto",
      "filtroDataInicial",
      "filtroDataFinal",
      "filtroStatus"
    ]


  campos.forEach((id) => {
    const campo =
      document.getElementById(id)

    if (campo) {
      campo.value =
        ""
    }
  })


  document
    .getElementById("filtroNumero")
    ?.focus()

  carregarResultadosConsulta()
}


function configurarBuscaComEnter() {
  const campos =
    [
      "filtroNumero",
      "filtroProduto",
      "filtroDataInicial",
      "filtroDataFinal",
      "filtroStatus"
    ]


  campos.forEach((id) => {
    const campo =
      document.getElementById(id)

    campo?.addEventListener(
      "keydown",
      async (evento) => {
        if (evento.key !== "Enter") {
          return
        }


        evento.preventDefault()

        await carregarResultadosConsulta()
      }
    )
  })
}


// ========================================
// INICIALIZAR FILTROS
// ========================================

export function inicializarFiltros() {
  const botaoBuscarFiltros =
    document.getElementById(
      "buscarFiltros"
    )

  const botaoCarregarMais =
    document.getElementById(
      "carregarMaisCortes"
    )

  const botaoLimparFiltros =
    document.getElementById(
      "limparFiltros"
    )


  if (!botaoBuscarFiltros) {
    console.error(
      "Botao buscarFiltros nao encontrado."
    )

    return
  }


  botaoBuscarFiltros.addEventListener(
    "click",
    carregarResultadosConsulta
  )

  botaoLimparFiltros
    ?.addEventListener(
      "click",
      limparFiltrosConsulta
    )


  botaoCarregarMais
    ?.addEventListener(
      "click",
      carregarMaisResultadosConsulta
    )


  configurarBuscaComEnter()

  document
    .getElementById("filtroNumero")
    ?.focus()
}

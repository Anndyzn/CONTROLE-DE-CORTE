import {
  apiGet
} from "../../core/api.js"

import {
  definirCarregamento,
  mostrarToast
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
import { inicializarExportacao } from "./exportar.js"


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

let parametrosConsultaAplicada = null
let sequenciaConsulta = 0
let sequenciaDetalhes = 0, parametrosUltimaConsulta = null, buscaManualPendente = false
let atualizarExportacao = () => {}
const camposMemoria=["filtroNumero","filtroProduto","filtroDataInicial","filtroDataFinal","filtroStatus"]
let restauracaoConsulta=null
let posicaoLista=null
function guardarConsulta() {
  try {
    sessionStorage.setItem("consulta-cortes-v1",JSON.stringify({
      campos:Object.fromEntries(camposMemoria.map(id=>[id,document.getElementById(id)?.value??""])),
      exibidos:quantidadeResultadosVisiveis,scroll:posicaoLista??window.scrollY
    }))
  } catch { /* A consulta continua funcionando se o navegador bloquear o armazenamento. */ }
}


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
  sequenciaDetalhes++
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
  posicaoLista=window.scrollY
  guardarConsulta()
  try {
    if (String(corteConsultaAtual) !== String(item.numero)) limparDetalhesCorte()
    corteConsultaAtual =
      item.numero
    const consulta = ++sequenciaDetalhes
    const aindaAtual = () => consulta === sequenciaDetalhes && String(corteConsultaAtual) === String(item.numero)


    destacarLinhaSelecionada(
      linha
    )


    await Promise.all([
      carregarHistoricoConsulta(item.numero, {aindaAtual}),
      carregarItensConsulta(item.numero, {aindaAtual}),
      carregarDashboardCorte(item.numero, {aindaAtual})
    ])
    if (!aindaAtual()) return


    const detalheCorte =
      document.getElementById(
        "detalheCorte"
      )


    if (detalheCorte) {
      detalheCorte.style.display =
        "grid"
    }


    setTimeout(() => {
      if (!aindaAtual()) return
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

export async function atualizarDetalhesConsulta() {
  const numero = corteConsultaAtual, consulta = sequenciaDetalhes
  if (!numero) return
  const aindaAtual = () => consulta === sequenciaDetalhes && String(corteConsultaAtual) === String(numero)
  await Promise.all([
    carregarHistoricoConsulta(numero, {aindaAtual}),
    carregarItensConsulta(numero, {aindaAtual}),
    carregarDashboardCorte(numero, {aindaAtual})
  ])
}

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

    <td></td>

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

  linha.children[1].textContent = maiusculo(item.produto ?? "-")

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
        <td colspan="6" class="estado-vazio">
          Nenhum corte encontrado. Ajuste os filtros ou use Limpar para ampliar a busca.
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
  guardarConsulta()
}


// ========================================
// CARREGAR RESULTADOS DA CONSULTA
// ========================================

export async function carregarResultadosConsulta({silencioso = false} = {}) {
  if (silencioso && (buscaManualPendente || parametrosUltimaConsulta === null)) return
  if (!silencioso) buscaManualPendente = true
  if (!silencioso) posicaoLista=null
  const sequencia = ++sequenciaConsulta
  const estado = document.getElementById('estadoConsulta')
  const tabelaResultados = document.getElementById('resultadoFiltros')
  tabelaResultados?.setAttribute('aria-busy', 'true')
  if (estado) { estado.hidden = false; estado.textContent = resultadosConsulta.length ? 'Atualizando resultados…' : 'Buscando cortes…' }
  if (!silencioso) { parametrosConsultaAplicada = null; atualizarExportacao() }
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


  let params =
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


  if (silencioso) params = new URLSearchParams(parametrosUltimaConsulta)
  try {
    if (!silencioso) definirCarregamento(
      botaoBuscar,
      true,
      "Buscar"
    )

    const tabela =
      document.getElementById(
        "resultadoFiltros"
      )

    if (tabela && !resultadosConsulta.length) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Carregando resultados...
          </td>
        </tr>
      `
    }

    const resultados =
      await apiGet(
        `/consultar-cortes?${params.toString()}`
      )

    if (sequencia !== sequenciaConsulta) return
    parametrosUltimaConsulta = params.toString()
    parametrosConsultaAplicada = resultados.length ? params.toString() : null
    atualizarExportacao()

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

    consultaComProduto = Boolean(params.get('produto'))

    if (consultaComProduto) quantidadeResultadosVisiveis = resultadosConsulta.length
    else if (!silencioso) quantidadeResultadosVisiveis = QUANTIDADE_POR_PAGINA


    if (!silencioso) limparDetalhesCorte()

    renderizarResultadosConsulta()
    if (estado) { estado.textContent = ''; estado.hidden = true }
    if (restauracaoConsulta && !silencioso) {
      quantidadeResultadosVisiveis=Math.max(QUANTIDADE_POR_PAGINA,Math.min(Number(restauracaoConsulta.exibidos)||20,resultadosConsulta.length))
      renderizarResultadosConsulta()
      const posicao=Number(restauracaoConsulta.scroll)||0
      requestAnimationFrame(()=>window.scrollTo(0,posicao))
      restauracaoConsulta=null
    }
    if (!silencioso) guardarConsulta()

  } catch (erro) {
    if (sequencia !== sequenciaConsulta) return
    if (!silencioso) parametrosConsultaAplicada = null
    atualizarExportacao()
    console.error(
      "Erro ao consultar cortes:",
      erro
    )

    const tabela =
      document.getElementById(
        "resultadoFiltros"
      )

    if (tabela && !resultadosConsulta.length) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Não foi possível carregar os cortes.
          </td>
        </tr>
      `
    }

    const totalConsulta =
      document.getElementById(
        "totalConsulta"
      )

    if (totalConsulta && !resultadosConsulta.length) {
      totalConsulta.textContent =
        "0"
    }

    if (estado) { estado.hidden = false; estado.textContent = resultadosConsulta.length ? 'Não foi possível atualizar. A lista exibida é da busca anterior. Tente novamente.' : 'Não foi possível buscar os cortes. Tente novamente.' }

    if (!resultadosConsulta.length) document
      .getElementById(
        "consultaCarregarMais"
      )
      ?.style
      .setProperty(
        "display",
        "none"
      )

    mostrarToast(
      "Não foi possível carregar os resultados da consulta.",
      "erro",
      "Erro na consulta"
    )

  } finally {
    if (sequencia === sequenciaConsulta) tabelaResultados?.setAttribute('aria-busy', 'false')
    if (sequencia === sequenciaConsulta && !silencioso) buscaManualPendente = false
    if (sequencia === sequenciaConsulta && !silencioso) definirCarregamento(
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
  try {
    const salvo=JSON.parse(sessionStorage.getItem("consulta-cortes-v1"))
    if(salvo?.campos){
      for(const id of camposMemoria)if(typeof salvo.campos[id]==="string")document.getElementById(id).value=salvo.campos[id]
      restauracaoConsulta=salvo
    }
  }catch { /* Ignorar memória antiga ou indisponível. */ }
  window.addEventListener("pagehide",guardarConsulta)
  document.getElementById("voltarResultadosConsulta")?.addEventListener("click",()=>{
    limparDetalhesCorte()
    window.scrollTo({top:posicaoLista??0,behavior:"smooth"})
    posicaoLista=null
  })
  atualizarExportacao = inicializarExportacao(() => parametrosConsultaAplicada)
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

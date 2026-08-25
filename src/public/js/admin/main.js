import {
  apiGet,
  apiPost
} from "../core/api.js"

import {
  mostrarToast
} from "../core/ui.js"

import {
  formatarData,
  formatarNumero,
  formatarQuantidade,
  maiusculo
} from "../utils/formatters.js"


const botaoBuscarCorteAdmin =
  document.getElementById("buscarCorteAdmin")

const botaoReabrirItensCorte =
  document.getElementById("reabrirItensCorte")


// ========================================
// CARREGAR HISTÓRICO
// ========================================

async function carregarHistoricoAdmin(numeroCorte) {
  try {
    const historico =
      await apiGet(`/producao/${numeroCorte}`)

    const tabela =
      document.getElementById("historicoAdmin")

    tabela.innerHTML = ""

    if (historico.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="8">
            Nenhum histórico encontrado
          </td>
        </tr>
      `

      return
    }

    historico.forEach((item) => {
      const linha =
        document.createElement("tr")

      linha.innerHTML = `
        <td>${formatarData(item.data)}</td>
        <td>${maiusculo(item.turno)}</td>
        <td>${maiusculo(item.operador)}</td>

        <td>
          ${
            item.hora_inicio
              ? String(item.hora_inicio).substring(0, 5)
              : "-"
          }
        </td>

        <td>
          ${
            item.hora_fim
              ? String(item.hora_fim).substring(0, 5)
              : "-"
          }
        </td>

        <td>
          ${formatarQuantidade(item.folha_inicio)}
        </td>

        <td>
          ${formatarQuantidade(item.folha_parou)}
        </td>

        <td>
          ${maiusculo(item.status)}
        </td>
      `

      tabela.appendChild(linha)
    })

  } catch (erro) {
    console.error(
      "Erro ao carregar histórico:",
      erro
    )

    mostrarToast(
      "Não foi possível carregar o histórico do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// CARREGAR ITENS
// ========================================

async function carregarItensAdmin(numeroCorte) {
  try {
    const itens =
      await apiGet(`/itens-corte/${numeroCorte}`)

    const tabela =
      document.getElementById("itensAdmin")

    tabela.innerHTML = ""

    if (itens.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="7">
            Nenhum item encontrado
          </td>
        </tr>
      `

      return
    }

    itens.forEach((item) => {
      const linha =
        document.createElement("tr")

      linha.innerHTML = `
        <td>${maiusculo(item.modelo)}</td>
        <td>${maiusculo(item.cor)}</td>
        <td>${maiusculo(item.tecido)}</td>

        <td>
          ${formatarNumero(item.metragem_usada)}
        </td>

        <td>
          ${formatarNumero(item.sobra_metros)}
        </td>

        <td>
          ${formatarNumero(item.perda_metros)}
        </td>

        <td>
          ${formatarQuantidade(item.quantidade_pecas)}
        </td>
      `

      tabela.appendChild(linha)
    })

  } catch (erro) {
    console.error(
      "Erro ao carregar itens:",
      erro
    )

    mostrarToast(
      "Não foi possível carregar os itens do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// BUSCAR CORTE
// ========================================

async function buscarCorteAdmin() {
  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    ).value

  if (!numeroCorte) {
    mostrarToast(
      "Digite o número do corte.",
      "atencao",
      "Número obrigatório"
    )

    return
  }

  await carregarHistoricoAdmin(numeroCorte)

  await carregarItensAdmin(numeroCorte)
}


// ========================================
// REABRIR ITENS
// ========================================

async function reabrirItensCorte() {
  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    ).value

  if (!numeroCorte) {
    mostrarToast(
      "Digite o número do corte.",
      "atencao",
      "Número obrigatório"
    )

    return
  }

  const confirmar = confirm(
    "Tem certeza que deseja reabrir os itens deste corte?\n\n" +
    "Depois disso será possível adicionar novos itens."
  )

  if (!confirmar) {
    return
  }

  try {
    await apiPost(
      `/cortes/${numeroCorte}/reabrir-itens`
    )

    mostrarToast(
      `Os itens do corte ${numeroCorte} foram reabertos.`,
      "sucesso",
      "Itens reabertos",
      5000
    )

    await carregarItensAdmin(numeroCorte)

  } catch (erro) {
    console.error(
      "Erro ao reabrir itens:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível reabrir os itens do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// INICIALIZAÇÃO
// ========================================

function iniciarAdmin() {
  console.log(
    "🚀 Inicializando painel administrativo"
  )

  botaoBuscarCorteAdmin.addEventListener(
    "click",
    buscarCorteAdmin
  )

  botaoReabrirItensCorte.addEventListener(
    "click",
    reabrirItensCorte
  )

  console.log(
    "✅ Painel administrativo inicializado"
  )
}


document.addEventListener(
  "DOMContentLoaded",
  iniciarAdmin
)
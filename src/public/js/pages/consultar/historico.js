import { apiGet } from "../../core/api.js"

import {
  maiusculo,
  formatarData,
  formatarNumero,
  formatarQuantidade,
  calcularDuracao
} from "../../utils/formatters.js"


// ========================================
// HISTÓRICO DE PRODUÇÃO
// ========================================

export async function carregarHistoricoConsulta(numeroCorte) {
  try {
    const historico =
      await apiGet(`/producao/${numeroCorte}`)

    const tabela =
      document.getElementById("historicoConsulta")

    tabela.innerHTML = ""

    if (historico.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="9">
            Nenhum histórico encontrado
          </td>
        </tr>
      `

      return []
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
          ${calcularDuracao(
            item.hora_inicio,
            item.hora_fim
          )}
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

    return historico

  } catch (erro) {
    console.error(
      "Erro ao carregar histórico:",
      erro
    )

    return []
  }
}


// ========================================
// ITENS / PIs DO CORTE
// ========================================

export async function carregarItensConsulta(numeroCorte) {
  try {
    const itens =
      await apiGet(`/itens-corte/${numeroCorte}`)

    const tabela =
      document.getElementById("itensConsulta")

    tabela.innerHTML = ""

    if (itens.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="8">
            Nenhum item encontrado
          </td>
        </tr>
      `

      return []
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
          ${formatarNumero(item.metros_faltantes)}
        </td>

        <td>
          ${formatarQuantidade(item.quantidade_pecas)}
        </td>
      `

      tabela.appendChild(linha)
    })

    return itens

  } catch (erro) {
    console.error(
      "Erro ao carregar itens:",
      erro
    )

    return []
  }
}
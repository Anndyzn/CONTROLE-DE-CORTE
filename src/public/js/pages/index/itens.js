import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete
} from "../../core/api.js"

import {
  mostrarToast
} from "../../core/ui.js"

import {
  maiusculo,
  formatarNumero,
  formatarQuantidade
} from "../../utils/formatters.js"

import {
  limparCamposItens,
  desabilitarItens
} from "./ui-corte.js"


// ========================================
// CARREGAR ITENS DO CORTE
// ========================================

export async function carregarItensCorte(numeroCorte) {
  try {
    const finalizacao =
      await apiGet(`/cortes/${numeroCorte}/finalizacao-itens`)

    const itensFinalizados =
      finalizacao.itens_finalizados === 1

    const itens =
      await apiGet(`/itens-corte/${numeroCorte}`)

    const tabela =
      document.getElementById("listaItensCorte")

    tabela.innerHTML = ""

    if (itens.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="9">
            Nenhum item encontrado
          </td>
        </tr>
      `

      return 0
    }

    itens.forEach((item) => {
      const linha = document.createElement("tr")

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

        <td>
          ${
            itensFinalizados
              ? `
                <span class="status-badge status-default">
                  Bloqueado
                </span>
              `
              : `
                <div class="acoes-item">
                  <button
                    type="button"
                    class="btn-editar-item"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    class="btn-excluir-item"
                  >
                    Excluir
                  </button>
                </div>
              `
          }
        </td>
      `

      if (!itensFinalizados) {
        configurarEdicao(linha, item)

        configurarExclusao(
          linha,
          item,
          numeroCorte
        )
      }

      tabela.appendChild(linha)
    })

    return itens.length

  } catch (erro) {
    console.error(
      "Erro ao carregar itens do corte:",
      erro
    )

    return 0
  }
}


// ========================================
// PREPARAR ITEM PARA EDIÇÃO
// ========================================

function configurarEdicao(linha, item) {
  const botaoEditar =
    linha.querySelector(".btn-editar-item")

  botaoEditar.addEventListener("click", () => {
    document.getElementById("itemEditandoId").value =
      item.id

    document.getElementById("modeloItem").value =
      item.modelo

    document.getElementById("corItem").value =
      item.cor

    document.getElementById("tecidoItem").value =
      item.tecido

    document.getElementById("metragemItem").value =
      item.metragem_usada

    document.getElementById("sobraItem").value =
      item.sobra_metros

    document.getElementById("perdaItem").value =
      item.perda_metros

    document.getElementById("metrosFaltantesItem").value =
      item.metros_faltantes ?? 0

    document.getElementById("quantidadeItem").value =
      item.quantidade_pecas

    document.getElementById(
      "salvarItemCorte"
    ).textContent = "Atualizar item do corte"

    document.getElementById("modeloItem").focus()
  })
}


// ========================================
// EXCLUIR ITEM
// ========================================

function configurarExclusao(
  linha,
  item,
  numeroCorte
) {
  const botaoExcluir =
    linha.querySelector(".btn-excluir-item")

  botaoExcluir.addEventListener(
    "click",
    async () => {
      const confirmar = confirm(
        "Deseja excluir este item do corte?"
      )

      if (!confirmar) return

      try {
        await apiDelete(
          `/itens-corte/${item.id}`
        )

        mostrarToast(
          "Item excluído com sucesso.",
          "sucesso",
          "Item excluído"
        )

        await carregarItensCorte(numeroCorte)

      } catch (erro) {
        console.error(
          "Erro ao excluir item:",
          erro
        )

        mostrarToast(
          erro.message ||
            "Não foi possível excluir o item.",
          "erro",
          "Erro"
        )
      }
    }
  )
}


// ========================================
// SALVAR / ATUALIZAR ITEM
// ========================================

export async function salvarItemCorte() {
  const numeroCorte =
    document.getElementById("numeroCorte").value

  const modelo =
    document
      .getElementById("modeloItem")
      .value
      .trim()

  let cor =
    document.getElementById("corItem").value

  if (cor === "OUTRA") {
    cor =
      document
        .getElementById("corOutra")
        .value
        .trim()
  }

  let tecido =
    document.getElementById("tecidoItem").value

  if (tecido === "OUTRA") {
    tecido =
      document
        .getElementById("tecidoOutro")
        .value
        .trim()
  }

  const metragem =
    document.getElementById("metragemItem").value

  const sobra =
    document.getElementById("sobraItem").value

  const perda =
    document.getElementById("perdaItem").value

  const metrosFaltantes =
    document.getElementById(
      "metrosFaltantesItem"
    ).value

  const quantidade =
    document.getElementById(
      "quantidadeItem"
    ).value


  // ========================================
  // VALIDAÇÕES
  // ========================================

  if (
    !numeroCorte ||
    !modelo ||
    !cor ||
    !tecido ||
    !quantidade
  ) {
    mostrarToast(
      "Preencha modelo, cor, tecido e quantidade de peças.",
      "atencao",
      "Campos obrigatórios"
    )

    return
  }

  if (metragem === "") {
    mostrarToast(
      "Informe a metragem usada. Se for aproveitamento, digite 0.",
      "atencao",
      "Metragem obrigatória"
    )

    return
  }


  const itemEditandoId =
    document.getElementById(
      "itemEditandoId"
    ).value


  const dadosItem = {
    numero_corte: Number(numeroCorte),
    modelo,
    cor,
    tecido,
    metragem_usada: Number(metragem),
    sobra_metros: Number(sobra || 0),
    perda_metros: Number(perda || 0),
    metros_faltantes:
      Number(metrosFaltantes || 0),
    quantidade_pecas: Number(quantidade)
  }


  try {
    if (itemEditandoId) {
      await apiPut(
        `/itens-corte/${itemEditandoId}`,
        dadosItem
      )
    } else {
      await apiPost(
        "/itens-corte",
        dadosItem
      )
    }


    mostrarToast(
      itemEditandoId
        ? "O item do corte foi atualizado."
        : "Item salvo. Adicione outro PI ou registre os itens do corte.",
      "sucesso",
      itemEditandoId
        ? "Item atualizado"
        : "PI adicionado",
      5000
    )


    document.getElementById(
      "itemEditandoId"
    ).value = ""

    document.getElementById(
      "salvarItemCorte"
    ).textContent = "Salvar item do corte"

    limparCamposItens()

    await carregarItensCorte(numeroCorte)

  } catch (erro) {
    console.error(
      "Erro ao salvar item:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível salvar o item.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// FINALIZAR ITENS DO CORTE
// ========================================

export async function finalizarItensCorte() {
  const numeroCorte =
    document.getElementById("numeroCorte").value

  if (!numeroCorte) {
    mostrarToast(
      "Busque um corte antes de registrar os itens.",
      "atencao",
      "Corte não selecionado"
    )

    return
  }


  const confirmar = confirm(
    "Confirmar itens do corte?\n\n" +
    "Depois de registrar, não será possível adicionar ou alterar itens."
  )

  if (!confirmar) return


  try {
    await apiPost(
      `/cortes/${numeroCorte}/finalizar-itens`
    )

    mostrarToast(
      "Os PIs foram registrados e agora estão bloqueados para alteração.",
      "sucesso",
      "Corte concluído",
      6000
    )

    desabilitarItens()

    await carregarItensCorte(numeroCorte)

  } catch (erro) {
    console.error(
      "Erro ao finalizar itens:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível registrar os itens do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// EVENTOS DOS CAMPOS
// ========================================

export function inicializarItens() {
  const botaoSalvar =
    document.getElementById("salvarItemCorte")

  const botaoFinalizar =
    document.getElementById("finalizarItensCorte")

  const selectCor =
    document.getElementById("corItem")

  const inputCorOutra =
    document.getElementById("corOutra")

  const selectTecido =
    document.getElementById("tecidoItem")

  const inputTecidoOutro =
    document.getElementById("tecidoOutro")


  botaoSalvar.addEventListener(
    "click",
    salvarItemCorte
  )

  botaoFinalizar.addEventListener(
    "click",
    finalizarItensCorte
  )


  selectCor.addEventListener(
    "change",
    () => {
      inputCorOutra.style.display =
        selectCor.value === "OUTRA"
          ? "block"
          : "none"
    }
  )


  selectTecido.addEventListener(
    "change",
    () => {
      inputTecidoOutro.style.display =
        selectTecido.value === "OUTRA"
          ? "block"
          : "none"
    }
  )
}
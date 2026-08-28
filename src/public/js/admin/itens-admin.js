import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete
} from "../core/api.js"

import {
  mostrarToast
} from "../core/ui.js"

import {
  formatarNumero,
  formatarQuantidade,
  maiusculo
} from "../utils/formatters.js"


// ========================================
// ABRIR EDIÇÃO DE PI
// ========================================

function abrirEdicaoItemAdmin(item) {

  document.getElementById(
    "itemAdminEditandoId"
  ).value =
    item.id


  document.getElementById(
    "editarItemModeloAdmin"
  ).value =
    item.modelo ?? ""


  document.getElementById(
    "editarItemCorAdmin"
  ).value =
    item.cor ?? ""


  document.getElementById(
    "editarItemTecidoAdmin"
  ).value =
    item.tecido ?? ""


  document.getElementById(
    "editarItemMetragemAdmin"
  ).value =
    item.metragem_usada ?? 0


  document.getElementById(
    "editarItemSobraAdmin"
  ).value =
    item.sobra_metros ?? 0


  document.getElementById(
    "editarItemPerdaAdmin"
  ).value =
    item.perda_metros ?? 0


  document.getElementById(
    "editarItemFaltantesAdmin"
  ).value =
    item.metros_faltantes ?? 0


  document.getElementById(
    "editarItemQuantidadeAdmin"
  ).value =
    item.quantidade_pecas ?? 0


  const formulario =
    document.getElementById(
      "editarItemAdmin"
    )


  if (!formulario) {
    return
  }


  formulario.style.display =
    "block"


  formulario.scrollIntoView({
    behavior: "smooth",
    block: "center"
  })
}


// ========================================
// CARREGAR ITENS
// ========================================

export async function carregarItensAdmin(
  numeroCorte
) {
  try {

    const itens =
      await apiGet(
        `/itens-corte/${numeroCorte}`
      )


    const tabela =
      document.getElementById(
        "itensAdmin"
      )


    if (!tabela) {
      return
    }


    tabela.innerHTML = ""


    if (itens.length === 0) {

      tabela.innerHTML = `
        <tr>
          <td colspan="8">
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
        <td>
          ${maiusculo(item.modelo)}
        </td>

        <td>
          ${maiusculo(item.cor)}
        </td>

        <td>
          ${maiusculo(item.tecido)}
        </td>

        <td>
          ${formatarNumero(
            item.metragem_usada
          )}
        </td>

        <td>
          ${formatarNumero(
            item.sobra_metros
          )}
        </td>

        <td>
          ${formatarNumero(
            item.perda_metros
          )}
        </td>

        <td>
          ${formatarQuantidade(
            item.quantidade_pecas
          )}
        </td>

        <td>
          <div class="admin-acoes-tabela">

            <button
              type="button"
              class="btn-editar-item-admin"
            >
              Editar
            </button>

            <button
              type="button"
              class="btn-excluir-item-admin"
            >
              Excluir
            </button>

          </div>
        </td>
      `


      const botaoEditar =
        linha.querySelector(
          ".btn-editar-item-admin"
        )


      const botaoExcluir =
        linha.querySelector(
          ".btn-excluir-item-admin"
        )


      botaoEditar
        ?.addEventListener(
          "click",
          () => {

            abrirEdicaoItemAdmin(
              item
            )

          }
        )


      botaoExcluir
        ?.addEventListener(
          "click",
          async () => {

            await excluirItemAdmin(
              item
            )

          }
        )


      tabela.appendChild(
        linha
      )
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
// SALVAR EDIÇÃO
// ========================================

async function salvarEdicaoItemAdmin() {

  const id =
    document.getElementById(
      "itemAdminEditandoId"
    )?.value


  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )?.value?.trim()


  const modelo =
    document.getElementById(
      "editarItemModeloAdmin"
    )?.value?.trim()


  const cor =
    document.getElementById(
      "editarItemCorAdmin"
    )?.value?.trim()


  const tecido =
    document.getElementById(
      "editarItemTecidoAdmin"
    )?.value?.trim()


  const metragem =
    document.getElementById(
      "editarItemMetragemAdmin"
    )?.value


  const sobra =
    document.getElementById(
      "editarItemSobraAdmin"
    )?.value


  const perda =
    document.getElementById(
      "editarItemPerdaAdmin"
    )?.value


  const faltantes =
    document.getElementById(
      "editarItemFaltantesAdmin"
    )?.value


  const quantidade =
    document.getElementById(
      "editarItemQuantidadeAdmin"
    )?.value


  // ========================================
  // VALIDAÇÃO
  // ========================================

  if (
    !id ||
    !modelo ||
    !cor ||
    !tecido ||
    metragem === "" ||
    quantidade === ""
  ) {

    mostrarToast(
      "Preencha os campos obrigatórios.",
      "atencao",
      "Campos obrigatórios"
    )

    return
  }


  if (
    Number(metragem) < 0 ||
    Number(sobra || 0) < 0 ||
    Number(perda || 0) < 0 ||
    Number(faltantes || 0) < 0 ||
    Number(quantidade) < 0
  ) {

    mostrarToast(
      "Os valores não podem ser negativos.",
      "atencao",
      "Valores inválidos"
    )

    return
  }


  const confirmar =
    confirm(
      "Salvar as alterações deste PI?"
    )


  if (!confirmar) {
    return
  }


  try {

    await apiPut(
      `/itens-corte/${id}`,
      {
        modelo,
        cor,
        tecido,

        metragem_usada:
          Number(metragem),

        sobra_metros:
          Number(sobra || 0),

        perda_metros:
          Number(perda || 0),

        metros_faltantes:
          Number(faltantes || 0),

        quantidade_pecas:
          Number(quantidade)
      }
    )


    mostrarToast(
      "PI atualizado com sucesso.",
      "sucesso",
      "PI atualizado",
      5000
    )


    const formulario =
      document.getElementById(
        "editarItemAdmin"
      )


    if (formulario) {
      formulario.style.display =
        "none"
    }


    await carregarItensAdmin(
      numeroCorte
    )

  } catch (erro) {

    console.error(
      "Erro ao atualizar PI:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível atualizar o PI.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// EXCLUIR PI
// ========================================

async function excluirItemAdmin(item) {

  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )?.value?.trim()


  if (!numeroCorte) {
    return
  }


  const confirmar =
    confirm(
      `Excluir este PI?\n\n` +

      `Corte: ${numeroCorte}\n` +

      `Modelo: ${
        maiusculo(
          item.modelo ?? "-"
        )
      }\n` +

      `Cor: ${
        maiusculo(
          item.cor ?? "-"
        )
      }\n` +

      `Tecido: ${
        maiusculo(
          item.tecido ?? "-"
        )
      }\n` +

      `Quantidade: ${
        item.quantidade_pecas ?? "-"
      }\n\n` +

      `Esta ação removerá o PI do corte.`
    )


  if (!confirmar) {
    return
  }


  try {

    await apiDelete(
      `/itens-corte/${item.id}`
    )


    mostrarToast(
      "PI excluído com sucesso.",
      "sucesso",
      "PI excluído",
      5000
    )


    const formulario =
      document.getElementById(
        "editarItemAdmin"
      )


    if (formulario) {
      formulario.style.display =
        "none"
    }


    await carregarItensAdmin(
      numeroCorte
    )

  } catch (erro) {

    console.error(
      "Erro ao excluir PI:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível excluir o PI.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// REABRIR PIs
// ========================================

async function reabrirItensCorte() {

  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )?.value?.trim()


  if (!numeroCorte) {

    mostrarToast(
      "Digite o número do corte.",
      "atencao",
      "Número obrigatório"
    )

    return
  }


  const confirmar =
    confirm(
      "Tem certeza que deseja reabrir os PIs deste corte?\n\n" +
      "Depois disso será possível editar e adicionar novos itens."
    )


  if (!confirmar) {
    return
  }


  try {

    await apiPost(
      `/cortes/${numeroCorte}/reabrir-itens`
    )


    mostrarToast(
      `Os PIs do corte ${numeroCorte} foram reabertos.`,
      "sucesso",
      "PIs reabertos",
      5000
    )


    await carregarItensAdmin(
      numeroCorte
    )

  } catch (erro) {

    console.error(
      "Erro ao reabrir itens:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível reabrir os PIs do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// INICIALIZAÇÃO
// ========================================

export function inicializarItensAdmin() {

  const botaoReabrir =
    document.getElementById(
      "reabrirItensCorte"
    )


  const botaoSalvar =
    document.getElementById(
      "salvarEdicaoItemAdmin"
    )


  const botaoCancelar =
    document.getElementById(
      "cancelarEdicaoItemAdmin"
    )


  botaoReabrir
    ?.addEventListener(
      "click",
      reabrirItensCorte
    )


  botaoSalvar
    ?.addEventListener(
      "click",
      salvarEdicaoItemAdmin
    )


  botaoCancelar
    ?.addEventListener(
      "click",
      () => {

        const formulario =
          document.getElementById(
            "editarItemAdmin"
          )


        if (formulario) {
          formulario.style.display =
            "none"
        }

      }
    )
}
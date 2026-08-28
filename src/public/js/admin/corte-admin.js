import {
  apiGet
} from "../core/api.js"

import {
  mostrarToast
} from "../core/ui.js"

import {
  carregarHistoricoAdmin
} from "./producao-admin.js"

import {
  carregarItensAdmin
} from "./itens-admin.js"

import {
  mostrarDetalhesAdmin,
  esconderDetalhesAdmin,
  limparTabelasAdmin,
  preencherResumoCorteAdmin
} from "./ui-admin.js"


// ========================================
// BUSCAR CORTE
// ========================================

async function buscarCorteAdmin() {
  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )?.value?.trim()


  if (!numeroCorte) {
    esconderDetalhesAdmin()

    limparTabelasAdmin()


    mostrarToast(
      "Digite o número do corte.",
      "atencao",
      "Número obrigatório"
    )

    return
  }


  try {

    // ========================================
    // CONFIRMAR SE CORTE EXISTE
    // ========================================

    const dadosCorte =
      await apiGet(
        `/cortes/${numeroCorte}/resumo`
      )


    // ========================================
    // PREENCHER RESUMO
    // ========================================

    preencherResumoCorteAdmin(
      numeroCorte,
      dadosCorte
    )


    // ========================================
    // CARREGAR DADOS
    // ========================================

    await Promise.all([
      carregarHistoricoAdmin(
        numeroCorte
      ),

      carregarItensAdmin(
        numeroCorte
      )
    ])


    // ========================================
    // MOSTRAR ÁREA ADMIN
    // ========================================

    mostrarDetalhesAdmin()


    // ========================================
    // SCROLL
    // ========================================

    setTimeout(() => {
      document
        .getElementById(
          "adminDetalhes"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
    }, 100)

  } catch (erro) {
    console.error(
      "Erro ao buscar corte:",
      erro
    )


    esconderDetalhesAdmin()

    limparTabelasAdmin()


    mostrarToast(
      `Corte ${numeroCorte} não encontrado.`,
      "atencao",
      "Corte não encontrado"
    )
  }
}


// ========================================
// INICIALIZAÇÃO
// ========================================

export function inicializarCorteAdmin() {
  const botaoBuscar =
    document.getElementById(
      "buscarCorteAdmin"
    )

  const campoNumero =
    document.getElementById(
      "numeroCorteAdmin"
    )


  // Clique
  botaoBuscar
    ?.addEventListener(
      "click",
      buscarCorteAdmin
    )


  // Enter
  campoNumero
    ?.addEventListener(
      "keydown",
      async (evento) => {

        if (evento.key !== "Enter") {
          return
        }


        evento.preventDefault()


        await buscarCorteAdmin()
      }
    )
}
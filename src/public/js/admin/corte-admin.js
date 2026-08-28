import {
  apiGet,
  apiDelete
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
// EXCLUIR CORTE COMPLETO
// ========================================

async function excluirCorteAdmin() {

  const campoNumero =
    document.getElementById(
      "numeroCorteAdmin"
    )


  const numeroCorte =
    campoNumero
      ?.value
      ?.trim()


  if (!numeroCorte) {

    mostrarToast(
      "Busque um corte antes de excluir.",
      "atencao",
      "Nenhum corte selecionado"
    )

    return
  }


  // ========================================
  // PRIMEIRA CONFIRMAÇÃO
  // ========================================

  const confirmar =
    confirm(
      `ATENÇÃO!\n\n` +

      `Você está prestes a apagar o corte ${numeroCorte}.\n\n` +

      `Também serão apagados:\n` +
      `• Todos os lançamentos de produção\n` +
      `• Todos os PIs do corte\n\n` +

      `Deseja continuar?`
    )


  if (!confirmar) {
    return
  }


  // ========================================
  // SEGUNDA CONFIRMAÇÃO
  // ========================================

  const numeroConfirmacao =
    prompt(
      `Para confirmar, digite o número do corte:\n\n${numeroCorte}`
    )


  if (
    numeroConfirmacao !==
    numeroCorte
  ) {

    mostrarToast(
      "O número informado não corresponde ao corte.",
      "atencao",
      "Exclusão cancelada"
    )

    return
  }


  try {

    const resultado =
      await apiDelete(
        `/cortes/${numeroCorte}`
      )


    mostrarToast(
      resultado.mensagem ||
        `Corte ${numeroCorte} excluído.`,
      "sucesso",
      "Corte excluído",
      5000
    )


    // ========================================
    // LIMPAR TELA
    // ========================================

    campoNumero.value = ""


    esconderDetalhesAdmin()


    limparTabelasAdmin()


    campoNumero.focus()


  } catch (erro) {

    console.error(
      "Erro ao excluir corte:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível excluir o corte.",
      "erro",
      "Erro"
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

  const botaoExcluir =
    document.getElementById(
      "excluirCorteAdmin"
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

  botaoExcluir
  ?.addEventListener(
    "click",
    excluirCorteAdmin
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
import {
  inicializarCortes,
  carregarCortesEmAndamento
} from "./cortes.js"

import {
  inicializarProducao
} from "./producao.js"

import {
  inicializarItens
} from "./itens.js"

import {
  atualizarResumoTopo
} from "./ui-corte.js"

import {
  inicializarRealtime
} from "../../core/realtime.js"


async function iniciarPagina() {
  console.log(
    "🚀 Inicializando Controle de Corte"
  )


  // ========================================
  // CORTES
  // ========================================

  inicializarCortes()


  // ========================================
  // PRODUÇÃO
  // ========================================

  inicializarProducao()


  // ========================================
  // PIs
  // ========================================

  inicializarItens()


  // ========================================
  // RESUMO SUPERIOR
  // ========================================

  atualizarResumoTopo({})


  // ========================================
  // DADOS INICIAIS
  // ========================================

  await carregarCortesEmAndamento()


  // ========================================
  // TEMPO REAL
  // ========================================

  inicializarRealtime()


  console.log(
    "✅ Controle de Corte inicializado"
  )
}


document.addEventListener(
  "DOMContentLoaded",
  iniciarPagina
)
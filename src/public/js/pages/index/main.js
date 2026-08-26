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
  desabilitarProducao
} from "./ui-corte.js"

import {
  inicializarRealtime
} from "../../core/realtime.js"

import {
  inicializarHistoricoUI
} from "./historico.js"


async function iniciarPagina() {
  console.log(
    "🚀 Inicializando Controle de Corte"
  )


  // ========================================
  // CORTES
  // ========================================

  

  inicializarCortes()


  // ========================================
  // BOTÃO NOVO CORTE DO TOPO
  // ========================================

  const botaoNovoCorteTopo =
    document.getElementById("novoCorteTopo")

  const botaoNovoCorteOriginal =
    document.getElementById("gerarProximoCorte")

  if (
    botaoNovoCorteTopo &&
    botaoNovoCorteOriginal
  ) {
    botaoNovoCorteTopo.addEventListener(
      "click",
      () => {
        botaoNovoCorteOriginal.click()
      }
    )
  }


  // ========================================
  // PRODUÇÃO
  // ========================================

inicializarProducao()

// Começa bloqueado até selecionar um corte
desabilitarProducao("SEM_CORTE")


  // ========================================
  // PIs
  // ========================================

  inicializarItens()

  inicializarHistoricoUI()


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
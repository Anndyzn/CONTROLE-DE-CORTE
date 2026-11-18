import {
  inicializarCortes,
  carregarCortesEmAndamento,
  buscarCorte
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
import { inicializarResumoFinalizados } from "./finalizados.js"
import { inicializarRascunhos } from "./rascunho.js"
import { inicializarTabelasResponsivas } from "../../core/tabelas.js"
import { inicializarSugestoesNomes } from "./nomes.js"
import { inicializarVinculosPIs } from "./vinculos.js"
import { inicializarGradePis } from "./grade-pis.js"
import { inicializarTrabalhos } from "./trabalhos.js"


async function iniciarPagina() {
  inicializarTabelasResponsivas()
  console.log(
    "🚀 Inicializando Controle de Corte"
  )


  // ========================================
  // CORTES
  // ========================================

  

  inicializarCortes()
  inicializarResumoFinalizados(buscarCorte)


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
  inicializarGradePis()

  inicializarHistoricoUI()
  inicializarRascunhos(buscarCorte)
  inicializarSugestoesNomes()
  inicializarVinculosPIs()
  inicializarTrabalhos({buscarCorte,carregarCortesEmAndamento})


  // ========================================
  // DADOS INICIAIS
  // ========================================

  await carregarCortesEmAndamento({
    mostrarCarregamento: true
  })


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

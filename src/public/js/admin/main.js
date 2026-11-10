import {
  inicializarCorteAdmin
} from "./corte-admin.js"

import {
  inicializarProducaoAdmin
} from "./producao-admin.js"

import {
  inicializarItensAdmin
} from "./itens-admin.js"

import {
  esconderDetalhesAdmin
} from "./ui-admin.js"
import { inicializarHistoricoAdmin } from "./historico-admin.js"
import { inicializarTabelasResponsivas } from "../core/tabelas.js"
import { inicializarPadronizacao } from "./padronizacao.js"
import { inicializarAbasAdmin } from "./abas.js"
import { inicializarAcompanhamentoSankhya } from "../core/acompanhamento-sankhya.js"


function iniciarAdmin() {
  inicializarAbasAdmin()
  inicializarAcompanhamentoSankhya()
  inicializarTabelasResponsivas()
  console.log(
    "🚀 Inicializando painel administrativo"
  )

  esconderDetalhesAdmin()

  inicializarCorteAdmin()

  inicializarProducaoAdmin()

  inicializarItensAdmin()
  inicializarHistoricoAdmin()
  inicializarPadronizacao()

  console.log(
    "✅ Painel administrativo inicializado"
  )
}


document.addEventListener(
  "DOMContentLoaded",
  iniciarAdmin
)

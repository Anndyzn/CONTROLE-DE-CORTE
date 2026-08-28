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


function iniciarAdmin() {
  console.log(
    "🚀 Inicializando painel administrativo"
  )

  esconderDetalhesAdmin()

  inicializarCorteAdmin()

  inicializarProducaoAdmin()

  inicializarItensAdmin()

  console.log(
    "✅ Painel administrativo inicializado"
  )
}


document.addEventListener(
  "DOMContentLoaded",
  iniciarAdmin
)
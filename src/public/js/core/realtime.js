import {
  carregarCortesEmAndamento,
  buscarCorte
} from "../pages/index/cortes.js"

import {
  carregarItensCorte
} from "../pages/index/itens.js"


const SUPABASE_URL =
  "https://znpmlfrwkftzfufywskr.supabase.co"

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_WUTuenRk7EC1KIORYpOb7A_4Vyurr6U"


let canalRealtime = null


export function inicializarRealtime() {
  if (!window.supabase) {
    console.error(
      "Biblioteca do Supabase não foi carregada."
    )

    return
  }


  const supabaseRealtime =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    )


  canalRealtime = supabaseRealtime
    .channel("controle-corte-realtime")


    // ========================================
    // ALTERAÇÕES EM CORTES
    // ========================================

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cortes"
      },

      async (payload) => {
        console.log(
          "Realtime: corte alterado",
          payload
        )


        // Atualiza lista superior
        await carregarCortesEmAndamento()


        // Se existe um corte aberto,
        // atualiza também suas informações.
        const numeroCorteAtual =
          document.getElementById(
            "numeroCorte"
          )?.value


        if (numeroCorteAtual) {
          await buscarCorte(
            numeroCorteAtual
          )
        }
      }
    )


    // ========================================
    // ALTERAÇÕES EM PRODUÇÃO
    // ========================================

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "producao"
      },

      async (payload) => {
        console.log(
          "Realtime: produção alterada",
          payload
        )


        await carregarCortesEmAndamento()


        const numeroCorteAtual =
          document.getElementById(
            "numeroCorte"
          )?.value


        if (numeroCorteAtual) {
          await buscarCorte(
            numeroCorteAtual
          )
        }
      }
    )


    // ========================================
    // ALTERAÇÕES NOS PIs
    // ========================================

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "itens_corte"
      },

      async (payload) => {
        console.log(
          "Realtime: itens alterados",
          payload
        )


        const numeroCorteAtual =
          document.getElementById(
            "numeroCorte"
          )?.value


        if (numeroCorteAtual) {
          await carregarItensCorte(
            numeroCorteAtual
          )
        }
      }
    )


    // ========================================
    // STATUS DA CONEXÃO
    // ========================================

    .subscribe((status) => {
      console.log(
        "Status Realtime:",
        status
      )
    })
}
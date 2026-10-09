import {
  carregarCortesEmAndamento,
  buscarCorte
} from "../pages/index/cortes.js"

import {
  carregarItensCorte
} from "../pages/index/itens.js"

import {
  SUPABASE_PUBLIC_KEY,
  SUPABASE_URL
} from "./supabase-config.js"


let canalRealtime = null


function atualizarStatusSincronizacao(
  texto,
  tipo = "ok"
) {
  const indicador =
    document.getElementById(
      "syncStatus"
    )


  if (!indicador) {
    return
  }


  indicador.classList.remove(
    "sync-status-ok",
    "sync-status-warning",
    "sync-status-error"
  )

  indicador.classList.add(
    `sync-status-${tipo}`
  )

  indicador.innerHTML = `
    <span class="sync-dot"></span>
    ${texto}
  `
}


export function inicializarRealtime() {
  if (!window.supabase) {
    console.error(
      "Biblioteca do Supabase não foi carregada."
    )

    atualizarStatusSincronizacao(
      "Sem tempo real",
      "error"
    )

    return
  }


  atualizarStatusSincronizacao(
    "Conectando",
    "warning"
  )


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


      if (status === "SUBSCRIBED") {
        atualizarStatusSincronizacao(
          "Sincronizado",
          "ok"
        )

        return
      }


      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        atualizarStatusSincronizacao(
          "Reconectando",
          "warning"
        )

        return
      }


      if (status === "CLOSED") {
        atualizarStatusSincronizacao(
          "Offline",
          "error"
        )
      }
    })
}

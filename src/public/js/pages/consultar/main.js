import {
  inicializarFiltros,
  carregarResultadosConsulta,
  atualizarDetalhesConsulta
} from "./filtros.js"
import { inicializarTabelasResponsivas } from "../../core/tabelas.js"
import { carregarBibliotecaRealtime } from '../../core/biblioteca-realtime.js'

import {
  SUPABASE_PUBLIC_KEY,
  SUPABASE_URL
} from "../../core/supabase-config.js"


function atualizarStatusConsulta(
  texto,
  tipo = "ok"
) {
  const indicador =
    document.getElementById(
      "syncStatusConsulta"
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


async function inicializarRealtimeConsulta() {
  if (!window.supabase) {
    atualizarStatusConsulta('Conectando', 'warning')
    try { await carregarBibliotecaRealtime() }
    catch { atualizarStatusConsulta('Sem tempo real', 'error'); return }
  }


  atualizarStatusConsulta(
    "Conectando",
    "warning"
  )


  const supabaseConsulta =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    )


  supabaseConsulta
    .channel(
      "consulta-cortes-realtime"
    )


    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cortes"
      },

      async () => {
        console.log(
          "Consulta Realtime: corte alterado"
        )

        await Promise.all([carregarResultadosConsulta({silencioso:true}), atualizarDetalhesConsulta()])
      }
    )


    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "producao"
      },

      async () => {
        console.log(
          "Consulta Realtime: produção alterada"
        )


        await Promise.all([carregarResultadosConsulta({silencioso:true}), atualizarDetalhesConsulta()])
      }
    )


    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "itens_corte"
      },

      async () => {
        console.log(
          "Consulta Realtime: item alterado"
        )


        await atualizarDetalhesConsulta()
      }
    )


    .subscribe((status) => {
      console.log(
        "Status Realtime Consulta:",
        status
      )

      if (status === "SUBSCRIBED") {
        atualizarStatusConsulta(
          "Consulta ativa",
          "ok"
        )

        return
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        atualizarStatusConsulta(
          "Reconectando",
          "warning"
        )

        return
      }

      if (status === "CLOSED") {
        atualizarStatusConsulta(
          "Offline",
          "error"
        )
      }
    })
}


async function iniciarPaginaConsulta() {
  inicializarTabelasResponsivas()
  console.log(
    "🚀 Inicializando consulta de cortes"
  )


  inicializarFiltros()


  await carregarResultadosConsulta()


  inicializarRealtimeConsulta()


  console.log(
    "✅ Consulta de cortes inicializada"
  )
}


document.addEventListener(
  "DOMContentLoaded",
  iniciarPaginaConsulta
)

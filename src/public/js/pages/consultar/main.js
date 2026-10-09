import {
  inicializarFiltros,
  carregarResultadosConsulta,
  obterCorteConsultaAtual
} from "./filtros.js"

import {
  carregarHistoricoConsulta,
  carregarItensConsulta
} from "./historico.js"

import {
  carregarDashboardCorte
} from "./dashboard.js"

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


function inicializarRealtimeConsulta() {
  if (!window.supabase) {
    console.error(
      "Supabase não carregado"
    )

    atualizarStatusConsulta(
      "Sem tempo real",
      "error"
    )

    return
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

        await carregarResultadosConsulta()
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


        await carregarResultadosConsulta()


        const numero =
          obterCorteConsultaAtual()


        if (numero) {
          await carregarHistoricoConsulta(
            numero
          )

          await carregarDashboardCorte(
            numero
          )
        }
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


        const numero =
          obterCorteConsultaAtual()


        if (numero) {
          await carregarItensConsulta(
            numero
          )

          await carregarDashboardCorte(
            numero
          )
        }
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

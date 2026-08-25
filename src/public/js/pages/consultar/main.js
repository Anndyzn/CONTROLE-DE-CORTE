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


const SUPABASE_URL =
  "https://znpmlfrwkftzfufywskr.supabase.co"

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_WUTuenRk7EC1KIORYpOb7A_4Vyurr6U"


function inicializarRealtimeConsulta() {
  if (!window.supabase) {
    console.error(
      "Supabase não carregado"
    )

    return
  }


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
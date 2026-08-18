console.log("🔌 Supabase Realtime iniciado")

const canal = supabaseRealtime
  .channel("controle-cortes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "cortes"
    },
    (payload) => {
      console.log("🔄 Alteração em CORTES:", payload)

      window.dispatchEvent(
        new CustomEvent("cortesAtualizados", {
          detail: payload
        })
      )
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "producao"
    },
    (payload) => {
      console.log("🔄 Alteração em PRODUÇÃO:", payload)

      window.dispatchEvent(
        new CustomEvent("producaoAtualizada", {
          detail: payload
        })
      )
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "itens_corte"
    },
    (payload) => {
      console.log("🔄 Alteração em ITENS:", payload)

      window.dispatchEvent(
        new CustomEvent("itensAtualizados", {
          detail: payload
        })
      )
    }
  )
  .subscribe((status) => {
    console.log("📡 Status Realtime:", status)
  })
export function periodoResumo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(agora)

  const parte = (tipo: string) => partes.find((item) => item.type === tipo)!.value
  const hoje = `${parte("year")}-${parte("month")}-${parte("day")}`
  const inicio = new Date(`${hoje}T00:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 2)

  return { hoje, data_inicial: inicio.toISOString().slice(0, 10) }
}

export function maiusculo(valor) {
  return valor ? String(valor).toUpperCase() : "-"
}

export function formatarData(data) {
  if (!data) return "-"

  const somenteData = String(data).substring(0, 10)
  const [ano, mes, dia] = somenteData.split("-")

  if (!ano || !mes || !dia) return data

  return `${dia}/${mes}/${ano}`
}

export function formatarNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "0"
  }

  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

export function formatarQuantidade(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "0"
  }

  return Number(valor).toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  })
}

export function calcularDuracao(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return "-"

  const [h1, m1] = horaInicio.split(":").map(Number)
  const [h2, m2] = horaFim.split(":").map(Number)

  const inicio = h1 * 60 + m1
  let fim = h2 * 60 + m2

  if (fim < inicio) {
    fim += 24 * 60
  }

  const diferenca = fim - inicio

  const horas = Math.floor(diferenca / 60)
  const minutos = diferenca % 60

  return `${horas}h ${minutos}min`
}
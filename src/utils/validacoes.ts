export function numeroNaoNegativo(valor: unknown, inteiro = false) {
  if (
    (typeof valor !== "number" && typeof valor !== "string") ||
    (typeof valor === "string" && valor.trim() === "")
  ) return false

  const numero = Number(valor)

  return Number.isFinite(numero) && numero >= 0 && (
    !inteiro || (Number.isInteger(numero) && numero <= 2147483647)
  )
}

export function numeroCorteValido(valor: unknown) {
  return numeroNaoNegativo(valor, true) && Number(valor) > 0
}

export function validarFolhas(inicio: unknown, fim: unknown) {
  if (!numeroNaoNegativo(inicio, true) || !numeroNaoNegativo(fim, true)) {
    return "As folhas devem ser números inteiros não negativos."
  }

  if (Number(fim) < Number(inicio)) {
    return "A folha final não pode ser menor que a folha inicial."
  }

  return null
}

export function validarProducao(dados: Record<string, unknown>) {
  const campos = ["data", "turno", "operador", "status"]

  if (campos.some((campo) =>
    typeof dados[campo] !== "string" || !String(dados[campo]).trim()
  )) return "Preencha todos os campos obrigatórios."

  const data = String(dados.data)
  const dataConvertida = new Date(`${data}T00:00:00Z`)

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    Number.isNaN(dataConvertida.getTime()) ||
    dataConvertida.toISOString().slice(0, 10) !== data
  ) return "Informe uma data válida."

  if (!["EM PRODUÇÃO", "FINALIZADO"].includes(String(dados.status))) {
    return "Selecione um status de produção válido."
  }

  for (const campo of ["hora_inicio", "hora_fim"]) {
    const hora = dados[campo]
    if (hora != null && hora !== "" && (
      typeof hora !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)
    )) return "Informe horários válidos."
  }

  return validarFolhas(dados.folha_inicio, dados.folha_parou)
}

export function validarItem(dados: Record<string, unknown>) {
  if (["modelo", "cor", "tecido"].some((campo) =>
    typeof dados[campo] !== "string" || !String(dados[campo]).trim()
  )) return "Preencha modelo, cor e tecido."

  const campos = [
    "metragem_usada", "sobra_metros", "perda_metros",
    "metros_faltantes", "quantidade_pecas"
  ]

  if (campos.some((campo) => {
    const opcional = !["metragem_usada", "quantidade_pecas"].includes(campo)
    return !numeroNaoNegativo(opcional ? dados[campo] ?? 0 : dados[campo])
  })) return "Metragem, sobra, perda, metros faltantes e quantidade devem ser números não negativos."

  return null
}

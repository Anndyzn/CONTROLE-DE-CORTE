function numeroNaoNegativo(valor, inteiro = false) {
  if (
    (typeof valor !== "number" && typeof valor !== "string") ||
    (typeof valor === "string" && valor.trim() === "")
  ) return false

  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 && (
    !inteiro || (Number.isInteger(numero) && numero <= 2147483647)
  )
}

export function validarFolhas(inicio, fim) {
  if (!numeroNaoNegativo(inicio, true) || !numeroNaoNegativo(fim, true)) {
    return "As folhas devem ser números inteiros não negativos."
  }
  if (Number(fim) < Number(inicio)) {
    return "A folha final não pode ser menor que a folha inicial."
  }
  return null
}

export function validarValoresItem(dados) {
  if (Object.values(dados).some((valor) => !numeroNaoNegativo(valor))) {
    return "Metragem, sobra, perda, metros faltantes e quantidade devem ser números não negativos."
  }
  return null
}

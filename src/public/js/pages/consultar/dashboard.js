import { apiGet } from "../../core/api.js"


function converterNumero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0
  }

  const numero =
    Number(
      String(valor)
        .trim()
        .replace(",", ".")
    )

  return Number.isNaN(numero)
    ? 0
    : numero
}


function calcularMinutos(
  horaInicio,
  horaFim
) {
  if (!horaInicio || !horaFim) {
    return 0
  }

  const [h1, m1] =
    horaInicio
      .split(":")
      .map(Number)

  const [h2, m2] =
    horaFim
      .split(":")
      .map(Number)

  const inicio =
    h1 * 60 + m1

  let fim =
    h2 * 60 + m2

  // Turno atravessou meia-noite
  if (fim < inicio) {
    fim += 24 * 60
  }

  return fim - inicio
}


function formatarMinutos(total) {
  const horas =
    Math.floor(total / 60)

  const minutos =
    total % 60

  return `${horas}h ${minutos}min`
}


function formatarNumeroDashboard(valor) {
  return Number(valor).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )
}


function formatarQuantidadeDashboard(valor) {
  return Number(valor).toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits: 0
    }
  )
}


// ========================================
// DASHBOARD
// ========================================

export async function carregarDashboardCorte(
  numeroCorte
) {
  try {
    const historico =
      await apiGet(
        `/producao/${numeroCorte}`
      )

    const itens =
      await apiGet(
        `/itens-corte/${numeroCorte}`
      )


    const totalFolhas =
      historico.reduce(
        (total, item) => {
          const inicio =
            converterNumero(
              item.folha_inicio
            )

          const fim =
            converterNumero(
              item.folha_parou
            )

          if (fim > inicio) {
            return total +
              (fim - inicio)
          }

          return total
        },
        0
      )


    const tempoTotalMinutos =
      historico.reduce(
        (total, item) => {
          return (
            total +
            calcularMinutos(
              item.hora_inicio,
              item.hora_fim
            )
          )
        },
        0
      )


    const totalPecas =
      itens.reduce(
        (total, item) =>
          total +
          converterNumero(
            item.quantidade_pecas
          ),
        0
      )


    const totalMetragem =
      itens.reduce(
        (total, item) =>
          total +
          converterNumero(
            item.metragem_usada
          ),
        0
      )


    const totalSobra =
      itens.reduce(
        (total, item) =>
          total +
          converterNumero(
            item.sobra_metros
          ),
        0
      )


    const totalPerda =
      itens.reduce(
        (total, item) =>
          total +
          converterNumero(
            item.perda_metros
          ),
        0
      )


    const totalFaltantes =
      itens.reduce(
        (total, item) =>
          total +
          converterNumero(
            item.metros_faltantes
          ),
        0
      )


    document.getElementById(
      "totalFolhas"
    ).textContent =
      formatarQuantidadeDashboard(
        totalFolhas
      )


    document.getElementById(
      "tempoTotal"
    ).textContent =
      formatarMinutos(
        tempoTotalMinutos
      )


    document.getElementById(
      "totalLancamentos"
    ).textContent =
      historico.length


    document.getElementById(
      "totalPecas"
    ).textContent =
      formatarQuantidadeDashboard(
        totalPecas
      )


    document.getElementById(
      "totalMetragem"
    ).textContent =
      formatarNumeroDashboard(
        totalMetragem
      )


    document.getElementById(
      "totalSobra"
    ).textContent =
      formatarNumeroDashboard(
        totalSobra
      )


    document.getElementById(
      "totalPerda"
    ).textContent =
      formatarNumeroDashboard(
        totalPerda
      )


    document.getElementById(
      "totalmetrosFaltantesTotal"
    ).textContent =
      formatarNumeroDashboard(
        totalFaltantes
      )


    document.getElementById(
      "dashboardCorte"
    ).style.display = "block"

  } catch (erro) {
    console.error(
      "Erro ao carregar dashboard:",
      erro
    )
  }
}
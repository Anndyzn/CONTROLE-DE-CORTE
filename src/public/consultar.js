const botaoBuscarFiltros = document.getElementById("buscarFiltros")

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0

  const texto = String(valor)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  const numero = Number(texto)

  return Number.isNaN(numero) ? 0 : numero
}

function calcularDuracao(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return "-"

  const [h1, m1] = horaInicio.split(":").map(Number)
  const [h2, m2] = horaFim.split(":").map(Number)

  const inicio = h1 * 60 + m1
  const fim = h2 * 60 + m2
  const diferenca = fim - inicio

  if (Number.isNaN(diferenca) || diferenca < 0) return "-"

  const horas = Math.floor(diferenca / 60)
  const minutos = diferenca % 60

  return `${horas}h ${minutos}min`
}

function calcularMinutos(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return 0

  const [h1, m1] = horaInicio.split(":").map(Number)
  const [h2, m2] = horaFim.split(":").map(Number)

  const inicio = h1 * 60 + m1
  const fim = h2 * 60 + m2
  const diff = fim - inicio

  return diff > 0 ? diff : 0
}

function formatarMinutos(totalMinutos) {
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60

  return `${horas}h ${minutos}min`
}

async function carregarHistoricoConsulta(numeroCorte) {
  try {
    const resposta = await fetch(`/producao/${numeroCorte}`)
    const historico = await resposta.json()

    const tabela = document.getElementById("historicoConsulta")
    tabela.innerHTML = ""

    if (historico.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="9">Nenhum histórico encontrado</td>
        </tr>
      `
      return []
    }

    historico.forEach((item) => {
      const linha = document.createElement("tr")
      const duracao = calcularDuracao(item.hora_inicio, item.hora_fim)

      linha.innerHTML = `
        <td>${formatarData(item.data)}</td>
        <td>${item.turno}</td>
        <td>${item.operador}</td>
        <td>${item.hora_inicio ?? "-"}</td>
        <td>${item.hora_fim ?? "-"}</td>
        <td>${duracao}</td>
        <td>${item.folha_inicio}</td>
        <td>${item.folha_parou}</td>
        <td>${item.status}</td>
      `

      tabela.appendChild(linha)
    })

    return historico
  } catch (error) {
    alert("Erro ao carregar histórico")
    console.error(error)
    return []
  }
}

async function carregarItensConsulta(numeroCorte) {
  try {
    const resposta = await fetch(`/itens-corte/${numeroCorte}`)
    const itens = await resposta.json()

    const tabela = document.getElementById("itensConsulta")
    tabela.innerHTML = ""

    if (itens.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="7">Nenhum item encontrado</td>
        </tr>
      `
      return []
    }

    itens.forEach((item) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${item.modelo}</td>
        <td>${item.cor}</td>
        <td>${item.tecido}</td>
        <td>${item.metragem_usada}</td>
        <td>${item.sobra_metros}</td>
        <td>${item.perda_metros}</td>
        <td>${item.quantidade_pecas}</td>
      `

      tabela.appendChild(linha)
    })

    return itens
  } catch (error) {
    alert("Erro ao carregar itens do corte")
    console.error(error)
    return []
  }
}

async function carregarDashboardCorte(numeroCorte) {
  try {
    const respostaHistorico = await fetch(`/producao/${numeroCorte}`)
    const historico = await respostaHistorico.json()

    const respostaItens = await fetch(`/itens-corte/${numeroCorte}`)
    const itens = await respostaItens.json()

    const totalFolhas = historico.reduce((total, item) => {
      const inicio = converterNumero(item.folha_inicio)
      const fim = converterNumero(item.folha_parou)

      if (fim > inicio) {
        return total + (fim - inicio)
      }

      return total
    }, 0)

    const tempoTotalMinutos = historico.reduce((total, item) => {
      return total + calcularMinutos(item.hora_inicio, item.hora_fim)
    }, 0)

    const totalPecas = itens.reduce((total, item) => {
      return total + converterNumero(item.quantidade_pecas)
    }, 0)

    const totalMetragem = itens.reduce((total, item) => {
      return total + converterNumero(item.metragem_usada)
    }, 0)

    const totalSobra = itens.reduce((total, item) => {
      return total + converterNumero(item.sobra_metros)
    }, 0)

    const totalPerda = itens.reduce((total, item) => {
      return total + converterNumero(item.perda_metros)
    }, 0)

    document.getElementById("totalFolhas").textContent = totalFolhas
    document.getElementById("tempoTotal").textContent = formatarMinutos(tempoTotalMinutos)
    document.getElementById("totalLancamentos").textContent = historico.length
    document.getElementById("totalPecas").textContent = totalPecas
    document.getElementById("totalMetragem").textContent = totalMetragem.toFixed(2)
    document.getElementById("totalSobra").textContent = totalSobra.toFixed(2)
    document.getElementById("totalPerda").textContent = totalPerda.toFixed(2)

    document.getElementById("dashboardCorte").style.display = "block"
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error)
  }
}

botaoBuscarFiltros.addEventListener("click", async () => {
  const numero = document.getElementById("filtroNumero").value
  const dataInicial = document.getElementById("filtroDataInicial").value
  const dataFinal = document.getElementById("filtroDataFinal").value
  const status = document.getElementById("filtroStatus").value

  const params = new URLSearchParams()

  if (numero) params.append("numero", numero)
  if (dataInicial) params.append("data_inicial", dataInicial)
  if (dataFinal) params.append("data_final", dataFinal)
  if (status) params.append("status", status)

  try {
    const resposta = await fetch(`/consultar-cortes?${params.toString()}`)
    const resultados = await resposta.json()

    const tabela = document.getElementById("resultadoFiltros")
    tabela.innerHTML = ""

    document.getElementById("dashboardCorte").style.display = "none"
    document.getElementById("historicoConsulta").innerHTML = ""
    document.getElementById("itensConsulta").innerHTML = ""

    if (resultados.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">Nenhum corte encontrado</td>
        </tr>
      `
      return
    }

    resultados.forEach((item) => {
      const statusClasse =
        item.status === "FINALIZADO"
          ? "status-badge status-finalizado"
          : item.status === "EM PRODUÇÃO"
          ? "status-badge status-em-producao"
          : "status-badge status-default"

      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${item.numero}</td>
        <td>${item.produto ?? "-"}</td>
        <td>${item.mesa ?? "-"}</td>
        <td>${formatarData(item.data)}</td>
        <td>${item.folha_parou ?? "-"}</td>
        <td><span class="${statusClasse}">${item.status ?? "-"}</span></td>
      `

      linha.style.cursor = "pointer"

      linha.addEventListener("click", async () => {
        await carregarHistoricoConsulta(item.numero)
        await carregarItensConsulta(item.numero)
        await carregarDashboardCorte(item.numero)
      })

      tabela.appendChild(linha)
    })
  } catch (error) {
    alert("Erro ao consultar cortes")
    console.error(error)
  }
})
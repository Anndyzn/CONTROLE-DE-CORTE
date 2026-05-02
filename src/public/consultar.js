const botaoBuscarFiltros = document.getElementById("buscarFiltros")

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
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
        })

      tabela.appendChild(linha)
    })
  } catch (error) {
    alert("Erro ao consultar cortes")
    console.error(error)
  }
})
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
      return
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
  } catch (error) {
    alert("Erro ao carregar histórico")
    console.error(error)
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
      return
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
  } catch (error) {
    alert("Erro ao carregar itens do corte")
    console.error(error)
  }
}
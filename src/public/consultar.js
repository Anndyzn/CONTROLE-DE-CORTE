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

      linha.addEventListener("click", () => {
        window.location.href = `index.html?corte=${item.numero}`
      })

      tabela.appendChild(linha)
    })
  } catch (error) {
    alert("Erro ao consultar cortes")
    console.error(error)
  }
})
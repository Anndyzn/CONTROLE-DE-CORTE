const botaoBuscarCorteAdmin = document.getElementById("buscarCorteAdmin")
const botaoReabrirItensCorte = document.getElementById("reabrirItensCorte")

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

async function carregarHistoricoAdmin(numeroCorte) {
  try {
    const resposta = await fetch(`/producao/${numeroCorte}`)
    const historico = await resposta.json()

    const tabela = document.getElementById("historicoAdmin")
    tabela.innerHTML = ""

    if (historico.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="8">Nenhum histórico encontrado</td>
        </tr>
      `
      return
    }

    historico.forEach((item) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${formatarData(item.data)}</td>
        <td>${item.turno}</td>
        <td>${item.operador}</td>
        <td>${item.hora_inicio ?? "-"}</td>
        <td>${item.hora_fim ?? "-"}</td>
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

async function carregarItensAdmin(numeroCorte) {
  try {
    const resposta = await fetch(`/itens-corte/${numeroCorte}`)
    const itens = await resposta.json()

    const tabela = document.getElementById("itensAdmin")
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
    alert("Erro ao carregar itens")
    console.error(error)
  }
}

botaoBuscarCorteAdmin.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorteAdmin").value

  if (!numeroCorte) {
    alert("Digite o número do corte")
    return
  }

  await carregarHistoricoAdmin(numeroCorte)
  await carregarItensAdmin(numeroCorte)
})

botaoReabrirItensCorte.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorteAdmin").value

  if (!numeroCorte) {
    alert("Digite o número do corte")
    return
  }

  const confirmar = confirm(
    "Tem certeza que deseja reabrir os itens deste corte?\n\nDepois disso será possível adicionar novos itens."
  )

  if (!confirmar) {
    return
  }

  try {
    const resposta = await fetch(`/cortes/${numeroCorte}/reabrir-itens`, {
      method: "POST"
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao reabrir itens do corte")
      return
    }

    alert("Itens do corte reabertos com sucesso")
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
})
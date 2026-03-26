const botaoBuscar = document.getElementById("buscarCorte")
const botaoSalvar = document.getElementById("salvarProducao")
const botaoCadastrarCorte = document.getElementById("cadastrarCorte")

async function buscarCorte(numeroCorte) {
  if (!numeroCorte) {
    alert("Digite o número do corte")
    return
  }

  try {
    const resposta = await fetch(`/cortes/${numeroCorte}/resumo`)
    const dados = await resposta.json()

    if (!resposta.ok) {
      document.getElementById("produto").textContent = ""
      document.getElementById("mesa").textContent = ""
      document.getElementById("folhaParou").textContent = "0"
      document.getElementById("status").textContent = "NOVO CORTE"
      document.getElementById("folhaInicio").value = 0
      document.getElementById("historicoCorte").innerHTML = ""
      document.getElementById("novoCorte").style.display = "block"
      return
    }

    document.getElementById("novoCorte").style.display = "none"

    document.getElementById("produto").textContent = dados.corte.produto
    document.getElementById("mesa").textContent = dados.corte.mesa
    document.getElementById("folhaParou").textContent =
      dados.ultima_producao?.folha_parou ?? 0
    document.getElementById("status").textContent =
      dados.ultima_producao?.status ?? "SEM PRODUÇÃO"

    document.getElementById("folhaInicio").value =
      dados.ultima_producao?.folha_parou ?? 0

    await carregarHistorico(numeroCorte)
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
}

async function carregarHistorico(numeroCorte) {
  try {
    const respostaHistorico = await fetch(`/producao/${numeroCorte}`)
    const historico = await respostaHistorico.json()

    const tabelaHistorico = document.getElementById("historicoCorte")
    tabelaHistorico.innerHTML = ""

    historico.forEach((item) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${item.data}</td>
        <td>${item.turno}</td>
        <td>${item.operador}</td>
        <td>${item.folha_inicio}</td>
        <td>${item.folha_parou}</td>
        <td>${item.status}</td>
      `

      tabelaHistorico.appendChild(linha)
    })
  } catch (error) {
    console.error("Erro ao carregar histórico:", error)
  }
}

botaoBuscar.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorte").value
  await buscarCorte(numeroCorte)
})

botaoCadastrarCorte.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorte").value
  const produto = document.getElementById("produtoNovo").value
  const mesa = document.getElementById("mesaNova").value

  if (!numeroCorte || !produto || !mesa) {
    alert("Preencha número do corte, produto e mesa")
    return
  }

  try {
    const resposta = await fetch("/cortes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        numero: Number(numeroCorte),
        produto,
        mesa
      })
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao cadastrar corte")
      return
    }

    alert("Corte cadastrado com sucesso")

    document.getElementById("produto").textContent = produto
    document.getElementById("mesa").textContent = mesa
    document.getElementById("folhaParou").textContent = "0"
    document.getElementById("status").textContent = "SEM PRODUÇÃO"
    document.getElementById("folhaInicio").value = 0
    document.getElementById("novoCorte").style.display = "none"
    document.getElementById("produtoNovo").value = ""
    document.getElementById("mesaNova").value = ""

    await carregarCortesEmAndamento()
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
})

botaoSalvar.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorte").value
  const data = document.getElementById("data").value
  const turno = document.getElementById("turno").value
  const operador = document.getElementById("operador").value
  const folhaInicio = document.getElementById("folhaInicio").value
  const folhaParou = document.getElementById("folhaParouInput").value
  const status = document.getElementById("statusProducao").value

  if (!numeroCorte || !data || !turno || !operador || !folhaParou || !status) {
    alert("Preencha todos os campos")
    return
  }

  try {
    const resposta = await fetch("/producao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data,
        numero_corte: Number(numeroCorte),
        turno,
        operador,
        folha_inicio: Number(folhaInicio),
        folha_parou: Number(folhaParou),
        status
      })
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao salvar produção")
      return
    }

    alert("Produção cadastrada com sucesso")

    document.getElementById("folhaInicio").value = folhaParou
    document.getElementById("folhaParou").textContent = folhaParou
    document.getElementById("status").textContent = status
    document.getElementById("folhaParouInput").value = ""
    document.getElementById("operador").value = ""

    await carregarHistorico(numeroCorte)
    await carregarCortesEmAndamento()
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
})

async function carregarCortesEmAndamento() {
  try {
    const resposta = await fetch("/cortes-em-andamento")
    const cortes = await resposta.json()

    const tabela = document.getElementById("cortesEmAndamento")
    tabela.innerHTML = ""

    cortes.forEach((corte) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${corte.numero}</td>
        <td>${corte.produto}</td>
        <td>${corte.mesa}</td>
        <td>${corte.folha_parou}</td>
        <td>${corte.status}</td>
      `

      linha.style.cursor = "pointer"

      linha.addEventListener("click", async () => {
        document.getElementById("numeroCorte").value = corte.numero
        await buscarCorte(corte.numero)
      })

      tabela.appendChild(linha)
    })
  } catch (error) {
    console.error("Erro ao carregar cortes em andamento:", error)
  }
}

carregarCortesEmAndamento()
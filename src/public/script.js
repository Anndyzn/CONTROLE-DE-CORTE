const botaoBuscar = document.getElementById("buscarCorte")
const botaoSalvar = document.getElementById("salvarProducao")
const botaoCadastrarCorte = document.getElementById("cadastrarCorte")
const botaoSalvarItemCorte = document.getElementById("salvarItemCorte")
const botaoFinalizarItensCorte = document.getElementById("finalizarItensCorte")

const selectCor = document.getElementById("corItem")
const inputCorOutra = document.getElementById("corOutra")

const selectTecido = document.getElementById("tecidoItem")
const inputTecidoOutro = document.getElementById("tecidoOutro")

const selectOperador = document.getElementById("operador")
const inputOperadorOutro = document.getElementById("operadorOutro")

const selectStatusProducao = document.getElementById("statusProducao")
const blocoItensCorte = document.getElementById("blocoItensCorte")

function atualizarResumoTopo({ numero = "--", ultimaFolha = "0", status = "--", mesa = "--" }) {
  document.getElementById("resumoNumeroCorte").textContent = numero
  document.getElementById("resumoUltimaFolha").textContent = ultimaFolha
  document.getElementById("resumoMesa").textContent = mesa
  document.getElementById("resumoStatus").textContent = status
}

function renderizarStatus(status) {
  const statusEl = document.getElementById("status")

  if (status === "FINALIZADO") {
    statusEl.innerHTML = `<span class="status-badge status-finalizado">${status}</span>`
  } else if (status === "EM PRODUÇÃO") {
    statusEl.innerHTML = `<span class="status-badge status-em-producao">${status}</span>`
  } else {
    statusEl.innerHTML = `<span class="status-badge status-default">${status}</span>`
  }
}

function limparTabelaHistorico() {
  document.getElementById("historicoCorte").innerHTML = ""
}

function limparTabelaItens() {
  document.getElementById("listaItensCorte").innerHTML = ""
}

function limparCamposItens() {
  document.getElementById("modeloItem").value = ""
  document.getElementById("corItem").value = ""
  document.getElementById("corOutra").value = ""
  document.getElementById("corOutra").style.display = "none"
  document.getElementById("tecidoItem").value = ""
  document.getElementById("tecidoOutro").value = ""
  document.getElementById("tecidoOutro").style.display = "none"
  document.getElementById("metragemItem").value = ""
  document.getElementById("sobraItem").value = ""
  document.getElementById("perdaItem").value = ""
  document.getElementById("quantidadeItem").value = ""
}

function habilitarProducao() {
  botaoSalvar.disabled = false
  document.getElementById("data").disabled = false
  document.getElementById("turno").disabled = false
  document.getElementById("operador").disabled = false
  document.getElementById("operadorOutro").disabled = false
  document.getElementById("folhaParouInput").disabled = false
  document.getElementById("statusProducao").disabled = false
}

function desabilitarProducao() {
  botaoSalvar.disabled = true
  document.getElementById("data").disabled = true
  document.getElementById("turno").disabled = true
  document.getElementById("operador").disabled = true
  document.getElementById("operadorOutro").disabled = true
  document.getElementById("folhaParouInput").disabled = true
  document.getElementById("statusProducao").disabled = true
}

function habilitarItens() {
  botaoSalvarItemCorte.disabled = false
  botaoFinalizarItensCorte.disabled = false
}

function desabilitarItens() {
  botaoSalvarItemCorte.disabled = true
  botaoFinalizarItensCorte.disabled = true
}

async function carregarFinalizacaoItens(numeroCorte) {
  try {
    const resposta = await fetch(`/cortes/${numeroCorte}/finalizacao-itens`)
    const dados = await resposta.json()

    if (!resposta.ok) {
      return false
    }

    return dados.itens_finalizados === 1
  } catch (error) {
    console.error("Erro ao buscar finalização dos itens:", error)
    return false
  }
}

async function buscarCorte(numeroCorte) {
  blocoItensCorte.style.display = "none"
  document.getElementById("statusProducao").value = ""

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
      renderizarStatus("NOVO CORTE")
      document.getElementById("folhaInicio").value = 0

      atualizarResumoTopo({
        numero: numeroCorte,
        ultimaFolha: "0",
        status: "NOVO CORTE",
        mesa: "--"
      })

      limparTabelaHistorico()
      limparTabelaItens()
      limparCamposItens()

      document.getElementById("novoCorte").style.display = "block"

      habilitarProducao()
      habilitarItens()

      return
    }

    document.getElementById("novoCorte").style.display = "none"

    const statusAtual = dados.ultima_producao?.status ?? "SEM PRODUÇÃO"
    const ultimaFolha = dados.ultima_producao?.folha_parou ?? 0

    document.getElementById("produto").textContent = dados.corte.produto
    document.getElementById("mesa").textContent = dados.corte.mesa
    document.getElementById("folhaParou").textContent = ultimaFolha
    renderizarStatus(statusAtual)

    document.getElementById("folhaInicio").value = ultimaFolha

    atualizarResumoTopo({
      numero: numeroCorte,
      ultimaFolha: String(ultimaFolha),
      status: statusAtual,
      mesa: dados.corte.mesa
    })

    await carregarHistorico(numeroCorte)
    const quantidadeItens = await carregarItensCorte(numeroCorte)
    const itensJaFinalizados = await carregarFinalizacaoItens(numeroCorte)

    const producaoFinalizada = statusAtual === "FINALIZADO"

    if (producaoFinalizada) {
      desabilitarProducao()
    } else {
      habilitarProducao()
    }

    if (itensJaFinalizados) {
      desabilitarItens()
    } else {
      habilitarItens()
    }

    if (producaoFinalizada || quantidadeItens > 0) {
      blocoItensCorte.style.display = "block"
    } else {
      blocoItensCorte.style.display = "none"
    }
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
}

function calcularDuracao(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return "-"

  const [horaIni, minIni] = horaInicio.split(":").map(Number)
  const [horaFimNum, minFim] = horaFim.split(":").map(Number)

  const inicioEmMinutos = horaIni * 60 + minIni
  const fimEmMinutos = horaFimNum * 60 + minFim

  let diferenca = fimEmMinutos - inicioEmMinutos

  if (diferenca < 0) {
    return "-"
  }

  const horas = Math.floor(diferenca / 60)
  const minutos = diferenca % 60

  return `${horas}h ${minutos}min`
}

async function carregarHistorico(numeroCorte) {
  try {
    const respostaHistorico = await fetch(`/producao/${numeroCorte}`)
    const historico = await respostaHistorico.json()

    const tabelaHistorico = document.getElementById("historicoCorte")
    tabelaHistorico.innerHTML = ""

    historico.forEach((item) => {
      const linha = document.createElement("tr")
      const duracao = calcularDuracao(item.hora_inicio, item.hora_fim)

      linha.innerHTML = `
        <td>${item.data}</td>
        <td>${item.turno}</td>
        <td>${item.operador}</td>
        <td>${item.hora_inicio ?? "-"}</td>
        <td>${item.hora_fim ?? "-"}</td>
        <td>${duracao}</td>
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

async function carregarItensCorte(numeroCorte) {
  try {
    const resposta = await fetch(`/itens-corte/${numeroCorte}`)
    const itens = await resposta.json()

    const tabela = document.getElementById("listaItensCorte")
    tabela.innerHTML = ""

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

    return itens.length
  } catch (error) {
    console.error("Erro ao carregar itens do corte:", error)
    return 0
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
    renderizarStatus("SEM PRODUÇÃO")
    document.getElementById("folhaInicio").value = 0
    document.getElementById("novoCorte").style.display = "none"
    document.getElementById("produtoNovo").value = ""
    document.getElementById("mesaNova").value = ""

    atualizarResumoTopo({
      numero: numeroCorte,
      ultimaFolha: "0",
      status: "SEM PRODUÇÃO",
      mesa
    })

    habilitarProducao()
    habilitarItens()
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
  let operador = document.getElementById("operador").value

  if (operador === "OUTRO") {
    operador = document.getElementById("operadorOutro").value.trim()
  }

  const horaInicio = document.getElementById("horaInicio").value
  const horaFim = document.getElementById("horaFim").value
  const folhaInicio = document.getElementById("folhaInicio").value
  const folhaParou = document.getElementById("folhaParouInput").value
  const status = document.getElementById("statusProducao").value

  if (
    !numeroCorte ||
    !data ||
    !turno ||
    !operador ||
    !horaInicio ||
    !horaFim ||
    !folhaParou ||
    !status
  ) {
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
        hora_inicio: horaInicio,
        hora_fim: horaFim,
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
    renderizarStatus(status)

    document.getElementById("folhaParouInput").value = ""
    document.getElementById("horaInicio").value = ""
    document.getElementById("horaFim").value = ""
    document.getElementById("operador").value = ""
    document.getElementById("operadorOutro").value = ""
    document.getElementById("operadorOutro").style.display = "none"

    atualizarResumoTopo({
      numero: numeroCorte,
      ultimaFolha: folhaParou,
      status,
      mesa: document.getElementById("mesa").textContent || "--"
    })

    await carregarHistorico(numeroCorte)
    await carregarCortesEmAndamento()

    if (status === "FINALIZADO") {
      blocoItensCorte.style.display = "block"
      desabilitarProducao()
    }
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
})

botaoSalvarItemCorte.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorte").value
  const modelo = document.getElementById("modeloItem").value.trim()

  let cor = document.getElementById("corItem").value
  if (cor === "OUTRA") {
    cor = document.getElementById("corOutra").value.trim()
  }

  let tecido = document.getElementById("tecidoItem").value
  if (tecido === "OUTRA") {
    tecido = document.getElementById("tecidoOutro").value.trim()
  }

  const metragem = document.getElementById("metragemItem").value
  const sobra = document.getElementById("sobraItem").value
  const perda = document.getElementById("perdaItem").value
  const quantidade = document.getElementById("quantidadeItem").value

  if (!numeroCorte || !modelo || !cor || !tecido || !quantidade) {
    alert("Preencha modelo, cor, tecido e quantidade de peças")
    return
  }

  if (metragem === "") {
    alert("Informe a metragem usada. Se for aproveitamento, digite 0")
    return
  }

  try {
    const resposta = await fetch("/itens-corte", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        numero_corte: Number(numeroCorte),
        modelo,
        cor,
        tecido,
        metragem_usada: Number(metragem),
        sobra_metros: Number(sobra || 0),
        perda_metros: Number(perda || 0),
        quantidade_pecas: Number(quantidade)
      })
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao salvar item do corte")
      return
    }

    alert("Item do corte cadastrado com sucesso")

    limparCamposItens()
    await carregarItensCorte(numeroCorte)
  } catch (error) {
    alert("Erro ao conectar com o servidor")
    console.error(error)
  }
})

botaoFinalizarItensCorte.addEventListener("click", async () => {
  const numeroCorte = document.getElementById("numeroCorte").value

  if (!numeroCorte) {
    alert("Busque um corte antes")
    return
  }

  try {
    const resposta = await fetch(`/cortes/${numeroCorte}/finalizar-itens`, {
      method: "POST"
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao finalizar itens do corte")
      return
    }

    alert("Itens do corte registrados e finalizados com sucesso")

    desabilitarItens()
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
      const statusClasse =
        corte.status === "FINALIZADO"
          ? "status-badge status-finalizado"
          : corte.status === "EM PRODUÇÃO"
          ? "status-badge status-em-producao"
          : "status-badge status-default"

      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td>${corte.numero}</td>
        <td>${corte.produto}</td>
        <td>${corte.mesa}</td>
        <td>${corte.folha_parou}</td>
        <td><span class="${statusClasse}">${corte.status}</span></td>
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

// COR
selectCor.addEventListener("change", () => {
  inputCorOutra.style.display = selectCor.value === "OUTRA" ? "block" : "none"
})

// TECIDO
selectTecido.addEventListener("change", () => {
  inputTecidoOutro.style.display = selectTecido.value === "OUTRA" ? "block" : "none"
})

// OPERADOR
selectOperador.addEventListener("change", () => {
  inputOperadorOutro.style.display = selectOperador.value === "OUTRO" ? "block" : "none"
})

// STATUS
selectStatusProducao.addEventListener("change", () => {
  if (selectStatusProducao.value === "FINALIZADO") {
    blocoItensCorte.style.display = "block"
  } else {
    blocoItensCorte.style.display = "none"
  }
})

atualizarResumoTopo({})
carregarCortesEmAndamento()
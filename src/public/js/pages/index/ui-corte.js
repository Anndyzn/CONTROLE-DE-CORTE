export function renderizarStatus(status) {
  const statusEl = document.getElementById("status")

  if (status === "FINALIZADO") {
    statusEl.innerHTML =
      `<span class="status-badge status-finalizado">${status}</span>`

  } else if (status === "EM PRODUÇÃO") {
    statusEl.innerHTML =
      `<span class="status-badge status-em-producao">${status}</span>`

  } else {
    statusEl.innerHTML =
      `<span class="status-badge status-default">${status}</span>`
  }
}

export function limparTabelaHistorico() {
  document.getElementById("historicoCorte").innerHTML = ""
}

export function limparTabelaItens() {
  document.getElementById("listaItensCorte").innerHTML = ""
}

export function limparCamposItens() {
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
  document.getElementById("metrosFaltantesItem").value = ""
  document.getElementById("quantidadeItem").value = ""
}

export function habilitarProducao() {

  const campoData =
    document.getElementById("data")

  if (campoData && !campoData.value) {
    const hoje = new Date()

    const ano =
      hoje.getFullYear()

    const mes =
      String(
        hoje.getMonth() + 1
      ).padStart(2, "0")

    const dia =
      String(
        hoje.getDate()
      ).padStart(2, "0")

    campoData.value =
      `${ano}-${mes}-${dia}`
  }

    document.getElementById(
      "salvarProducao"
    ).disabled = false

  document.getElementById("salvarProducao").disabled = false
  document.getElementById("data").disabled = false
  document.getElementById("turno").disabled = false
  document.getElementById("operador").disabled = false
  document.getElementById("operadorOutro").disabled = false
  document.getElementById("horaInicio").disabled = false
  document.getElementById("horaFim").disabled = false
  document.getElementById("folhaParouInput").disabled = false
  document.getElementById("statusProducao").disabled = false

  const aviso =
    document.getElementById("producaoAviso")

  if (aviso) {
    aviso.style.display = "none"
  }

  document
    .querySelector(".producao-card")
    ?.classList.remove("producao-bloqueada")
}

export function desabilitarProducao(
  motivo = "SEM_CORTE"
) {
  document.getElementById(
    "salvarProducao"
  ).disabled = true

  document.getElementById(
    "data"
  ).disabled = true

  document.getElementById(
    "turno"
  ).disabled = true

  document.getElementById(
    "operador"
  ).disabled = true

  document.getElementById(
    "operadorOutro"
  ).disabled = true

  document.getElementById(
    "horaInicio"
  ).disabled = true

  document.getElementById(
    "horaFim"
  ).disabled = true

  document.getElementById(
    "folhaParouInput"
  ).disabled = true

  document.getElementById(
    "statusProducao"
  ).disabled = true


  const aviso =
    document.getElementById(
      "producaoAviso"
    )


  if (aviso) {

    if (motivo === "FINALIZADO") {
      aviso.innerHTML = `
        <strong>✓ Corte finalizado</strong>
        <br>
        Novos lançamentos de produção estão bloqueados.
      `
    }

    else if (motivo === "NOVO_CORTE") {
      aviso.innerHTML = `
        <strong>Novo corte ainda não cadastrado</strong>
        <br>
        Informe o produto e a mesa e conclua o cadastro para liberar a produção.
      `
    }

    else {
      aviso.innerHTML = `
        Selecione um corte em andamento
        ou busque pelo número para registrar a produção.
      `
    }

    aviso.style.display = "block"
  }


  document
    .querySelector(
      ".producao-card"
    )
    ?.classList.add(
      "producao-bloqueada"
    )
}

export function habilitarItens() {
  const botaoSalvar =
    document.getElementById("salvarItemCorte")

  const botaoFinalizar =
    document.getElementById("finalizarItensCorte")

  const formulario =
    document.getElementById("formItensCorte")

  const aviso =
    document.getElementById("itensFinalizadosAviso")


  if (botaoSalvar) {
    botaoSalvar.disabled = false
  }

  if (botaoFinalizar) {
    botaoFinalizar.disabled = false
  }

  if (formulario) {
    formulario.style.display = "block"
  }

  if (aviso) {
    aviso.style.display = "none"
  }
}

export function desabilitarItens() {
  const botaoSalvar =
    document.getElementById("salvarItemCorte")

  const botaoFinalizar =
    document.getElementById("finalizarItensCorte")

  const formulario =
    document.getElementById("formItensCorte")

  const aviso =
    document.getElementById("itensFinalizadosAviso")


  if (botaoSalvar) {
    botaoSalvar.disabled = true
  }

  if (botaoFinalizar) {
    botaoFinalizar.disabled = true
  }

  // Esconde formulário e botões
  if (formulario) {
    formulario.style.display = "none"
  }

  // Mostra aviso de conclusão
  if (aviso) {
    aviso.style.display = "flex"
  }
}
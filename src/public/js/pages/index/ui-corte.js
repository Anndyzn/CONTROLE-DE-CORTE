export function atualizarResumoTopo({
  numero = "--",
  ultimaFolha = "0",
  status = "--",
  mesa = "--"
}) {
  document.getElementById("resumoNumeroCorte").textContent = numero
  document.getElementById("resumoUltimaFolha").textContent = ultimaFolha
  document.getElementById("resumoMesa").textContent = mesa
  document.getElementById("resumoStatus").textContent = status
}

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
  document.getElementById("salvarProducao").disabled = false
  document.getElementById("data").disabled = false
  document.getElementById("turno").disabled = false
  document.getElementById("operador").disabled = false
  document.getElementById("operadorOutro").disabled = false
  document.getElementById("folhaParouInput").disabled = false
  document.getElementById("statusProducao").disabled = false
}

export function desabilitarProducao() {
  document.getElementById("salvarProducao").disabled = true
  document.getElementById("data").disabled = true
  document.getElementById("turno").disabled = true
  document.getElementById("operador").disabled = true
  document.getElementById("operadorOutro").disabled = true
  document.getElementById("folhaParouInput").disabled = true
  document.getElementById("statusProducao").disabled = true
}

export function habilitarItens() {
  document.getElementById("salvarItemCorte").disabled = false
  document.getElementById("finalizarItensCorte").disabled = false
}

export function desabilitarItens() {
  document.getElementById("salvarItemCorte").disabled = true
  document.getElementById("finalizarItensCorte").disabled = true
}
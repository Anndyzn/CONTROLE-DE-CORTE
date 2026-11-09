import { apiGet, apiPut } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { confirmarAcao } from "../../core/confirmacao.js"
import { inicializarTabelasResponsivas } from "../../core/tabelas.js"
import { baixarGuiaSankhya } from "./exportar.js"

const el = id => document.getElementById(id)
let dados = null, ocupado = false, alterado = false, itemAtual = 0, sequenciaCampo = 0
const numero = valor => Number(valor).toLocaleString("pt-BR", {maximumFractionDigits: 2})
function atualizarExportacao() {
  const botao = el("exportarGuiaSankhya")
  if (botao) botao.disabled = ocupado || alterado || !dados?.completa
}
function texto(tag, valor, classe) {
  const elemento = document.createElement(tag)
  elemento.textContent = valor
  if (classe) elemento.className = classe
  return elemento
}
function bloquear(ativo) {
  ocupado = ativo
  el("camposBuscaSankhya").disabled = ativo
  el("camposCorrespondenciaSankhya").disabled = ativo
  el("conferenciaSankhya").setAttribute("aria-busy", String(ativo))
  atualizarExportacao()
}
async function podeDescartar() {
  return !alterado || await confirmarAcao("Descartar as alterações ainda não salvas nesta correspondência?", {titulo: "Alterações pendentes", confirmar: "Descartar"})
}
function adicionarDestino(destino = {}) {
  const linha = document.createElement("div")
  linha.className = "sankhya-destino"
  for (const [campo, rotulo, tipo, maximo] of [
    ["codigo_produto", "Código do produto", "number", 2147483647],
    ["produto", "Nome do produto no Sankhya", "text", 200],
    ["controle", "Controle (cor) no Sankhya", "text", 100]
  ]) {
    const grupo = document.createElement("div")
    grupo.className = "form-group"
    const input = document.createElement("input")
    input.id = `destinoSankhya${++sequenciaCampo}`
    input.dataset.campo = campo
    input.type = tipo
    input.required = true
    if (tipo === "number") { input.min = "1"; input.max = String(maximo); input.step = "1" }
    else input.maxLength = maximo
    input.value = destino[campo] ?? ""
    const label = texto("label", rotulo)
    label.htmlFor = input.id
    grupo.append(label, input)
    linha.append(grupo)
  }
  const remover = texto("button", "Remover", "btn-secondary")
  remover.type = "button"
  remover.addEventListener("click", () => {
    if (ocupado) return
    linha.remove(); alterado = true; atualizarLimite()
  })
  linha.append(remover)
  el("destinosSankhya").append(linha)
  atualizarLimite()
}
function atualizarLimite() {
  el("adicionarDestinoSankhya").disabled = el("destinosSankhya").children.length >= 10
  atualizarExportacao()
}
function abrirItem(indice) {
  itemAtual = indice
  const item = dados.itens[indice]
  el("itemSankhya").value = String(indice)
  el("origemSankhya").textContent = `${item.modelo} · ${item.cor} · ${item.tecido} — ${numero(item.quantidade_pecas)} peças; metragem total: ${numero(item.metragem_usada)} m.`
  el("destinosSankhya").replaceChildren()
  for (const destino of item.correspondencia?.destinos ?? [{}]) adicionarDestino(destino)
  alterado = false
  atualizarExportacao()
}
function renderizar() {
  el("tituloConferenciaSankhya").textContent = `Corte ${dados.corte.numero} — ${dados.corte.produto}`
  const pendentes = dados.itens.filter(item => item.pendencias.length).length
  el("resumoConferenciaSankhya").textContent = `${dados.total_ops} OP(s) previstas com as correspondências atuais. ${pendentes ? `${pendentes} item(ns) precisam de conferência.` : "Todos os itens possuem correspondência cadastrada."} Confira as OPs já existentes no ERP antes de lançar.`
  el("linhasConferenciaSankhya").replaceChildren()
  el("itemSankhya").replaceChildren()
  dados.itens.forEach((item, indice) => {
    const opcao = texto("option", `Item ${item.id} — ${item.modelo} · ${item.cor} · ${item.tecido}`)
    opcao.value = String(indice)
    el("itemSankhya").append(opcao)
    for (const ordem of item.ordens.length ? item.ordens : [null]) {
      const linha = document.createElement("tr")
      const valores = [`Item ${item.id} — ${item.modelo} · ${item.cor} · ${item.tecido}`,
        ordem ? `${ordem.codigo_produto} — ${ordem.produto}` : "—", ordem?.controle ?? "—",
        ordem ? numero(ordem.quantidade) : numero(item.quantidade_pecas),
        ordem ? "Correspondência cadastrada" : item.pendencias.join(" ")]
      for (const valor of valores) linha.append(texto("td", valor))
      if (!ordem) linha.className = "sankhya-pendente"
      el("linhasConferenciaSankhya").append(linha)
    }
  })
  el("conferenciaSankhya").hidden = false
  el("editorSankhya").hidden = false
  abrirItem(Math.min(itemAtual, dados.itens.length - 1))
}
async function carregarConferencia(numeroCorte) {
  dados = await apiGet(`/sankhya/cortes/${encodeURIComponent(numeroCorte)}/conferencia`)
  renderizar()
  el("estadoSankhya").textContent = "Conferência carregada. Confira os códigos e controles no ERP antes de lançar."
}
async function buscar() {
  if (ocupado || !el("formBuscarSankhya").reportValidity()) return
  bloquear(true)
  try {
    if (!await podeDescartar()) return
    alterado = false; itemAtual = 0; dados = null
    el("conferenciaSankhya").hidden = true
    el("editorSankhya").hidden = true
    el("estadoSankhya").textContent = "Consultando corte e correspondências..."
    await carregarConferencia(el("numeroSankhya").value)
  } catch (erro) {
    el("estadoSankhya").textContent = erro.message
    mostrarToast(erro.message, "erro", "Conferência indisponível")
  } finally { bloquear(false) }
}
async function salvar(evento) {
  evento.preventDefault()
  if (ocupado || !dados || !el("formCorrespondenciaSankhya").reportValidity()) return
  const item = dados.itens[itemAtual]
  const destinos = Array.from(el("destinosSankhya").children).map(linha => {
    const campos = Object.fromEntries(Array.from(linha.querySelectorAll("input")).map(input => [input.dataset.campo, input.value.trim()]))
    return {...campos, codigo_produto: Number(campos.codigo_produto)}
  })
  if (!destinos.length) { mostrarToast("Adicione pelo menos um produto de destino.", "atencao"); return }
  bloquear(true)
  let salva = false
  try {
    if (!await confirmarAcao("Salvar esta correspondência para todos os cortes com o mesmo modelo, tecido e cor?", {titulo: "Salvar correspondência", confirmar: "Salvar"})) return
    const resultado = await apiPut("/sankhya/correspondencias", {
      modelo: item.modelo, tecido: item.tecido, cor: item.cor,
      destinos, versao: item.correspondencia?.versao ?? 0
    })
    item.correspondencia = {...item.correspondencia, destinos, versao: resultado.versao}
    alterado = false; salva = true
    // Depois de salvar, a conferência sempre é recalculada com o corte atual no servidor.
    el("conferenciaSankhya").hidden = true
    el("editorSankhya").hidden = true
    await carregarConferencia(dados.corte.numero)
    mostrarToast("Correspondência salva. Confira as OPs previstas.", "sucesso")
  } catch (erro) {
    const mensagem = salva ? `Correspondência salva, mas a conferência não foi atualizada: ${erro.message} Consulte o corte novamente.` : erro.message
    el("estadoSankhya").textContent = mensagem
    mostrarToast(mensagem, "erro", "Atenção")
  } finally { bloquear(false) }
}

export function inicializarSankhya() {
  inicializarTabelasResponsivas()
  el("formBuscarSankhya").addEventListener("submit", evento => { evento.preventDefault(); return buscar() })
  el("recentesSankhya").addEventListener("change", () => {
    if (!ocupado && el("recentesSankhya").value) { el("numeroSankhya").value = el("recentesSankhya").value; return buscar() }
  })
  el("itemSankhya").addEventListener("change", async () => {
    if (ocupado || !dados) return
    const indice = Number(el("itemSankhya").value)
    bloquear(true)
    try { if (await podeDescartar()) abrirItem(indice); else el("itemSankhya").value = String(itemAtual) }
    finally { bloquear(false) }
  })
  el("adicionarDestinoSankhya").addEventListener("click", () => {
    if (!ocupado && el("destinosSankhya").children.length < 10) { adicionarDestino(); alterado = true; atualizarExportacao() }
  })
  el("formCorrespondenciaSankhya").addEventListener("input", () => { alterado = true; atualizarExportacao() })
  el("formCorrespondenciaSankhya").addEventListener("submit", salvar)
  el("exportarGuiaSankhya")?.addEventListener("click", async () => {
    if (ocupado || alterado || !dados?.completa) return
    bloquear(true)
    try {
      await baixarGuiaSankhya(dados.corte.numero)
      mostrarToast("Guia gerado. Use-o para conferir e lançar as OPs manualmente no Sankhya.", "sucesso")
    } catch (erro) {
      mostrarToast(erro.message, "erro", "Guia indisponível")
    } finally { bloquear(false) }
  })
  window.addEventListener("beforeunload", evento => { if (alterado || ocupado) { evento.preventDefault(); evento.returnValue = "" } })
  apiGet("/sankhya/cortes").then(cortes => {
    el("recentesSankhya").replaceChildren(texto("option", cortes.length ? "Selecione um corte" : "Nenhum corte disponível"))
    el("recentesSankhya").firstElementChild.value = ""
    for (const corte of cortes) {
      const opcao = texto("option", `${corte.numero} — ${corte.produto}`)
      opcao.value = String(corte.numero)
      el("recentesSankhya").append(opcao)
    }
  }).catch(() => {
    el("recentesSankhya").replaceChildren(texto("option", "Lista indisponível. Busque pelo número."))
    el("recentesSankhya").firstElementChild.value = ""
  })
}

inicializarSankhya()

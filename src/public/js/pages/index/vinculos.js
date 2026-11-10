import { apiGet } from "../../core/api.js"

let consultaAtual = 0
let ultimoContexto = null
const texto = (tag, valor, classe) => {
  const elemento = document.createElement(tag)
  elemento.textContent = valor
  if (classe) elemento.className = classe
  return elemento
}

export async function atualizarVinculosPIs(numero, itens, linhas, {aindaAtual = () => true} = {}) {
  const consulta = ++consultaAtual
  ultimoContexto = itens.length ? {numero, itens, linhas, aindaAtual} : null
  const resumo = document.getElementById("resumoVinculosPIs")
  if (!resumo) return
  if (!itens.length) { resumo.textContent = "Cadastre os PIs para consultar seus vínculos com o Sankhya."; return }
  resumo.textContent = "Consultando os produtos Sankhya vinculados aos PIs..."
  const estados = itens.map((item, indice) => {
    const bloco = document.createElement("div")
    bloco.className = "pi-vinculo-sankhya"
    const estado = texto("span", "Consultando vínculo…")
    const link = texto("a", "Conferir vínculo ↗")
    link.href = `sankhya.html?${new URLSearchParams({corte: String(numero), item: String(item.id)})}`
    link.target = "_blank"; link.rel = "noopener noreferrer"
    link.setAttribute("aria-label", `Conferir vínculo do PI ${item.modelo}, cor ${item.cor}, com o Sankhya em nova aba`)
    const detalhes = document.createElement("div")
    bloco.append(estado, detalhes, link)
    const celula = linhas[indice]?.cells?.[0]
    celula?.querySelector?.(".pi-vinculo-sankhya")?.remove()
    celula?.append(bloco)
    return {item, estado, detalhes, link}
  })
  const atual = () => consulta === consultaAtual && aindaAtual()
  try {
    const dados = await apiGet(`/sankhya/cortes/${encodeURIComponent(numero)}/vinculos`)
    if (!atual()) return
    const porId = new Map(dados.itens.map(item => [String(item.id), item]))
    let vinculados = 0
    for (const {item, estado, detalhes, link} of estados) {
      const atualItem = porId.get(String(item.id))
      // A linha pode ter sido corrigida entre as duas consultas; não mostrar o vínculo de outra grafia.
      if (!atualItem || ["modelo", "tecido", "cor"].some(campo => atualItem[campo] !== item[campo])) {
        estado.textContent = "Item alterado. Consulte o corte novamente."
        continue
      }
      const destinos = atualItem.correspondencia?.destinos
      if (destinos?.length && atualItem.pendencias?.length) {
        estado.textContent = "Vínculo precisa de revisão"
        estado.className = "pi-vinculo-pendente"
        link.textContent = "Revisar vínculo ↗"
        detalhes.append(texto("span", atualItem.pendencias.join(" ")))
        continue
      }
      if (destinos?.length) {
        vinculados++
        estado.textContent = `${destinos.length} produto(s) vinculado(s) ao Sankhya`
        estado.className = "pi-vinculo-cadastrado"
        const expansivel = document.createElement("details")
        expansivel.append(texto("summary", "Ver produtos vinculados"))
        const lista = document.createElement("ul")
        for (const destino of destinos) lista.append(texto("li", `${destino.codigo_produto} — ${destino.produto} · ${destino.controle || "Sem controle"}`))
        expansivel.append(lista); detalhes.append(expansivel)
      } else {
        estado.textContent = "Falta vincular ao Sankhya"
        estado.className = "pi-vinculo-pendente"
        link.textContent = "Vincular produtos ↗"
      }
    }
    resumo.textContent = `${vinculados} de ${itens.length} PI(s) com correspondência cadastrada. O vínculo não informa se a OP já foi lançada no ERP.`
  } catch {
    if (!atual()) return
    resumo.textContent = "Os PIs foram carregados, mas não foi possível consultar os vínculos. Use Conferir vínculo para tentar novamente."
    for (const {estado} of estados) estado.textContent = "Vínculo indisponível no momento"
  }
}

export function inicializarVinculosPIs() {
  window.addEventListener("focus", () => {
    const contexto = ultimoContexto
    const painel = document.getElementById("blocoItensCorte")
    if (contexto && contexto.aindaAtual() && painel && painel.style.display !== "none") {
      return atualizarVinculosPIs(contexto.numero, contexto.itens, contexto.linhas, {aindaAtual: contexto.aindaAtual})
    }
  })
}

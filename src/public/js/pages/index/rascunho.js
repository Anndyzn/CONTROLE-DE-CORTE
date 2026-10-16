import { Rascunhos } from "../../utils/rascunhos.js"
import { mostrarToast } from "../../core/ui.js"
import { apiGet } from "../../core/api.js"
import { atualizarControleMesas } from "./mesas.js"
import { confirmarAcao } from "../../core/confirmacao.js"

const campos = {
  novo: ["produtoNovo", "mesaNova"],
  producao: ["data", "turno", "operador", "operadorOutro", "horaInicio", "horaFim", "folhaParouInput", "statusProducao"],
  item: ["itemEditandoId", "modeloItem", "corItem", "corOutra", "tecidoItem", "tecidoOutro", "metragemItem", "sobraItem", "perdaItem", "metrosFaltantesItem", "quantidadeItem"]
}
let contexto = null, baseItem = null, restaurando = false, abrirCorte = null
const elemento = id => document.getElementById(id)
const armazenamento = () => new Rascunhos(localStorage)

function falhaArmazenamento() {
  const aviso = elemento("avisoRascunho")
  if (!aviso) return
  aviso.hidden = false
  elemento("estadoRascunho").textContent = "Não foi possível salvar ou ler o rascunho neste navegador. Os campos continuam disponíveis para envio."
  elemento("acoesRascunho").hidden = true
}

export function atualizarAvisoRascunho() {
  const aviso = elemento("avisoRascunho")
  if (!aviso) return
  try {
    const cortes = Object.values(armazenamento().ler()).sort((a,b) => String(b.salvoEm).localeCompare(String(a.salvoEm)))
    aviso.hidden = !cortes.length
    elemento("acoesRascunho").hidden = !cortes.length
    const select = elemento("rascunhoSelecionado")
    const selecionado = select.value
    select.replaceChildren()
    for (const corte of cortes) {
      const opcao = document.createElement("option")
      opcao.value = corte.numero
      opcao.textContent = `Corte ${corte.numero}${corte.novo ? " (novo)" : ""}`
      select.append(opcao)
    }
    if (cortes.some(c => c.numero === selecionado)) select.value = selecionado
    elemento("estadoRascunho").textContent = "Rascunho salvo neste navegador. Os dados ainda precisam ser conferidos e enviados."
  } catch { falhaArmazenamento() }
}

export function selecionarContextoRascunho(novoContexto) {
  contexto = novoContexto
  baseItem = null
  atualizarAvisoRascunho()
}

export function definirBaseItemRascunho(item) { baseItem = {...item} }

export function atualizarBaseProducaoRascunho(numero, id) {
  if (String(contexto?.numero) === String(numero)) contexto.ultimaProducaoId = id
}

export function salvarRascunhoGrupo(grupo) {
  if (restaurando || !contexto || !campos[grupo]) return
  if (contexto.novo !== (grupo === "novo")) return
  const valores = Object.fromEntries(campos[grupo].map(id => [id, elemento(id)?.value ?? ""]))
  try {
    armazenamento().salvar(String(contexto.numero), contexto.novo, grupo, valores,
      grupo === "producao" ? {id:String(contexto.ultimaProducaoId ?? ""), folha:Number(elemento("folhaInicio")?.value || 0)}
        : grupo === "item" ? baseItem : null)
    atualizarAvisoRascunho()
  } catch { falhaArmazenamento() }
}

export function versaoRascunho(grupo, numero = contexto?.numero) {
  try {
    const rascunho = armazenamento().ler()[numero]?.grupos[grupo]
    if (!rascunho || !campos[grupo].every(id => (elemento(id)?.value ?? "") === rascunho.campos[id])) return null
    return rascunho.versao
  } catch { return null }
}

export function limparRascunhoGrupo(grupo, numero = contexto?.numero, versao) {
  if (!numero) return
  try {
    armazenamento().excluirGrupo(String(numero), grupo, versao)
    atualizarAvisoRascunho()
  } catch { falhaArmazenamento() }
}

function aplicarCampos(grupo, valores) {
  for (const id of campos[grupo]) {
    const campo = elemento(id)
    if (campo && typeof valores?.[id] === "string" && valores[id].length <= 2000) campo.value = valores[id]
  }
}

export async function restaurarRascunho() {
  if (restaurando || !abrirCorte) return
  const numero = elemento("rascunhoSelecionado").value
  const botao = elemento("restaurarRascunho")
  try {
    const rascunho = armazenamento().ler()[numero]
    if (!rascunho) return
    restaurando = true
    botao.disabled = true
    elemento("numeroCorte").value = numero
    const atual = await abrirCorte(numero)
    if (!atual) throw new Error("Não foi possível abrir o corte. O rascunho foi mantido.")
    if (Boolean(atual.novo) !== rascunho.novo) {
      throw new Error(rascunho.novo ? "Esse número de corte já foi cadastrado. O rascunho foi mantido para conferência."
        : "O corte não está mais disponível. O rascunho foi mantido.")
    }
    const avisos = []
    let restaurados = 0
    if (rascunho.novo && rascunho.grupos.novo) {
      aplicarCampos("novo", rascunho.grupos.novo.campos)
      atualizarControleMesas()
      restaurados++
    }
    const producao = rascunho.grupos.producao
    if (!rascunho.novo && producao) {
      if (atual.ultima_producao?.status === "FINALIZADO") avisos.push("A produção já foi finalizada.")
      else if (String(atual.ultima_producao?.id ?? "") !== (typeof producao.base === "string" ? producao.base : producao.base?.id)
        || (producao.base && typeof producao.base === "object" && Number(atual.ultima_producao?.folha_parou ?? 0) !== producao.base.folha)) {
        avisos.push("Há um lançamento mais recente ou a última folha foi corrigida. Os campos de produção não foram restaurados.")
      } else {
        aplicarCampos("producao", producao.campos)
        elemento("operadorOutro").style.display = elemento("operador").value === "OUTRO" ? "block" : "none"
        restaurados++
      }
    }
    const item = rascunho.grupos.item
    if (!rascunho.novo && item) {
      const finalizacao = await apiGet(`/cortes/${numero}/finalizacao-itens`)
      let seguro = Number(finalizacao.itens_finalizados) !== 1
      if (seguro && item.campos?.itemEditandoId) {
        const itens = await apiGet(`/itens-corte/${numero}`)
        const registro = itens.find(i => String(i.id) === item.campos.itemEditandoId)
        seguro = Boolean(registro && item.base && Object.keys(item.base).every(chave => String(item.base[chave]) === String(registro[chave])))
      }
      if (!seguro) avisos.push("Os PIs foram registrados ou o item editado mudou. O rascunho do PI foi mantido sem preencher os campos.")
      else {
        aplicarCampos("item", item.campos)
        baseItem = item.base
        elemento("corOutra").style.display = elemento("corItem").value === "OUTRA" ? "block" : "none"
        elemento("tecidoOutro").style.display = elemento("tecidoItem").value === "OUTRA" ? "block" : "none"
        elemento("salvarItemCorte").textContent = item.campos.itemEditandoId ? "Atualizar item do corte" : "Salvar item do corte"
        elemento("blocoItensCorte").style.display = "block"
        restaurados++
      }
    }
    const mensagem = [restaurados ? "Rascunho restaurado. Confira os campos antes de salvar." : "Nenhum campo foi restaurado.", ...avisos].join(" ")
    mostrarToast(mensagem, avisos.length ? "atencao" : "sucesso", "Rascunho", 9000)
  } catch (erro) {
    mostrarToast(erro.message || "Não foi possível restaurar o rascunho.", "atencao", "Rascunho", 9000)
  } finally {
    restaurando = false
    botao.disabled = false
    atualizarAvisoRascunho()
  }
}

export function inicializarRascunhos(buscarCorte) {
  abrirCorte = buscarCorte
  for (const [grupo, ids] of Object.entries(campos)) {
    for (const id of ids) for (const evento of ["input", "change"]) {
      elemento(id)?.addEventListener(evento, () => salvarRascunhoGrupo(grupo))
    }
  }
  elemento("restaurarRascunho")?.addEventListener("click", restaurarRascunho)
  elemento("descartarRascunho")?.addEventListener("click", async () => {
    const numero = elemento("rascunhoSelecionado").value
    if (!await confirmarAcao("Descartar o rascunho selecionado? Os dados já enviados ao sistema serão mantidos.",
      {titulo: "Descartar rascunho", confirmar: "Descartar", perigosa: true})) return
    try {
      armazenamento().excluir(numero)
      atualizarAvisoRascunho()
    } catch { falhaArmazenamento() }
  })
  window.addEventListener("storage", atualizarAvisoRascunho)
  atualizarAvisoRascunho()
}

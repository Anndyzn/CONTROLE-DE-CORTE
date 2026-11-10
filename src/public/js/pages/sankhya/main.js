import { apiGet } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { inicializarNomenclaturasSankhya } from "./nomenclaturas.js"
import { mostrarCodigosCorte, limparCodigosCorte } from "./codigos.js"

const el = id => document.getElementById(id)
let dados = null, ocupado = false, catalogoPromise
function catalogo() {
  if (!catalogoPromise) catalogoPromise = apiGet("/sankhya/catalogo").catch(erro => {catalogoPromise = null; throw erro})
  return catalogoPromise
}
async function copiar(valor) {
  try {
    await navigator.clipboard.writeText(valor)
    el("copiaManualSankhya").hidden = true
    mostrarToast("Código copiado. Cole no Sankhya.", "sucesso")
  } catch {
    el("copiaManualSankhya").hidden = false
    el("textoCopiaSankhya").value = valor
    el("textoCopiaSankhya").focus(); el("textoCopiaSankhya").select()
    mostrarToast("Copie o código selecionado com Ctrl+C.", "info")
  }
}
async function atualizarProdutos() {
  if (dados) await mostrarCodigosCorte(dados, await catalogo(), copiar)
}
async function buscar() {
  if (ocupado || !el("formBuscarSankhya").reportValidity()) return
  ocupado = true
  el("camposBuscaSankhya").disabled = true
  dados = null; limparCodigosCorte(); el("copiaManualSankhya").hidden = true
  el("estadoSankhya").textContent = "Consultando corte..."
  try {
    dados = await apiGet(`/sankhya/cortes/${encodeURIComponent(el("numeroSankhya").value)}/vinculos`)
    await atualizarProdutos()
    el("estadoSankhya").textContent = `Corte ${dados.corte.numero} — ${dados.corte.produto}`
  } catch (erro) {
    dados = null; limparCodigosCorte()
    el("estadoSankhya").textContent = erro.message
    mostrarToast(erro.message, "erro")
  } finally { ocupado = false; el("camposBuscaSankhya").disabled = false }
}
function opcao(valor,nome) { const e = document.createElement("option");e.value=valor;e.textContent=nome;return e }
inicializarNomenclaturasSankhya(catalogo, () => { atualizarProdutos().catch(erro=>mostrarToast(erro.message,"erro")) })
el("formBuscarSankhya").addEventListener("submit", evento=>{evento.preventDefault();return buscar()})
el("recentesSankhya").addEventListener("change", ()=>{
  if (!ocupado && el("recentesSankhya").value) {el("numeroSankhya").value=el("recentesSankhya").value;return buscar()}
})
apiGet("/sankhya/cortes").then(cortes=>{
  el("recentesSankhya").replaceChildren(opcao("",cortes.length ? "Selecione um corte" : "Nenhum corte disponível"))
  for (const c of cortes) el("recentesSankhya").append(opcao(String(c.numero),`${c.numero} — ${c.produto}`))
}).catch(()=>el("recentesSankhya").replaceChildren(opcao("","Lista indisponível. Busque pelo número.")))
const numeroInicial = new URLSearchParams(window.location?.search ?? "").get("corte")
if (numeroInicial && /^[1-9]\d{0,9}$/.test(numeroInicial) && Number(numeroInicial)<=2147483647) {
  el("numeroSankhya").value=numeroInicial;buscar()
}

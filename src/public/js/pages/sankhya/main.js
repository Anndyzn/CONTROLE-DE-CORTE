import { apiGet } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { inicializarNomenclaturasSankhya } from "./nomenclaturas.js"
import { mostrarCodigosCorte, limparCodigosCorte } from "./codigos.js"
import { inicializarAcompanhamentoSankhya } from "../../core/acompanhamento-sankhya.js"
import { inicializarProximoPendente } from "./proximo.js"

const el = id => document.getElementById(id)
inicializarAcompanhamentoSankhya()
let dados = null, ocupado = false, catalogoPromise
inicializarProximoPendente(()=>dados?.corte.numero,numero=>{window.location.href=`sankhya.html?corte=${numero}`})
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
async function buscar(numero) {
  if (ocupado) return
  ocupado = true
  dados = null; limparCodigosCorte(); el("copiaManualSankhya").hidden = true
  if(el("editarVinculosCorteSankhya"))el("editarVinculosCorteSankhya").hidden=true
  el("estadoSankhya").textContent = "Consultando corte..."
  el("estadoSankhya").hidden = false
  try {
    dados = await apiGet(`/sankhya/cortes/${encodeURIComponent(numero)}/vinculos`)
    const editar=el("editarVinculosCorteSankhya")
    if(editar){editar.href=`sankhya.html?corte=${dados.corte.numero}&vincular=${encodeURIComponent(dados.corte.produto)}`;editar.hidden=false}
    await atualizarProdutos()
    el("estadoSankhya").textContent = `Corte ${dados.corte.numero} — ${dados.corte.produto}`
  } catch (erro) {
    dados = null; limparCodigosCorte()
    if(el("editarVinculosCorteSankhya"))el("editarVinculosCorteSankhya").hidden=true
    el("estadoSankhya").textContent = erro.message
    mostrarToast(erro.message, "erro")
  } finally { ocupado = false }
}
inicializarNomenclaturasSankhya(catalogo, () => { atualizarProdutos().catch(erro=>mostrarToast(erro.message,"erro")) })
const numeroInicial = new URLSearchParams(window.location?.search ?? "").get("corte")
if (numeroInicial && /^[1-9]\d{0,9}$/.test(numeroInicial) && Number(numeroInicial)<=2147483647) {
  buscar(numeroInicial)
}

import { apiGet, apiPost } from "../core/api.js"
import { mostrarToast } from "../core/ui.js"
import { solicitarJustificativa } from "./justificativa.js"
import { esconderDetalhesAdmin } from "./ui-admin.js"

export function inicializarPadronizacao() {
  const el = id => document.getElementById(id)
  const painel = el("painelPadronizacao")
  if (!painel) return
  let nomes = [], caixas = [], carregado = false, ocupado = false, previa = null, pedido = null
  const texto = (tag, valor) => { const elemento = document.createElement(tag); elemento.textContent = valor; return elemento }
  function bloquear(ativo) {
    ocupado = ativo
    el("camposFiltroPadronizacao").disabled = ativo
    el("camposPadronizacao").disabled = ativo || !nomes.length
    el("aplicarPadronizacao").disabled = ativo || !previa
    painel.setAttribute("aria-busy", String(ativo))
  }
  function invalidar() {
    previa = null; pedido = null
    el("previaPadronizacao").hidden = true
    el("aplicarPadronizacao").disabled = true
    const selecionados = caixas.filter(caixa => caixa.checked).length
    el("selecaoPadronizacao").textContent = `${selecionados} nome(s) selecionado(s). Máximo de 100 nomes e 2.000 registros por operação.`
  }
  async function listar({preservarMensagem = false} = {}) {
    if (ocupado) return
    bloquear(true); invalidar(); nomes = []; caixas = []
    el("nomesPadronizacao").replaceChildren()
    if (!preservarMensagem) el("estadoPadronizacao").textContent = "Consultando nomes existentes..."
    try {
      const parametros = new URLSearchParams({tipo: el("tipoPadronizacao").value, busca: el("buscaPadronizacao").value.trim()})
      const dados = await apiGet(`/admin/nomenclaturas?${parametros}`)
      nomes = dados.nomes
      nomes.forEach((nome, indice) => {
        const linha = document.createElement("tr")
        const selecao = document.createElement("td")
        const caixa = document.createElement("input")
        caixa.type = "checkbox"; caixa.value = nome.nome
        caixa.id = `nomePadronizacao${indice}`
        caixa.setAttribute("aria-label", `Selecionar nome ${nome.nome}`)
        caixa.addEventListener("change", invalidar)
        caixas.push(caixa); selecao.append(caixa)
        const celulaNome = document.createElement("td")
        const label = texto("label", nome.nome); label.htmlFor = caixa.id
        celulaNome.append(label)
        const acao = document.createElement("td")
        const usar = texto("button", "Usar nome"); usar.type = "button"; usar.className = "btn-secondary"
        usar.setAttribute("aria-label", `Usar ${nome.nome} como nome padronizado`)
        usar.addEventListener("click", () => { if (!ocupado) { el("destinoPadronizacao").value = nome.nome; invalidar() } })
        acao.append(usar)
        linha.append(selecao, celulaNome, texto("td", nome.registros), texto("td", nome.cortes), acao)
        el("nomesPadronizacao").append(linha)
      })
      carregado = true
      if (!preservarMensagem) el("estadoPadronizacao").textContent = dados.tem_mais
        ? "Exibindo os primeiros 1.000 nomes. Refine a busca para localizar outras variações."
        : nomes.length ? `${nomes.length} nome(s) encontrado(s). Selecione as variações que deseja corrigir.` : "Nenhum nome encontrado para este filtro."
    } catch (erro) {
      carregado = false
      el("estadoPadronizacao").textContent = preservarMensagem ? `Alteração concluída. A lista não foi atualizada: ${erro.message}` : erro.message
    } finally { bloquear(false) }
  }
  async function conferir(evento) {
    evento.preventDefault()
    if (ocupado || !el("formPadronizacao").reportValidity()) return
    const origens = caixas.filter(caixa => caixa.checked).map(caixa => caixa.value)
    if (!origens.length || origens.length > 100) { mostrarToast("Selecione de 1 a 100 nomes para corrigir.", "atencao"); return }
    const dados = {tipo: el("tipoPadronizacao").value, origens, destino: el("destinoPadronizacao").value}
    bloquear(true); invalidar()
    try {
      previa = await apiPost("/admin/nomenclaturas/previa", dados)
      pedido = {...dados, destino: previa.destino}
      el("destinoPadronizacao").value = previa.destino
      el("resumoPadronizacao").textContent = `${previa.total} registro(s), em ${previa.cortes} corte(s), passarão para “${previa.destino}”. ${previa.correspondencias} correspondência(s) Sankhya serão copiadas para o nome padronizado. Somente os nomes serão alterados.`
      el("registrosPadronizacao").replaceChildren()
      for (const registro of previa.registros) {
        const linha = document.createElement("tr")
        linha.append(...[registro.numero_corte, registro.id, registro.antes, registro.depois].map(valor => texto("td", valor)))
        el("registrosPadronizacao").append(linha)
      }
      el("previaPadronizacao").hidden = false
      el("estadoPadronizacao").textContent = "Prévia carregada. Confira a lista antes de confirmar."
    } catch (erro) {
      invalidar(); el("estadoPadronizacao").textContent = erro.message
      mostrarToast(erro.message, "erro", "Prévia indisponível")
    } finally { bloquear(false) }
  }
  async function aplicar() {
    if (ocupado || !previa || !pedido) return
    bloquear(true)
    try {
      const justificativa = await solicitarJustificativa({titulo: "Confirmar padronização de nomes",
        descricao: `Alterar ${previa.total} registro(s) para “${previa.destino}”, inclusive registros finalizados. Informe o responsável e o motivo.`})
      if (!justificativa) return
      const resultado = await apiPost("/admin/nomenclaturas/aplicar", {...pedido, token: previa.token, ...justificativa})
      invalidar()
      esconderDetalhesAdmin()
      document.dispatchEvent(new Event("corte-admin-carregado"))
      el("estadoPadronizacao").textContent = `${resultado.total} registro(s) padronizado(s). Alterações registradas no histórico. Consulte o corte novamente para ver os dados atualizados.`
      mostrarToast(`${resultado.total} registro(s) padronizado(s).`, "sucesso", "Padronização concluída")
      bloquear(false)
      await listar({preservarMensagem: true})
    } catch (erro) {
      invalidar()
      el("estadoPadronizacao").textContent = erro.message
      mostrarToast(erro.message, "erro", "Padronização não confirmada")
    } finally { bloquear(false) }
  }
  painel.addEventListener("toggle", () => { if (painel.open && !carregado) return listar() })
  el("filtroPadronizacao").addEventListener("submit", evento => { evento.preventDefault(); return listar() })
  el("tipoPadronizacao").addEventListener("change", () => {
    if (ocupado) return
    el("destinoPadronizacao").value = ""
    return listar()
  })
  el("formPadronizacao").addEventListener("submit", conferir)
  el("destinoPadronizacao").addEventListener("input", invalidar)
  el("aplicarPadronizacao").addEventListener("click", aplicar)
}

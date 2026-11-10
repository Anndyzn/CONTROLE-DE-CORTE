import { apiGet, apiPut } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { confirmarAcao } from "../../core/confirmacao.js"
const el = id => document.getElementById(id)
let catalogo, nomes = [], atual = null, opcoes = [], alterado = false, ocupado = false, sequencia = 0, sequenciaOpcoes = 0
let nomeDesejado = new URLSearchParams(window.location?.search??"").get("vincular")
function opcao(valor, nome) { const o = document.createElement("option"); o.value = valor; o.textContent = nome; return o }
function renderizar() {
  el("listaPossibilidadesSankhya").replaceChildren()
  for (const [indice, o] of opcoes.entries()) {
    const linha = document.createElement("div"), nome = document.createElement("span"), remover = document.createElement("button")
    linha.className = "sankhya-possibilidade"
    nome.textContent = o.codigos.map(c => {const p = catalogo.produtos.find(p => p.codigo_produto === c); return `${c} — ${p?.produto ?? "Fora do catálogo; revise"}`}).join(" + ")
    remover.type = "button"; remover.className = "btn-secondary"; remover.textContent = "Remover opção"
    remover.addEventListener("click", () => { if (ocupado) return; opcoes.splice(indice,1); alterado = true; renderizar() })
    linha.append(nome, remover); el("listaPossibilidadesSankhya").append(linha)
  }
  el("salvarPossibilidadesSankhya").disabled = !atual || ocupado
}
async function podeTrocar() { return !alterado || await confirmarAcao("Descartar as alterações das possibilidades ainda não salvas?", {titulo:"Alterações pendentes", confirmar:"Descartar"}) }
async function carregarLista() {
  const seq = ++sequencia
  el("estadoNomesSankhya").textContent = "Carregando nomes dos cortes..."
  try {
    const dados = await apiGet(`/sankhya/nomenclaturas?${new URLSearchParams({busca: el("buscarNomeSankhya").value.trim()})}`)
    if (seq !== sequencia) return
    nomes = dados.nomes
    el("nomeOrigemSankhya").replaceChildren(opcao("", "Selecione uma nomenclatura"))
    nomes.forEach((n,i) => el("nomeOrigemSankhya").append(opcao(String(i), `${n.nome} · ${n.cortes} corte(s) · ${n.opcoes.length} opção(ões)`)))
    atual = null; opcoes = []; alterado = false; renderizar()
    if(nomeDesejado){
      const indice=nomes.findIndex(n=>n.nome===nomeDesejado)
      if(indice>=0){atual=nomes[indice];opcoes=structuredClone(atual.opcoes);el("nomeOrigemSankhya").value=String(indice);renderizar()}
      nomeDesejado=null
    }
    el("estadoNomesSankhya").textContent = dados.tem_mais ? "Há mais nomes. Refine a busca." : `${nomes.length} nomenclatura(s). Escolha um nome para definir os produtos possíveis.`
  } catch (erro) { if (seq === sequencia) el("estadoNomesSankhya").textContent = erro.message }
}
export async function carregarPossibilidadesCorte(nome) {
  const seq = ++sequenciaOpcoes
  const select = el("possibilidadeItemSankhya")
  select.disabled = true; select.replaceChildren(opcao("", "Carregando opções da nomenclatura..."))
  try {
    const dados = await apiGet(`/sankhya/nomenclaturas?${new URLSearchParams({nome})}`)
    if (seq !== sequenciaOpcoes) return
    const opcoesNome = dados.nomes[0]?.opcoes ?? []
    select.replaceChildren(opcao("", opcoesNome.length ? "Escolha o que foi cortado" : "Sem opções cadastradas para esse nome"))
    opcoesNome.forEach((o,i) => {
      const item = opcao(String(i), o.rotulo); item.dataset.codigos = JSON.stringify(o.codigos); select.append(item)
    })
    select.disabled = !opcoesNome.length
  } catch { if (seq === sequenciaOpcoes) select.replaceChildren(opcao("", "Falha ao consultar opções; tente abrir o PI novamente")) }
}
export function inicializarNomenclaturasSankhya(obterCatalogo, aoSalvar = () => {}) {
  const painel = el("painelNomesSankhya")
  painel.addEventListener("toggle", async () => {
    if (!painel.open || catalogo) return
    try {
      catalogo = await obterCatalogo()
      el("produtoPossivelSankhya").replaceChildren(opcao("", "Selecione um produto ou conjunto"))
      for (const g of catalogo.grupos) el("produtoPossivelSankhya").append(opcao(`g:${g.id}`, g.nome))
      for (const p of catalogo.produtos) el("produtoPossivelSankhya").append(opcao(String(p.codigo_produto), `${p.codigo_produto} — ${p.produto}`))
      await carregarLista()
    } catch (erro) { catalogo = null; el("estadoNomesSankhya").textContent = erro.message }
  })
  el("filtrarNomesSankhya").addEventListener("click", async () => {
    if (ocupado || !catalogo) return
    ocupado = true
    try { if (await podeTrocar()) await carregarLista() } finally { ocupado = false; renderizar() }
  })
  el("nomeOrigemSankhya").addEventListener("change", async () => {
    if (ocupado) { el("nomeOrigemSankhya").value = atual ? String(nomes.indexOf(atual)) : ""; return }
    ocupado = true
    const indice = el("nomeOrigemSankhya").value
    try {
      if (!await podeTrocar()) { el("nomeOrigemSankhya").value = atual ? String(nomes.indexOf(atual)) : ""; return }
      atual = indice === "" ? null : nomes[Number(indice)]
      opcoes = structuredClone(atual?.opcoes ?? []); alterado = false
    } finally { ocupado = false; renderizar() }
  })
  el("adicionarPossibilidadeSankhya").addEventListener("click", () => {
    if (ocupado || !atual) return
    const valor = el("produtoPossivelSankhya").value
    if (!valor) return
    const codigos = valor.startsWith("g:") ? catalogo.grupos.find(g => g.id === valor.slice(2)).codigos : [Number(valor)]
    const chave = c => [...c].sort((a,b)=>a-b).join(",")
    if (opcoes.some(o => chave(o.codigos) === chave(codigos))) { mostrarToast("Essa opção já está na lista.", "atencao"); return }
    if (opcoes.length >= 30) { mostrarToast("Limite de 30 opções por nome.", "atencao"); return }
    opcoes.push({codigos: [...codigos]}); alterado = true; renderizar()
  })
  el("salvarPossibilidadesSankhya").addEventListener("click", async () => {
    if (ocupado || !atual) return
    ocupado = true; renderizar()
    try {
      if (!await confirmarAcao(`Salvar ${opcoes.length} opção(ões) para “${atual.nome}”? Isso não altera os cortes nem os vínculos já salvos dos PIs.`, {titulo:"Produtos possíveis", confirmar:"Salvar opções"})) return
      const resultado = await apiPut("/sankhya/nomenclaturas", {nome: atual.nome, versao: atual.versao, opcoes})
      atual.opcoes = resultado.opcoes; atual.versao = resultado.versao
      opcoes = structuredClone(resultado.opcoes); alterado = false
      mostrarToast("Opções salvas. Escolha o produto na preparação do PI.", "sucesso")
      aoSalvar()
      const selecionado = el("nomeOrigemSankhya").children[nomes.indexOf(atual)+1]
      selecionado.textContent = `${atual.nome} · ${atual.cortes} corte(s) · ${opcoes.length} opção(ões)`
    } catch (erro) { mostrarToast(erro.message,"erro") }
    finally { ocupado = false; renderizar() }
  })
  window.addEventListener("beforeunload", evento => { if (alterado || ocupado) { evento.preventDefault(); evento.returnValue = "" } })
  if(nomeDesejado&&nomeDesejado.length<=200){el("buscarNomeSankhya").value=nomeDesejado;painel.open=true}
}

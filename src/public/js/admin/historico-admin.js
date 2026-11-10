import { apiGet } from "../core/api.js"

const acoes = {
  PADRONIZACAO_PRODUTO: "Nome do corte padronizado", PADRONIZACAO_MODELO: "Modelo do PI padronizado",
  EDICAO_PRODUTO: "Nome do produto corrigido",
  EDICAO_PRODUCAO: "Produção corrigida", REABERTURA_PRODUCAO: "Corte reaberto",
  EXCLUSAO_PRODUCAO: "Lançamento excluído", EDICAO_PI: "PI corrigido", EXCLUSAO_PI: "PI excluído",
  REABERTURA_PIS: "PIs reabertos", EXCLUSAO_CORTE: "Corte excluído"
}
const campos = {
  numero: "Corte", numero_corte: "Corte", produto: "Nome do corte", mesa: "Mesa", data: "Data",
  turno: "Turno", operador: "Operador", folha_inicio: "Folha inicial", folha_parou: "Folha final",
  hora_inicio: "Hora inicial", hora_fim: "Hora final", status: "Status", modelo: "Modelo do PI",
  cor: "Cor", tecido: "Tecido", metragem_usada: "Metragem usada", sobra_metros: "Sobra",
  perda_metros: "Perda", metros_faltantes: "Metros faltantes", quantidade_pecas: "Quantidade",
  itens_finalizados: "PIs"
}
let cursor = null, sequencia = 0, filtroAplicado = {}, carregando = false
let registrosExibidos=[]

export function agruparRegistrosAdmin(registros) {
  const grupos=new Map()
  for(const r of registros){
    const lote=["PADRONIZACAO_PRODUTO","PADRONIZACAO_MODELO"].includes(r.acao)
    const instante=r.instante_operacao??r.criado_em
    const chave=r.operacao_id?JSON.stringify([r.operacao_id,r.acao,r.responsavel,r.motivo]):lote&&instante?JSON.stringify(["anterior",instante,r.acao,r.responsavel,r.motivo]):`registro:${r.id}`
    if(!grupos.has(chave))grupos.set(chave,[])
    grupos.get(chave).push(r)
  }
  return [...grupos.values()]
}

function avisosNomes(registros) {
  const avisos=texto("div","","historico-admin-nomenclaturas"),nomes=new Map()
  for(const r of registros)for(const campo of ["produto","modelo"]){
    const antigo=r.antes?.[campo],novo=r.depois?.[campo]
    if(typeof antigo!=="string"||typeof novo!=="string"||antigo===novo)continue
    const chave=JSON.stringify([campo,novo])
    if(!nomes.has(chave))nomes.set(chave,{novo,antigos:new Set()})
    nomes.get(chave).antigos.add(antigo)
  }
  for(const {novo,antigos} of nomes.values()){
    const aviso=texto("div","","historico-admin-nome-aviso")
    aviso.append(texto("span",[...antigos].join(" • "),"historico-admin-nome-antigo"),texto("span"," → ","historico-admin-seta"),texto("strong",novo))
    avisos.append(aviso)
  }
  return avisos
}

export function renderizarGrupoAdmin(registros) {
  const r=registros[0],card=texto("article","","historico-admin-registro historico-admin-grupo")
  const data=new Date(r.criado_em)
  const nomes=avisosNomes(registros)
  if(nomes.children.length)card.append(nomes)
  else card.append(texto("strong",acoes[r.acao]??"Alteração registrada"))
  const cortes=new Set(registros.map(r=>r.numero_corte))
  card.append(texto("p",`${Number.isNaN(data.getTime())?"Data indisponível":data.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} · ${cortes.size} corte(s) · ${registros.length} registro(s) carregado(s)`))
  const detalhes=texto("details","")
  detalhes.append(texto("summary","Ver detalhes"),texto("p",`Responsável informado: ${r.responsavel}`),texto("p",`Motivo: ${r.motivo}`,"historico-admin-motivo"))
  const registrosDetalhados=texto("div","")
  for(const r of registros)registrosDetalhados.append(renderizarRegistroAdmin(r))
  detalhes.append(registrosDetalhados)
  card.append(detalhes)
  return card
}

function texto(tag, conteudo, classe = "") {
  const el = document.createElement(tag)
  el.textContent = conteudo
  el.className = classe
  return el
}

function valor(campo, dado) {
  if (dado === undefined || dado === null || dado === "") return "—"
  if (campo === "itens_finalizados") return Number(dado) === 1 ? "Registrados" : "Abertos"
  if (typeof dado === "object") return JSON.stringify(dado, null, 2)
  return String(dado)
}

export function dadosRegistro(antes, depois) {
  const lista = document.createElement("dl")
  lista.className = "historico-admin-dados"
  for (const campo of new Set([...Object.keys(antes??{}),...Object.keys(depois??{})])) {
    const anterior=antes?.[campo], novo=depois?.[campo]
    const comparar=v=>typeof v==="object"?JSON.stringify(v):String(v)
    if (depois && comparar(anterior)===comparar(novo)) continue
    const linha=texto("div","","historico-admin-mudanca")
    linha.append(texto("dt",campos[campo]??campo.replace(/_/g," ")))
    for(const [rotulo,dado] of [["Antes",anterior],["Depois",novo]]){
      const celula=texto("dd","")
      celula.append(texto("span",rotulo,"historico-admin-coluna"))
      if(dado && typeof dado==="object"){
        const detalhe=texto("details","")
        detalhe.append(texto("summary","Ver conteúdo"),texto("pre",valor(campo,dado)))
        celula.append(detalhe)
      }else celula.append(texto("strong",valor(campo,dado)))
      linha.append(celula)
    }
    lista.append(linha)
  }
  if (!lista.children.length) lista.append(texto("dd", "Os valores informados permaneceram iguais."))
  return lista
}

export function renderizarRegistroAdmin(registro) {
  const card = document.createElement("article")
  card.className = "historico-admin-registro"
  const cabecalho = document.createElement("div")
  cabecalho.className = "historico-admin-cabecalho"
  const data = new Date(registro.criado_em)
  const dataTexto = Number.isNaN(data.getTime()) ? "Data indisponível" : data.toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})
  cabecalho.append(texto("strong", acoes[registro.acao] || `Alteração registrada: ${registro.acao}`), texto("time", dataTexto))
  card.append(cabecalho, texto("p", `Corte ${registro.numero_corte} · Responsável informado: ${registro.responsavel}`),
    texto("p", `Motivo: ${registro.motivo}`, "historico-admin-motivo"))
  if(registro.registro_id!=null)card.append(texto("p",`Registro alterado: ${registro.registro_id}`))
  card.append(avisosNomes([registro]))
  if (registro.acao === "EXCLUSAO_CORTE") {
    card.append(dadosRegistro(registro.antes?.corte, null),texto("p",`${registro.antes?.producao?.length??0} lançamento(s) e ${registro.antes?.itens?.length??0} PI(s) excluídos. Os dados completos estão preservados abaixo.`))
  } else card.append(dadosRegistro(registro.antes, registro.depois))
  const detalhes = document.createElement("details")
  detalhes.append(texto("summary", "Ver registro completo"),texto("h4","Antes"),texto("pre",valor("",registro.antes)),texto("h4","Depois"),texto("pre",valor("",registro.depois)))
  card.append(detalhes)
  return card
}

export async function carregarHistoricoAlteracoes({mais = false} = {}) {
  if(mais && carregando)return
  const lista = document.getElementById("listaHistoricoAdmin")
  const estado = document.getElementById("estadoHistoricoAdmin")
  const botao = document.getElementById("maisHistoricoAdmin")
  if (!lista || !estado || !botao) return
  const consulta = ++sequencia
  const parametros = new URLSearchParams()
  const filtro = mais ? filtroAplicado : Object.fromEntries([
    ["numero","filtroHistoricoAdmin"],["busca","buscaHistoricoAdmin"],["acao","tipoHistoricoAdmin"],["inicio","inicioHistoricoAdmin"],["fim","fimHistoricoAdmin"]
  ].map(([chave,id])=>[chave,document.getElementById(id)?.value.trim()??""]))
  for(const [chave,valor] of Object.entries(filtro))if(valor)parametros.set(chave,valor)
  if (mais && cursor) parametros.set("antes", cursor)
  botao.disabled = true
  carregando=true
  if(!mais){lista.replaceChildren();registrosExibidos=[];cursor=null;botao.hidden=true}
  estado.hidden = false
  estado.textContent = "Carregando histórico..."
  try {
    const dados = await apiGet(`/historico-admin?${parametros}`)
    if (consulta !== sequencia) return
    if (!mais) {
      lista.replaceChildren()
      filtroAplicado = filtro
    }
    const ids=new Set(registrosExibidos.map(r=>String(r.id)))
    for(const registro of dados.registros)if(!ids.has(String(registro.id))){registrosExibidos.push(registro);ids.add(String(registro.id))}
    const grupos=agruparRegistrosAdmin(registrosExibidos)
    lista.replaceChildren(...grupos.map(renderizarGrupoAdmin))
    cursor = dados.registros.at(-1)?.id ?? cursor
    botao.hidden = !dados.tem_mais
    estado.hidden = false
    estado.textContent = registrosExibidos.length ? `${registrosExibidos.length} alteração(ões) em ${grupos.length} operação(ões) exibida(s). ${dados.tem_mais?"Carregue anteriores para completar grupos e ver mais operações.":"Todo o histórico deste filtro foi exibido."}` : "Nenhuma alteração registrada para este filtro."
  } catch (erro) {
    if (consulta !== sequencia) return
    estado.textContent = erro.message || "Não foi possível carregar o histórico."
  } finally {
    if (consulta === sequencia) {botao.disabled = false;carregando=false}
  }
}

export function inicializarHistoricoAdmin() {
  document.getElementById("formFiltroHistoricoAdmin")?.addEventListener("submit", evento => {
    evento.preventDefault()
    cursor = null
    carregarHistoricoAlteracoes()
  })
  document.getElementById("maisHistoricoAdmin")?.addEventListener("click", () => carregarHistoricoAlteracoes({mais:true}))
  document.getElementById("limparHistoricoAdmin")?.addEventListener("click",()=>{
    for(const id of ["filtroHistoricoAdmin","buscaHistoricoAdmin","tipoHistoricoAdmin","inicioHistoricoAdmin","fimHistoricoAdmin"])document.getElementById(id).value=""
    cursor=null;carregarHistoricoAlteracoes()
  })
  document.addEventListener("alteracao-administrativa", () => carregarHistoricoAlteracoes())
  carregarHistoricoAlteracoes()
}

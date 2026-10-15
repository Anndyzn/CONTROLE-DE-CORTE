import { apiGet } from "../core/api.js"

const acoes = {
  EDICAO_PRODUCAO: "Produção corrigida", REABERTURA_PRODUCAO: "Corte reaberto",
  EXCLUSAO_PRODUCAO: "Lançamento excluído", EDICAO_PI: "PI corrigido", EXCLUSAO_PI: "PI excluído",
  REABERTURA_PIS: "PIs reabertos", EXCLUSAO_CORTE: "Corte excluído"
}
const campos = {
  numero: "Corte", numero_corte: "Corte", produto: "Produto", mesa: "Mesa", data: "Data",
  turno: "Turno", operador: "Operador", folha_inicio: "Folha inicial", folha_parou: "Folha final",
  hora_inicio: "Hora inicial", hora_fim: "Hora final", status: "Status", modelo: "Modelo",
  cor: "Cor", tecido: "Tecido", metragem_usada: "Metragem usada", sobra_metros: "Sobra",
  perda_metros: "Perda", metros_faltantes: "Metros faltantes", quantidade_pecas: "Quantidade",
  itens_finalizados: "PIs"
}
let cursor = null, sequencia = 0, filtroAplicado = ""

function texto(tag, conteudo, classe = "") {
  const el = document.createElement(tag)
  el.textContent = conteudo
  el.className = classe
  return el
}

function valor(campo, dado) {
  if (dado === undefined || dado === null || dado === "") return "—"
  if (campo === "itens_finalizados") return Number(dado) === 1 ? "Registrados" : "Abertos"
  return String(dado)
}

function dadosRegistro(antes, depois) {
  const lista = document.createElement("dl")
  lista.className = "historico-admin-dados"
  for (const [campo, rotulo] of Object.entries(campos)) {
    if (antes?.[campo] === undefined && depois?.[campo] === undefined) continue
    if (depois && String(antes?.[campo]) === String(depois[campo])) continue
    lista.append(texto("dt", rotulo), texto("dd", depois
      ? `${valor(campo, antes?.[campo])} → ${valor(campo, depois[campo])}`
      : valor(campo, antes?.[campo])))
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
  cabecalho.append(texto("strong", acoes[registro.acao] || "Alteração registrada"), texto("time", dataTexto))
  card.append(cabecalho, texto("p", `Corte ${registro.numero_corte} · Responsável informado: ${registro.responsavel}`),
    texto("p", `Motivo: ${registro.motivo}`, "historico-admin-motivo"))
  const detalhes = document.createElement("details")
  detalhes.append(texto("summary", "Ver dados da alteração"))
  if (registro.acao === "EXCLUSAO_CORTE") {
    detalhes.append(dadosRegistro(registro.antes?.corte, null))
    for (const [chave, rotulo] of [["producao", "Lançamentos"], ["itens", "PIs"]]) {
      const registros = registro.antes?.[chave] || []
      const grupo = document.createElement("details")
      grupo.append(texto("summary", `${rotulo} excluídos (${registros.length})`))
      for (const item of registros) grupo.append(dadosRegistro(item, null))
      detalhes.append(grupo)
    }
  } else detalhes.append(dadosRegistro(registro.antes, registro.depois))
  card.append(detalhes)
  return card
}

export async function carregarHistoricoAlteracoes({mais = false} = {}) {
  const lista = document.getElementById("listaHistoricoAdmin")
  const estado = document.getElementById("estadoHistoricoAdmin")
  const botao = document.getElementById("maisHistoricoAdmin")
  if (!lista || !estado || !botao) return
  const consulta = ++sequencia
  const parametros = new URLSearchParams()
  const numero = mais ? filtroAplicado : document.getElementById("filtroHistoricoAdmin").value.trim()
  if (numero) parametros.set("numero", numero)
  if (mais && cursor) parametros.set("antes", cursor)
  botao.disabled = true
  estado.hidden = false
  estado.textContent = "Carregando histórico..."
  try {
    const dados = await apiGet(`/historico-admin?${parametros}`)
    if (consulta !== sequencia) return
    if (!mais) {
      lista.replaceChildren()
      filtroAplicado = numero
    }
    for (const registro of dados.registros) lista.append(renderizarRegistroAdmin(registro))
    cursor = dados.registros.at(-1)?.id ?? cursor
    botao.hidden = !dados.tem_mais
    estado.hidden = lista.children.length > 0
    estado.textContent = "Nenhuma alteração registrada para este filtro."
  } catch (erro) {
    if (consulta !== sequencia) return
    estado.textContent = erro.message || "Não foi possível carregar o histórico."
  } finally {
    if (consulta === sequencia) botao.disabled = false
  }
}

export function inicializarHistoricoAdmin() {
  document.getElementById("formFiltroHistoricoAdmin")?.addEventListener("submit", evento => {
    evento.preventDefault()
    cursor = null
    carregarHistoricoAlteracoes()
  })
  document.getElementById("maisHistoricoAdmin")?.addEventListener("click", () => carregarHistoricoAlteracoes({mais:true}))
  document.addEventListener("alteracao-administrativa", () => carregarHistoricoAlteracoes())
  carregarHistoricoAlteracoes()
}

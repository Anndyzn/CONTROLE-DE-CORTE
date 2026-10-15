import { apiGet } from "../../core/api.js"

let cortesAtuais = []
let consultaConcluida = false
let cadastrando = false
let erroConsulta = false
const mesas = ["MESA 1", "MESA 2", "MESA 3"]

function normalizarMesa(mesa) {
  return String(mesa ?? "").trim().replace(/\s+/g, " ").toUpperCase()
}

function ocupantesDaMesa(mesa) {
  return cortesAtuais.filter(corte =>
    normalizarMesa(corte.mesa) === normalizarMesa(mesa) && corte.status !== "FINALIZADO"
  )
}

function mensagemOcupacao(mesa, cortes) {
  const referencia = cortes.length === 1
    ? `pelo corte ${cortes[0].numero}`
    : `pelos cortes ${cortes.map(corte => corte.numero).join(", ")}`
  const instrucao = cortes.length === 1 ? "Finalize esse corte" : "Finalize esses cortes"
  return `A ${normalizarMesa(mesa)} está ocupada ${referencia}. ${instrucao} antes de cadastrar outro nesta mesa.`
}

function renderizarPainelMesas() {
  const painel = document.getElementById("painelMesas")
  const estado = document.getElementById("estadoPainelMesas")
  if (!painel || !estado) return

  estado.hidden = consultaConcluida && !erroConsulta
  estado.textContent = erroConsulta
    ? consultaConcluida
      ? "Não foi possível atualizar a ocupação. Exibindo os últimos dados recebidos. Use Atualizar em Cortes em andamento para tentar novamente."
      : "Não foi possível consultar a ocupação. Use Atualizar em Cortes em andamento para tentar novamente."
    : "Consultando ocupação das mesas..."

  painel.replaceChildren()
  for (const mesa of mesas) {
    const ocupantes = ocupantesDaMesa(mesa)
    const situacao = !consultaConcluida ? "indisponivel" : ocupantes.length ? "ocupada" : "livre"
    const card = document.createElement("article")
    card.className = `mesa-card mesa-${situacao}`
    const cabecalho = document.createElement("div")
    cabecalho.className = "mesa-cabecalho"
    const titulo = document.createElement("h3")
    titulo.textContent = mesa
    const status = document.createElement("span")
    status.className = "mesa-situacao"
    status.textContent = !consultaConcluida ? erroConsulta ? "Indisponível" : "Consultando"
      : ocupantes.length ? "Ocupada" : "Livre"
    cabecalho.append(titulo, status)
    card.append(cabecalho)

    if (consultaConcluida && ocupantes.length) {
      const lista = document.createElement("ul")
      lista.className = "mesa-cortes"
      for (const corte of ocupantes) {
        const item = document.createElement("li")
        const numero = document.createElement("strong")
        numero.textContent = `Corte ${corte.numero}`
        const produto = document.createElement("span")
        produto.textContent = corte.produto || "Produto não informado"
        item.append(numero, produto)
        lista.append(item)
      }
      card.append(lista)
      if (ocupantes.length > 1) {
        const aviso = document.createElement("p")
        aviso.className = "mesa-conflito"
        aviso.textContent = `Atenção: há ${ocupantes.length} cortes em aberto nesta mesa. Confira as finalizações.`
        card.append(aviso)
      }
    } else {
      const descricao = document.createElement("p")
      descricao.className = "mesa-descricao"
      descricao.textContent = consultaConcluida ? "Disponível para um novo corte."
        : erroConsulta ? "Ocupação indisponível." : "Verificando ocupação..."
      card.append(descricao)
    }
    painel.append(card)
  }
}

export function atualizarControleMesas() {
  renderizarPainelMesas()
  const select = document.getElementById("mesaNova")
  const aviso = document.getElementById("avisoMesaOcupada")
  const botao = document.getElementById("cadastrarCorte")
  if (!select || !aviso || !botao) return

  for (const opcao of select.options) {
    if (!opcao.value) continue
    const ocupantes = ocupantesDaMesa(opcao.value)
    opcao.textContent = !consultaConcluida ? opcao.value : ocupantes.length
      ? `${opcao.value} — ocupada (corte${ocupantes.length > 1 ? "s" : ""} ${ocupantes.map(corte => corte.numero).join(", ")})`
      : `${opcao.value} — livre`
  }

  const ocupantes = select.value ? ocupantesDaMesa(select.value) : []
  const ocupada = ocupantes.length > 0
  aviso.hidden = !ocupada
  aviso.textContent = ocupada ? mensagemOcupacao(select.value, ocupantes) : ""
  select.setAttribute("aria-invalid", String(ocupada))
  botao.disabled = cadastrando || ocupada
}

export function atualizarOcupacaoMesas(cortes) {
  cortesAtuais = cortes
  consultaConcluida = true
  erroConsulta = false
  atualizarControleMesas()
}

export function informarFalhaOcupacaoMesas() {
  erroConsulta = true
  atualizarControleMesas()
}

export function informarMesaOcupada(mesa, cortes) {
  if (!Array.isArray(cortes)) return
  cortesAtuais = cortesAtuais.filter(corte => normalizarMesa(corte.mesa) !== normalizarMesa(mesa))
    .concat(cortes.map(corte => ({ ...corte, mesa })))
  atualizarControleMesas()
}

export function definirCadastroEmAndamento(ativo) {
  cadastrando = ativo
  atualizarControleMesas()
}

export function inicializarControleMesas() {
  document.getElementById("mesaNova")?.addEventListener("change", atualizarControleMesas)
  atualizarControleMesas()
}

export async function verificarDisponibilidadeMesa(mesa) {
  // Reconfere antes de enviar o cadastro; o servidor também valida de forma atômica.
  try {
    atualizarOcupacaoMesas(await apiGet("/cortes-em-andamento"))
  } catch (erro) {
    informarFalhaOcupacaoMesas()
    throw erro
  }
  const ocupantes = ocupantesDaMesa(mesa)
  if (ocupantes.length) {
    const erro = new Error(mensagemOcupacao(mesa, ocupantes))
    erro.codigo = "MESA_OCUPADA"
    erro.mesa = mesa
    erro.cortes = ocupantes
    throw erro
  }
}

import { apiGet } from "../../core/api.js"

let cortesAtuais = []
let consultaConcluida = false
let cadastrando = false
let erroConsulta = false
let ultimaAtualizacao = null
let acoesMesas = {}
let acaoEmAndamento = false
let botoesMesas = []
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

function previaUltimaProducao(corte) {
  const previa = document.createElement("div")
  previa.className = "mesa-ultima-producao"
  const cabecalho = document.createElement("div")
  cabecalho.className = "mesa-producao-cabecalho"
  const titulo = document.createElement("span")
  titulo.className = "mesa-producao-titulo"
  titulo.textContent = "Última produção"
  cabecalho.append(titulo)
  previa.append(cabecalho)

  const producao = corte.ultima_producao
  if (!producao) {
    const mensagem = document.createElement("p")
    mensagem.className = "mesa-producao-vazia"
    mensagem.textContent = producao === null
      ? "Este corte ainda não possui lançamentos de produção."
      : "Prévia indisponível. Use Atualizar para consultar a última produção."
    previa.append(mensagem)
    return previa
  }

  const dias = producao.dias_sem_lancamento
  if (Number.isInteger(dias)) {
    const idade = document.createElement("span")
    idade.className = "mesa-producao-idade"
    idade.textContent = dias === 0 ? "Hoje" : dias === 1 ? "Ontem" : dias < 0 ? "Data futura" : `Há ${dias} dias`
    if (dias === 0) idade.className += " mesa-producao-hoje"
    if (dias >= 2 || dias < 0) idade.className += " mesa-producao-antiga"
    cabecalho.append(idade)
  }

  const dados = document.createElement("dl")
  dados.className = "mesa-producao-dados"
  function detalhe(rotulo, valor) {
    const linha = document.createElement("div")
    const nome = document.createElement("dt")
    nome.textContent = rotulo
    const conteudo = document.createElement("dd")
    if (typeof valor === "string") conteudo.textContent = valor
    else conteudo.append(valor)
    linha.append(nome, conteudo)
    dados.append(linha)
  }

  const data = String(producao.data ?? "").slice(0, 10)
  const partes = data.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (partes) {
    const tempo = document.createElement("time")
    tempo.dateTime = data
    tempo.textContent = `${partes[3]}/${partes[2]}/${partes[1]}`
    detalhe("Data", tempo)
  } else detalhe("Data", "Não informada")
  if (producao.turno) detalhe("Turno", String(producao.turno))
  detalhe("Operador", String(producao.operador || "Não informado"))
  detalhe("Folhas", `${producao.folha_inicio ?? "—"} → ${producao.folha_parou ?? "—"}`)
  previa.append(dados)
  return previa
}

function atualizarBotoesMesas() {
  for (const {botao, disponivel} of botoesMesas) {
    botao.disabled = acaoEmAndamento || cadastrando || !disponivel
  }
}

function botaoAcaoMesa(rotulo, executar, disponivel) {
  const botao = document.createElement("button")
  botao.type = "button"
  botao.className = "mesa-acao"
  botao.textContent = rotulo
  botoesMesas.push({botao, disponivel})
  botao.addEventListener("click", async () => {
    if (botao.disabled || acaoEmAndamento) return
    acaoEmAndamento = true
    botao.textContent = "Aguarde..."
    atualizarBotoesMesas()
    try { await executar() }
    catch (erro) { acoesMesas.aoErro?.(erro) }
    finally {
      acaoEmAndamento = false
      botao.textContent = rotulo
      atualizarBotoesMesas()
    }
  })
  return botao
}

function renderizarPainelMesas() {
  const painel = document.getElementById("painelMesas")
  const estado = document.getElementById("estadoPainelMesas")
  if (!painel || !estado) return

  estado.hidden = consultaConcluida && !erroConsulta
  estado.textContent = erroConsulta
    ? consultaConcluida
      ? "Não foi possível atualizar a ocupação. Exibindo os últimos dados recebidos. Use Atualizar no painel das mesas para tentar novamente."
      : "Não foi possível consultar a ocupação. Use Atualizar no painel das mesas para tentar novamente."
    : "Consultando ocupação das mesas..."

  const horario = document.getElementById("ultimaAtualizacaoMesas")
  if (horario) {
    horario.hidden = !ultimaAtualizacao
    if (ultimaAtualizacao) {
      const data = ultimaAtualizacao.toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})
      const hora = ultimaAtualizacao.toLocaleTimeString("pt-BR", {timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"})
      horario.dateTime = ultimaAtualizacao.toISOString()
      horario.textContent = `Atualizado em ${data} às ${hora}`
      horario.className = `mesas-atualizacao${erroConsulta ? " mesas-atualizacao-antiga" : ""}`
    }
  }

  botoesMesas = []
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
        item.append(numero, produto, previaUltimaProducao(corte))
        if (acoesMesas.abrirCorte) {
          const abrir = botaoAcaoMesa("Abrir corte", () => acoesMesas.abrirCorte(corte.numero), true)
          abrir.setAttribute("aria-label", `Abrir corte ${corte.numero} da ${mesa}`)
          item.append(abrir)
        }
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
      if (consultaConcluida && acoesMesas.novoCorte) {
        const novo = botaoAcaoMesa("+ Novo corte nesta mesa", () => acoesMesas.novoCorte(mesa), !erroConsulta)
        novo.setAttribute("aria-label", `Novo corte na ${mesa}`)
        card.append(novo)
      }
    }
    painel.append(card)
  }
  atualizarBotoesMesas()
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

export function atualizarOcupacaoMesas(cortes, agora = new Date()) {
  cortesAtuais = cortes
  ultimaAtualizacao = agora
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
  const anteriores = new Map(cortesAtuais.map(corte => [String(corte.numero), corte]))
  cortesAtuais = cortesAtuais.filter(corte => normalizarMesa(corte.mesa) !== normalizarMesa(mesa))
    .concat(cortes.map(corte => ({ ...anteriores.get(String(corte.numero)), ...corte, mesa })))
  atualizarControleMesas()
}

export function definirCadastroEmAndamento(ativo) {
  cadastrando = ativo
  atualizarControleMesas()
}

export function inicializarControleMesas(acoes = {}) {
  acoesMesas = {...acoesMesas, ...acoes}
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

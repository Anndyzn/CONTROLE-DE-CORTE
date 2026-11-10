import { apiGet } from "../../core/api.js"

let dadosResumo = null
let periodoSelecionado = "hoje"
let abrirCorte = null
let ultimaConsulta = 0
let ultimaConsultaPis=0
export async function carregarPisPendentes(){
  const painel=document.getElementById("painelPisPendentes"),lista=document.getElementById("listaPisPendentes"),estado=document.getElementById("estadoPisPendentes")
  if(!painel||!lista||!estado)return
  const consulta=++ultimaConsultaPis
  try{
    const dados=await apiGet("/cortes-pis-pendentes")
    if(consulta!==ultimaConsultaPis)return
    painel.hidden=!dados.cortes.length;lista.replaceChildren()
    estado.textContent=`${dados.cortes.length} corte(s) aguardando confirmação dos PIs`
    for(const c of dados.cortes){
      const b=document.createElement("button");b.type="button";b.className="pis-pendentes-corte"
      const nome=document.createElement("strong");nome.textContent=`${c.numero} · ${c.produto}`
      const acao=document.createElement("span");acao.textContent=`${c.quantidade_pis} PI(s) · Continuar PIs →`
      b.append(nome,acao)
      b.addEventListener("click",async()=>{document.getElementById("numeroCorte").value=c.numero;await abrirCorte?.(c.numero)})
      lista.append(b)
    }
  }catch(e){if(consulta!==ultimaConsultaPis)return;painel.hidden=false;lista.replaceChildren();estado.textContent=e.message||"Não foi possível consultar PIs não confirmados."}
}

function renderizarResumo() {
  if (!dadosResumo) return

  const lista = document.getElementById("listaFinalizadosRecentes")
  const estado = document.getElementById("estadoFinalizadosRecentes")
  const cortes = dadosResumo.cortes.filter((corte) =>
    periodoSelecionado === "recentes" || corte.data_finalizacao === dadosResumo.hoje
  )

  lista.replaceChildren()
  document.getElementById("totalFinalizadosRecentes").textContent =
    `${cortes.length} ${cortes.length === 1 ? "corte" : "cortes"}`

  document.querySelectorAll("[data-periodo-finalizados]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.periodoFinalizados === periodoSelecionado))
  })

  estado.hidden = cortes.length > 0
  estado.textContent = periodoSelecionado === "hoje"
    ? "Nenhum corte finalizado hoje."
    : "Nenhum corte finalizado hoje ou nos dois dias anteriores."

  cortes.forEach((corte) => {
    const botao = document.createElement("button")
    botao.type = "button"
    botao.className = "finalizado-recente"

    const titulo = document.createElement("strong")
    titulo.textContent = `Corte ${corte.numero}`
    const produto = document.createElement("span")
    produto.className = "finalizado-produto"
    produto.textContent = corte.produto
    const detalhe = document.createElement("span")
    detalhe.className = "finalizado-detalhe"
    const data = corte.data_finalizacao.split("-").reverse().join("/")
    detalhe.textContent = `${corte.mesa} · ${data}`

    botao.append(titulo, produto, detalhe)
    botao.addEventListener("click", async () => {
      document.getElementById("numeroCorte").value = corte.numero
      await abrirCorte?.(corte.numero)
    })
    lista.appendChild(botao)
  })
}

export function inicializarResumoFinalizados(aoAbrirCorte) {
  abrirCorte = aoAbrirCorte
  document.querySelectorAll("[data-periodo-finalizados]").forEach((botao) => {
    botao.addEventListener("click", () => {
      periodoSelecionado = botao.dataset.periodoFinalizados
      renderizarResumo()
    })
  })
}

export async function carregarResumoFinalizados() {
  carregarPisPendentes()
  const estado = document.getElementById("estadoFinalizadosRecentes")
  if (!estado) return

  const consulta = ++ultimaConsulta
  try {
    const dados = await apiGet("/cortes-finalizados-recentes")
    if (consulta !== ultimaConsulta) return
    dadosResumo = dados
    renderizarResumo()
  } catch (erro) {
    if (consulta !== ultimaConsulta) return
    dadosResumo = null
    document.getElementById("listaFinalizadosRecentes").replaceChildren()
    document.getElementById("totalFinalizadosRecentes").textContent = "—"
    estado.hidden = false
    estado.textContent = "Não foi possível carregar os cortes finalizados. Atualize a página para tentar novamente."
    console.error("Erro ao carregar resumo de finalizados:", erro)
  }
}

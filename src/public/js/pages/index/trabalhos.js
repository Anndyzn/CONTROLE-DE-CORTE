import { apiGet, apiPost } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { confirmarAcao } from "../../core/confirmacao.js"
import { inicializarControleMesas } from "./mesas.js"

const campo=id=>document.getElementById(id)
const fixos=["data","turno","operador","operadorOutro","horaInicio","preencherHoraInicio"]
const numeroAtual=()=>campo("numeroCorteSelecionado").textContent.trim()
const dataBr=d=>d.split("-").reverse().join("/")
let selecionado=null,pendentes=[],corrigindo=false,sequencia=0,atualizarMesas,ultimoNumero=null

export function dadosTrabalho(){
  if(!selecionado||String(selecionado.numero_corte)!==numeroAtual())return {}
  return {trabalho_id:selecionado.id,producao_base_id:selecionado.producao_base_id??"",...(selecionado.corrigido?{corrigir_inicio:true}:{})}
}

export function limparTrabalho(){
  if(selecionado){
    const bloqueado=campo("secaoProducao").classList.contains("producao-bloqueada")
    fixos.forEach(id=>{campo(id).disabled=bloqueado})
  }
  selecionado=null
  campo("secaoProducao").classList.remove("producao-vinculada","aguardando-inicio")
  campo("trabalhoSelecionado").hidden=true
}

const trabalhoAtual=()=>pendentes.find(t=>String(t.id)===campo("trabalhoPendente").value)??pendentes[0]

function mostrarInicio(){
  const t=trabalhoAtual()
  if(!t)return
  corrigindo=false
  campo("trabalhoInicioResumo").textContent=`${t.operador} · ${t.turno} · ${t.mesa}`
  campo("trabalhoInicioHorario").textContent=`Início registrado: ${dataBr(t.data)} às ${t.hora_inicio}`
  campo("inicioRealData").value=t.data;campo("inicioRealHora").value=t.hora_inicio
  campo("camposInicioReal").hidden=true
  campo("usarInicioTrabalho").textContent="Usar meu horário de início"
  campo("corrigirInicioTrabalho").textContent="Informar início real"
}

async function confirmarInicio(){
  const escolhido=trabalhoAtual()
  if(!escolhido)return
  const corrigir=corrigindo
  const numero=numeroAtual(),dia=corrigir?campo("inicioRealData").value:escolhido.data,hora=corrigir?campo("inicioRealHora").value:escolhido.hora_inicio
  if(!dia||!hora){campo(!dia?"inicioRealData":"inicioRealHora").reportValidity();return}
  if(!selecionado&&["horaFim","folhaParouInput","statusProducao"].some(id=>campo(id).value)&&!await confirmarAcao("Usar este início e substituir os campos do lançamento em preenchimento?",{titulo:"Usar início registrado",confirmar:"Usar início"}))return
  const dados=await apiGet(`/cortes/${numero}/trabalhos`)
  if(numeroAtual()!==numero||corrigindo!==corrigir||String(trabalhoAtual()?.id)!==String(escolhido.id))return
  if(corrigir&&(campo("inicioRealData").value!==dia||campo("inicioRealHora").value!==hora))return
  const t=dados.trabalhos.find(r=>String(r.id)===String(escolhido.id))
  if(!t)throw new Error("Este trabalho já foi lançado. Atualize o corte.")
  if(!corrigir&&(t.data!==escolhido.data||t.hora_inicio!==escolhido.hora_inicio))throw new Error("O início foi alterado. Atualize e confira o horário novamente.")
  const mesmo=String(selecionado?.id)===String(t.id)
  selecionado={...t,corrigido:corrigir&&(dia!==t.data||hora!==t.hora_inicio)}
  campo("data").value=dia;campo("turno").value=t.turno
  const conhecido=[...campo("operador").options].some(o=>o.value===t.operador)
  campo("operador").value=conhecido?t.operador:"OUTRO"
  campo("operadorOutro").value=conhecido?"":t.operador
  campo("horaInicio").value=hora;campo("folhaInicio").value=t.folha_inicio
  if(!mesmo)for(const id of ["horaFim","folhaParouInput","statusProducao"])campo(id).value=""
  fixos.forEach(id=>{campo(id).disabled=true})
  campo("secaoProducao").classList.remove("aguardando-inicio")
  campo("secaoProducao").classList.add("producao-vinculada")
  campo("conferenciaInicio").hidden=true
  campo("trabalhoSelecionadoResumo").textContent=`${t.operador} · ${t.mesa} · ${t.turno} · ${dataBr(dia)} às ${hora}`
  campo("trabalhoSelecionado").hidden=false
  campo("horaFim").focus()
}

export async function atualizarTrabalhos(){
  const numero=numeroAtual(),seq=++sequencia
  if(!/^\d+$/.test(numero)){campo("painelTrabalhos").hidden=true;return}
  try{
    const dados=await apiGet(`/cortes/${numero}/trabalhos`)
    if(seq!==sequencia||numeroAtual()!==numero)return
    pendentes=dados.trabalhos
    campo("painelTrabalhos").hidden=!pendentes.length
    if(!pendentes.length){limparTrabalho();return}
    if(selecionado)return
    const select=campo("trabalhoPendente"),anterior=select.value
    select.replaceChildren()
    for(const t of pendentes){const op=document.createElement("option");op.value=String(t.id);op.textContent=`${t.operador} · ${dataBr(t.data)} ${t.hora_inicio}`;select.append(op)}
    if(pendentes.some(t=>String(t.id)===anterior))select.value=anterior
    campo("escolhaTrabalho").hidden=pendentes.length<2
    campo("conferenciaInicio").hidden=false
    campo("secaoProducao").classList.add("aguardando-inicio")
    mostrarInicio()
  }catch(e){if(seq===sequencia)mostrarToast(e.message,"atencao","Início do trabalho")}
}

async function assumir(corte){
  if(document.querySelector("dialog[open]"))return
  const dialog=campo("dialogAssumir"),operador=campo("assumirOperador"),turno=campo("assumirTurno")
  campo("assumirTitulo").textContent=`Assumir corte ${corte.numero} · ${corte.mesa}`
  operador.replaceChildren(...[...campo("operador").options].map(o=>o.cloneNode(true)))
  turno.replaceChildren(...[...campo("turno").options].map(o=>o.cloneNode(true)))
  campo("assumirOutro").value="";campo("assumirOutro").hidden=true;campo("assumirOutro").required=false
  campo("assumirInicioReal").checked=false;campo("assumirCamposReais").hidden=true
  for(const id of ["assumirDataReal","assumirHoraReal"]){campo(id).value="";campo(id).required=false}
  operador.onchange=()=>{campo("assumirOutro").hidden=operador.value!=="OUTRO";campo("assumirOutro").required=operador.value==="OUTRO"}
  const confirmou=await new Promise(resolve=>{dialog.returnValue="";dialog.onclose=()=>resolve(dialog.returnValue==="assumir");dialog.showModal()})
  if(!confirmou)return
  try{
    const r=await apiPost(`/cortes/${corte.numero}/trabalhos`,{
      operador:operador.value==="OUTRO"?campo("assumirOutro").value:operador.value,turno:turno.value,
      ...(campo("assumirInicioReal").checked?{inicio_real:{data:campo("assumirDataReal").value,hora_inicio:campo("assumirHoraReal").value}}:{})
    })
    mostrarToast(r.novo?"Início registrado. Ao lançar a produção, confirme este horário e informe o término.":"Este corte já tem um início registrado. Abra a produção para continuar.","sucesso","Trabalho registrado")
    await atualizarMesas()
    if(numeroAtual()===String(corte.numero))await atualizarTrabalhos()
  }catch(e){mostrarToast(e.message,"erro","Não foi possível assumir")}
}

export function inicializarTrabalhos({carregarCortesEmAndamento}){
  atualizarMesas=carregarCortesEmAndamento
  inicializarControleMesas({assumirTrabalho:assumir})
  new MutationObserver(()=>{
    const numero=numeroAtual()
    if(numero!==ultimoNumero){limparTrabalho();pendentes=[];ultimoNumero=numero;atualizarTrabalhos()}
    else if(selecionado)fixos.forEach(id=>{campo(id).disabled=true})
  }).observe(campo("numeroCorteSelecionado"),{childList:true,characterData:true,subtree:true})
  window.addEventListener("focus",()=>{atualizarMesas();atualizarTrabalhos()})
  campo("cancelarTrabalho").onclick=()=>{
    campo("trabalhoSelecionado").hidden=true;campo("conferenciaInicio").hidden=false
    campo("secaoProducao").classList.add("aguardando-inicio");mostrarInicio()
  }
  campo("usarInicioTrabalho").onclick=async()=>{
    const botao=campo("usarInicioTrabalho");if(botao.disabled)return;botao.disabled=true
    try{await confirmarInicio()}catch(e){mostrarToast(e.message,"erro","Início do trabalho")}finally{botao.disabled=false}
  }
  campo("corrigirInicioTrabalho").onclick=()=>{
    corrigindo=!corrigindo;campo("camposInicioReal").hidden=!corrigindo
    campo("usarInicioTrabalho").textContent=corrigindo?"Confirmar início real":"Usar meu horário de início"
    campo("corrigirInicioTrabalho").textContent=corrigindo?"Manter horário registrado":"Informar início real"
    if(corrigindo)campo("inicioRealData").focus()
  }
  campo("trabalhoPendente").onchange=mostrarInicio
  campo("atualizarTrabalhos").onclick=atualizarTrabalhos
  campo("limparProducao").addEventListener("click",atualizarTrabalhos)
  campo("assumirInicioReal").onchange=()=>{
    const real=campo("assumirInicioReal").checked;campo("assumirCamposReais").hidden=!real
    for(const id of ["assumirDataReal","assumirHoraReal"])campo(id).required=real
  }
}

import { apiGet, apiPost } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { confirmarAcao } from "../../core/confirmacao.js"
import { inicializarControleMesas } from "./mesas.js"
import { configurarRascunhoTrabalho, salvarRascunhoGrupo, versaoRascunho, limparRascunhoGrupo } from "./rascunho.js"
import { editarInicio, cancelarInicio } from "./gestao-trabalhos.js"

const campo=id=>document.getElementById(id)
const fixos=["data","turno","operador","operadorOutro","horaInicio","preencherHoraInicio"]
const numeroAtual=()=>campo("numeroCorteSelecionado").textContent.trim()
const dataBr=d=>d.split("-").reverse().join("/")
let selecionado=null,pendentes=[],sequencia=0,atualizarMesas,ultimoNumero=null,corteAtual=null

function mostrarEstadoInicio(texto,{assumir=false,repetir=false}={}){
  campo("painelAssumirCorte").hidden=false
  campo("estadoInicioTrabalho").textContent=texto
  campo("assumirCorteSelecionado").hidden=!assumir
  campo("assumirCorteSelecionado").disabled=!assumir
  campo("recarregarInicioTrabalho").hidden=!repetir
}

export function dadosTrabalho(){
  if(!selecionado||String(selecionado.numero_corte)!==numeroAtual()||campo("secaoProducao").classList.contains("aguardando-inicio"))return {}
  return {trabalho_id:selecionado.id,trabalho_versao:selecionado.versao??0,producao_base_id:selecionado.producao_base_id??"",...(selecionado.corrigido?{corrigir_inicio:true}:{})}
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
  campo("trabalhoInicioResumo").textContent=`${t.operador} · ${t.turno} · ${t.mesa}`
  campo("trabalhoInicioHorario").textContent=`Início registrado: ${dataBr(t.data)} às ${t.hora_inicio}`
  campo("usarInicioTrabalho").textContent="Usar meu horário de início"
  campo("corrigirInicioTrabalho").textContent="Corrigir início"
}

async function confirmarInicio(){
  const escolhido=trabalhoAtual()
  if(!escolhido)return
  const numero=numeroAtual(),dia=escolhido.data,hora=escolhido.hora_inicio
  if(!dia||!hora)throw new Error("Corrija a data e o horário do início antes de continuar.")
  if(!selecionado&&["horaFim","folhaParouInput","statusProducao"].some(id=>campo(id).value)&&!await confirmarAcao("Usar este início e substituir os campos do lançamento em preenchimento?",{titulo:"Usar início registrado",confirmar:"Usar início"}))return
  const dados=await apiGet(`/cortes/${numero}/trabalhos`)
  if(numeroAtual()!==numero||String(trabalhoAtual()?.id)!==String(escolhido.id))return
  const t=dados.trabalhos.find(r=>String(r.id)===String(escolhido.id))
  if(!t)throw new Error("Este trabalho já foi lançado. Atualize o corte.")
  if(t.data!==escolhido.data||t.hora_inicio!==escolhido.hora_inicio||(t.versao??0)!==(escolhido.versao??0))throw new Error("O início foi alterado. Atualize e confira os dados novamente.")
  const mesmo=String(selecionado?.id)===String(t.id)
  preencherTrabalho(t,{dia,hora,preservar:mesmo})
  salvarRascunhoGrupo("producao")
}

function preencherTrabalho(t,{dia=t.data,hora=t.hora_inicio,preservar=false,corrigido=false}={}){
  selecionado={...t,corrigido}
  campo("data").value=dia;campo("turno").value=t.turno
  const conhecido=[...campo("operador").options].some(o=>o.value===t.operador)
  campo("operador").value=conhecido?t.operador:"OUTRO"
  campo("operadorOutro").value=conhecido?"":t.operador
  campo("horaInicio").value=hora;campo("folhaInicio").value=t.folha_inicio
  if(!preservar)for(const id of ["horaFim","folhaParouInput","statusProducao"])campo(id).value=""
  fixos.forEach(id=>{campo(id).disabled=true})
  campo("secaoProducao").classList.remove("aguardando-inicio")
  campo("secaoProducao").classList.add("producao-vinculada")
  campo("conferenciaInicio").hidden=true
  campo("painelTrabalhos").hidden=false;campo("painelAssumirCorte").hidden=true
  campo("trabalhoSelecionadoResumo").textContent=`${t.operador} · ${t.mesa} · ${t.turno} · ${dataBr(dia)} às ${hora}`
  campo("trabalhoSelecionado").hidden=false
  campo("horaFim").focus()
}

function contextoRascunhoTrabalho(){
  return dadosTrabalho().trabalho_id?{id:String(selecionado.id),numero_corte:String(selecionado.numero_corte),versao:selecionado.versao??0,producao_base_id:String(selecionado.producao_base_id??""),corrigido:!!selecionado.corrigido}:null
}

export async function restaurarRascunhoTrabalho(numero,rascunho){
  if(numeroAtual()!==String(numero))return false
  const base=rascunho.base,vinculo=base?.trabalho
  const snapshot=Object.fromEntries(["data","horaInicio","horaFim","folhaParouInput","statusProducao"].map(id=>[id,campo(id).value]))
  const [dados,resumo]=await Promise.all([apiGet(`/cortes/${numero}/trabalhos`),apiGet(`/cortes/${numero}/resumo`)])
  if(numeroAtual()!==String(numero)||Object.entries(snapshot).some(([id,v])=>campo(id).value!==v))return false
  const t=dados.trabalhos.find(t=>String(t.id)===vinculo?.id)
  if(!t||resumo.ultima_producao?.status==="FINALIZADO"||Number(resumo.corte.itens_finalizados)===1||
    (t.versao??0)!==vinculo.versao||String(t.producao_base_id??"")!==String(base.id??"")||Number(t.folha_inicio)!==Number(base.folha))return false
  const dia=vinculo.corrigido?rascunho.campos.data:t.data,hora=vinculo.corrigido?rascunho.campos.horaInicio:t.hora_inicio
  if(typeof dia!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dia)||typeof hora!=="string"||!/^\d{2}:\d{2}$/.test(hora))return false
  ++sequencia;pendentes=dados.trabalhos;corteAtual=resumo.corte
  const select=campo("trabalhoPendente");select.replaceChildren()
  for(const trabalho of pendentes){const op=document.createElement("option");op.value=String(trabalho.id);op.textContent=`${trabalho.operador} · ${dataBr(trabalho.data)} ${trabalho.hora_inicio}`;select.append(op)}
  select.value=String(t.id);campo("escolhaTrabalho").hidden=pendentes.length<2
  preencherTrabalho(t,{dia,hora,corrigido:!!vinculo.corrigido})
  for(const id of ["horaFim","folhaParouInput","statusProducao"])if(typeof rascunho.campos[id]==="string"&&rascunho.campos[id].length<=100)campo(id).value=rascunho.campos[id]
  return true
}

async function gerenciarInicio(cancelar=false){
  const t=selecionado??trabalhoAtual()
  if(!t||String(t.numero_corte)!==numeroAtual())return
  const numero=numeroAtual(),antesSelecionado=selecionado,folhaAntes=campo("folhaInicio").value,versao=versaoRascunho("producao",numero)
  const resultado=await(cancelar?cancelarInicio(t):editarInicio(t))
  if(!resultado)return
  if(numeroAtual()===numero){
    if(cancelar){
      if(String(selecionado?.id)===String(t.id)){limparRascunhoGrupo("producao",numero,versao);limparTrabalho();for(const id of ["horaFim","folhaParouInput","statusProducao"])campo(id).value=""}
    }else limparTrabalho()
    await atualizarTrabalhos()
    const atualizado=pendentes.find(p=>String(p.id)===String(t.id))
    if(!cancelar&&antesSelecionado&&atualizado&&atualizado.versao===resultado.trabalho.versao&&
      String(atualizado.producao_base_id??"")===String(antesSelecionado.producao_base_id??"")&&Number(atualizado.folha_inicio)===Number(folhaAntes)){
      preencherTrabalho(atualizado,{preservar:true});salvarRascunhoGrupo("producao")
    }
  }
  await atualizarMesas()
  mostrarToast(cancelar?"Início cancelado. O corte continua aberto para um novo início.":"Início corrigido. A alteração ficou registrada no histórico do Admin.","sucesso",cancelar?"Início cancelado":"Correção salva")
}

export async function atualizarTrabalhos(){
  const numero=numeroAtual(),seq=++sequencia
  if(!/^\d+$/.test(numero)){
    limparTrabalho();corteAtual=null;campo("painelTrabalhos").hidden=true
    mostrarEstadoInicio("Selecione um corte para registrar o início do trabalho.");return
  }
  if(!selecionado&&!pendentes.length)mostrarEstadoInicio("Consultando o início do trabalho…")
  try{
    const [dados,resumo]=await Promise.all([apiGet(`/cortes/${numero}/trabalhos`),apiGet(`/cortes/${numero}/resumo`)])
    if(seq!==sequencia||numeroAtual()!==numero)return
    corteAtual=resumo.corte
    const finalizado=resumo.ultima_producao?.status==="FINALIZADO"||Number(corteAtual.itens_finalizados)===1
    pendentes=dados.trabalhos
    campo("painelTrabalhos").hidden=finalizado||!pendentes.length
    if(finalizado){limparTrabalho();mostrarEstadoInicio("Produção finalizada. Continue nos PIs cortados ou consulte o histórico.");return}
    if(!pendentes.length){limparTrabalho();mostrarEstadoInicio("Para registrar a produção, assuma o corte. Se o trabalho já começou, informe o início real.",{assumir:true});return}
    campo("painelAssumirCorte").hidden=true
    if(selecionado&&!pendentes.some(t=>String(t.id)===String(selecionado.id)))limparTrabalho()
    if(selecionado)return
    const select=campo("trabalhoPendente"),anterior=select.value
    select.replaceChildren()
    for(const t of pendentes){const op=document.createElement("option");op.value=String(t.id);op.textContent=`${t.operador} · ${dataBr(t.data)} ${t.hora_inicio}`;select.append(op)}
    if(pendentes.some(t=>String(t.id)===anterior))select.value=anterior
    campo("escolhaTrabalho").hidden=pendentes.length<2
    campo("conferenciaInicio").hidden=false
    campo("secaoProducao").classList.add("aguardando-inicio")
    mostrarInicio()
  }catch(e){if(seq===sequencia){
    if(!selecionado){corteAtual=null;campo("painelTrabalhos").hidden=true;mostrarEstadoInicio("Não foi possível conferir o início. Tente novamente para continuar.",{repetir:true})}
    mostrarToast(e.message,"atencao","Início do trabalho")
  }}
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
  configurarRascunhoTrabalho({obterContexto:contextoRascunhoTrabalho,restaurar:restaurarRascunhoTrabalho})
  inicializarControleMesas({assumirTrabalho:assumir})
  new MutationObserver(()=>{
    const numero=numeroAtual()
    if(numero!==ultimoNumero){limparTrabalho();pendentes=[];ultimoNumero=numero;atualizarTrabalhos()}
    else if(selecionado)fixos.forEach(id=>{campo(id).disabled=true})
  }).observe(campo("numeroCorteSelecionado"),{childList:true,characterData:true,subtree:true})
  window.addEventListener("focus",()=>{atualizarMesas();atualizarTrabalhos()})
  campo("cancelarTrabalho").onclick=()=>{
    if(selecionado)campo("trabalhoPendente").value=String(selecionado.id)
    campo("trabalhoSelecionado").hidden=true;campo("conferenciaInicio").hidden=false
    campo("secaoProducao").classList.add("aguardando-inicio");mostrarInicio()
  }
  campo("usarInicioTrabalho").onclick=async()=>{
    const botao=campo("usarInicioTrabalho");if(botao.disabled)return;botao.disabled=true
    try{await confirmarInicio()}catch(e){mostrarToast(e.message,"erro","Início do trabalho")}finally{botao.disabled=false}
  }
  for(const [id,cancelar] of [["corrigirInicioTrabalho",false],["cancelarInicioPendente",true],["corrigirInicioConfirmado",false],["cancelarInicioConfirmado",true]]){
    campo(id).onclick=async()=>{
      const botao=campo(id);if(botao.disabled)return;botao.disabled=true
      try{await gerenciarInicio(cancelar)}catch(e){mostrarToast(e.message,"erro","Início do trabalho")}finally{botao.disabled=false}
    }
  }
  campo("trabalhoPendente").onchange=mostrarInicio
  campo("atualizarTrabalhos").onclick=atualizarTrabalhos
  campo("recarregarInicioTrabalho").onclick=atualizarTrabalhos
  campo("assumirCorteSelecionado").onclick=async()=>{
    const botao=campo("assumirCorteSelecionado")
    if(botao.disabled||!corteAtual||String(corteAtual.numero)!==numeroAtual())return
    const numero=numeroAtual();botao.disabled=true
    try{await assumir(corteAtual)}finally{if(numero===numeroAtual()&&!botao.hidden)botao.disabled=false}
  }
  campo("limparProducao").addEventListener("click",atualizarTrabalhos)
  campo("assumirInicioReal").onchange=()=>{
    const real=campo("assumirInicioReal").checked;campo("assumirCamposReais").hidden=!real
    for(const id of ["assumirDataReal","assumirHoraReal"])campo(id).required=real
  }
}

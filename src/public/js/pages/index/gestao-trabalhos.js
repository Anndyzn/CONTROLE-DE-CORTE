import { apiPut, apiDelete } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
import { solicitarJustificativa } from "../../admin/justificativa.js"

const campo=id=>document.getElementById(id)

export async function cancelarInicio(t){
  const motivo=await solicitarJustificativa({titulo:"Cancelar início de trabalho",descricao:`${t.operador} · corte ${t.numero_corte}. O início ficará no histórico como cancelado. A produção e o corte serão preservados.`})
  if(!motivo)return false
  return apiDelete(`/cortes/${t.numero_corte}/trabalhos/${t.id}`,{...motivo,versao:t.versao??0})
}

export async function editarInicio(t){
  if(document.querySelector("dialog[open]"))return false
  const dialog=campo("dialogCorrigirInicio"),form=campo("formCorrigirInicio"),operador=campo("corrigirOperador"),turno=campo("corrigirTurno")
  form.reset()
  operador.replaceChildren(...[...campo("operador").options].map(o=>o.cloneNode(true)))
  turno.replaceChildren(...[...campo("turno").options].map(o=>o.cloneNode(true)))
  const conhecido=[...operador.options].some(o=>o.value===t.operador)
  operador.value=conhecido?t.operador:"OUTRO";campo("corrigirOutro").value=conhecido?"":t.operador
  const atualizarOperador=()=>{campo("corrigirOutro").hidden=operador.value!=="OUTRO";campo("corrigirOutro").required=operador.value==="OUTRO"}
  operador.onchange=atualizarOperador;atualizarOperador()
  turno.value=t.turno;campo("corrigirData").value=t.data;campo("corrigirHora").value=t.hora_inicio
  campo("corrigirInicioContexto").textContent=`Corte ${t.numero_corte} · ${t.mesa}`
  try{campo("corrigirResponsavel").value=localStorage.getItem("controle-corte:responsavel-admin")||""}catch{}
  const atualizarMotivo=()=>{const outro=campo("corrigirMotivoTipo").value==="OUTRO";campo("corrigirMotivoOutroGrupo").hidden=!outro;campo("corrigirMotivoOutro").required=outro}
  campo("corrigirMotivoTipo").onchange=atualizarMotivo;atualizarMotivo()
  return new Promise(resolve=>{
    let resultado=false,enviando=false
    dialog.oncancel=e=>{if(enviando)e.preventDefault()}
    campo("fecharCorrigirInicio").onclick=()=>{if(!enviando)dialog.close()}
    form.onsubmit=async e=>{
      e.preventDefault();if(enviando||!form.reportValidity())return
      const body={operador:operador.value==="OUTRO"?campo("corrigirOutro").value:operador.value,turno:turno.value,
        data:campo("corrigirData").value,hora_inicio:campo("corrigirHora").value,versao:t.versao??0,
        responsavel:campo("corrigirResponsavel").value.trim(),
        motivo:campo("corrigirMotivoTipo").value==="OUTRO"?campo("corrigirMotivoOutro").value.trim():campo("corrigirMotivoTipo").value}
      enviando=true;campo("salvarCorrigirInicio").disabled=true
      try{
        resultado=await apiPut(`/cortes/${t.numero_corte}/trabalhos/${t.id}`,body)
        try{localStorage.setItem("controle-corte:responsavel-admin",body.responsavel)}catch{}
        dialog.close()
      }catch(erro){mostrarToast(erro.message,"erro","Correção não salva")}
      finally{enviando=false;campo("salvarCorrigirInicio").disabled=false}
    }
    dialog.onclose=()=>resolve(resultado)
    dialog.showModal();operador.focus()
  })
}

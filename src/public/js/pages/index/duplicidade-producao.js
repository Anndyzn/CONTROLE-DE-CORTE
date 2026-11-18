import { apiPost } from "../../core/api.js"
import { confirmarAcao } from "../../core/confirmacao.js"

export const descreverProducao = item => `${item.data?.slice(0,10).split("-").reverse().join("/")} · ${item.turno} · ${item.operador} · ${item.hora_inicio?.slice(0,5)??"—"}–${item.hora_fim?.slice(0,5)??"—"} · folhas ${item.folha_inicio} a ${item.folha_parou}`

export async function registrarProducaoConferida(dados,{aindaAtual=()=>true,aoEncontrar=()=>{}}={}) {
  try { return await apiPost("/producao",dados) }
  catch(erro){
    if(erro.codigo!=="PRODUCAO_SEMELHANTE"||!Array.isArray(erro.registros)||!erro.confirmacao)throw erro
    if(!aindaAtual())return null
    aoEncontrar(erro.registros)
    const confirmado=await confirmarAcao(
      "Já existe produção para este corte, data, turno e operador. Confira os horários e as folhas. Se este for outro lançamento, confirme para continuar.",
      {titulo:"Possível lançamento repetido",confirmar:"Registrar outro lançamento",cancelar:"Voltar e conferir",linhas:[`Novo: ${descreverProducao(dados)}`,...erro.registros.map(r=>`Já registrado: ${descreverProducao(r)}`)]}
    )
    if(!confirmado||!aindaAtual())return null
    return apiPost("/producao",{...dados,confirmacao_duplicidade:erro.confirmacao})
  }
}

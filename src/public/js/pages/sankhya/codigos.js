import { apiGet, apiPut } from "../../core/api.js"
import { mostrarToast } from "../../core/ui.js"
let sequencia = 0
const el = id => document.getElementById(id)
function texto(tag, valor) { const e=document.createElement(tag);e.textContent=valor;return e }
export async function mostrarCodigosCorte(dados,catalogo,copiar){
  const seq=++sequencia,painel=el("codigosCorteSankhya"),lista=el("listaCodigosCorteSankhya")
  painel.hidden=false;lista.replaceChildren(texto("p","Carregando produtos e marcações..."))
  const [nomes,estados]=await Promise.allSettled([
    apiGet(`/sankhya/nomenclaturas?${new URLSearchParams({nome:dados.corte.produto})}`),
    apiGet(`/sankhya/cortes/${dados.corte.numero}/lancamentos`)
  ])
  if(seq!==sequencia)return
  const opcoes=nomes.status==="fulfilled"?nomes.value.nomes?.[0]?.opcoes??[]:[]
  lista.replaceChildren()
  if(!dados.itens.length){
    lista.append(texto("p","Este corte ainda não tem PIs registrados. Você já pode consultar ou editar os produtos vinculados ao nome abaixo; os lançamentos por cor aparecerão quando os PIs forem registrados."))
    if(!opcoes.length)lista.append(texto("p",nomes.status==="rejected"?"Não foi possível consultar os vínculos. Atualize a página para tentar novamente.":"Nenhum produto vinculado a este nome. Use ‘Consultar / editar vínculos deste nome’ para cadastrar."))
    const codigos=[...new Set(opcoes.flatMap(o=>o.codigos))]
    for(const codigo of codigos){
      const produto=catalogo.produtos.find(p=>p.codigo_produto===codigo)
      if(!produto)continue
      const linha=texto("div","");linha.className="sankhya-possibilidade"
      const botao=texto("button",`Copiar código ${codigo}`);botao.type="button";botao.addEventListener("click",()=>copiar(String(codigo)))
      linha.append(texto("span",`${codigo} — ${produto.produto}`),botao);lista.append(linha)
    }
    return
  }
  for(const item of dados.itens){
    const card=texto("article","");card.className="sankhya-codigo-item";lista.append(card)
    const estado=estados.status==="fulfilled"?estados.value.itens?.find(i=>i.id===item.id):null
    const origem=[item.modelo,item.cor,item.tecido,String(item.quantidade_pecas),String(item.metragem_usada)]
    if(estado && JSON.stringify(origem)!==JSON.stringify(estado.origem)){
      card.append(texto("h3",`${item.modelo} · ${item.cor}`),texto("p","Este PI foi alterado. Consulte o corte novamente."));continue
    }
    const destinos=item.correspondencia?.destinos??[]
    const validos=destinos.length && new Set(destinos.map(d=>d.codigo_produto)).size===destinos.length && destinos.every(d=>catalogo.produtos.some(p=>p.codigo_produto===d.codigo_produto))
    let codigos=estado?.codigos??(validos?destinos.map(d=>d.codigo_produto):opcoes.length===1?opcoes[0].codigos:[])
    codigos=[...new Set(codigos)]
    let lancados=estado?.lancados??[],versao=estado?.versao??0,ocupado=false
    let mensagemSalvamento=versao>0?"Salvo":"",falhaSalvamento=false
    const disponiveis=[...opcoes]
    for(const codigo of codigos)if(!disponiveis.some(o=>o.codigos.includes(codigo)))disponiveis.push({codigos:[codigo],rotulo:`${codigo} — ${catalogo.produtos.find(p=>p.codigo_produto===codigo)?.produto??"Fora do catálogo"}`})
    async function salvar(novos,marcados){
      if(ocupado || !estado)return
      ocupado=true;mensagemSalvamento="Salvando…";falhaSalvamento=false;renderizar()
      try{
        const r=await apiPut(`/sankhya/itens/${item.id}/lancamento`,{codigos:novos,lancados:marcados,versao,assinatura:estado.assinatura})
        codigos=novos;lancados=marcados;versao=r.versao;estado.revisar=false
        mensagemSalvamento="Salvo"
        window.dispatchEvent(new Event("sankhya-marcacao-salva"))
      }catch(e){mensagemSalvamento=`Não foi salvo. ${e.message} A seleção anterior foi mantida.`;falhaSalvamento=true}
      finally{ocupado=false;if(seq===sequencia)renderizar()}
    }
    function renderizar(){
      card.setAttribute("aria-busy",String(ocupado))
      card.replaceChildren(texto("h3",`${item.modelo} · ${item.cor}`))
      if(mensagemSalvamento){
        const feedback=texto("p",mensagemSalvamento);feedback.className=falhaSalvamento?"salvamento-feedback salvamento-erro":"salvamento-feedback";feedback.setAttribute("role","status");card.append(feedback)
      }
      if(!estado)card.append(texto("p","Não foi possível consultar as marcações. Consulte o corte novamente; os códigos continuam disponíveis para copiar."))
      if(estado?.revisar)card.append(texto("p","O PI foi corrigido. Confira os produtos e marque novamente o que foi lançado."))
      if(disponiveis.length>1){
        const campo=texto("fieldset","");campo.className="sankhya-selecao-produtos";campo.disabled=ocupado||!estado
        campo.append(texto("legend","Produtos cortados nesta cor — pode marcar mais de um"))
        for(const opcao of disponiveis){
          const label=texto("label",""),check=texto("input","");check.type="checkbox"
          check.checked=opcao.codigos.every(c=>codigos.includes(c))
          check.addEventListener("change",()=>{
            const novos=check.checked?[...new Set([...codigos,...opcao.codigos])]:codigos.filter(c=>!opcao.codigos.includes(c))
            if(lancados.some(c=>!novos.includes(c))){mostrarToast("Desmarque ‘Lançado no Sankhya’ antes de remover esse produto.","atencao");renderizar();return}
            return salvar(novos,lancados)
          })
          label.append(check,texto("span",opcao.rotulo));campo.append(label)
        }
        card.append(campo)
      }
      if(!disponiveis.length&&!codigos.length)card.append(texto("p",nomes.status==="rejected"?"Não foi possível consultar os vínculos. Consulte o corte novamente.":"Nome ainda sem produto vinculado. Cadastre em Configurar vínculos."))
      for(const codigo of codigos){
        const p=catalogo.produtos.find(p=>p.codigo_produto===codigo)
        if(!p){card.append(texto("p",`Código ${codigo} fora do catálogo. Revise a vinculação.`));continue}
        const linha=texto("div","");linha.className="sankhya-possibilidade"
        const botao=texto("button",`Copiar código ${codigo}`);botao.type="button";botao.addEventListener("click",()=>copiar(String(codigo)))
        const label=texto("label",""),check=texto("input","");check.type="checkbox";check.checked=lancados.includes(codigo);check.disabled=ocupado||!estado
        label.className="sankhya-lancado";label.append(check,texto("span",check.checked?"✓ Lançado no Sankhya":"Lançado no Sankhya"))
        check.addEventListener("change",()=>salvar(codigos,check.checked?[...lancados,codigo]:lancados.filter(c=>c!==codigo)))
        linha.append(texto("span",`${codigo} — ${p.produto}`),botao,label);card.append(linha)
      }
    }
    renderizar()
  }
}
export function limparCodigosCorte(){sequencia++;el("codigosCorteSankhya").hidden=true;el("listaCodigosCorteSankhya").replaceChildren()}

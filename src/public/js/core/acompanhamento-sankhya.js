import { apiGet } from "./api.js"
const el=id=>document.getElementById(id)
const texto=(tag,valor)=>{const e=document.createElement(tag);e.textContent=valor;return e}
const situacoes={EM_ANDAMENTO:"Em andamento",SEM_VINCULO:"Vincular produto",ESCOLHER:"Escolher produtos",PENDENTE:"Pendente",LANCADO:"Lançado"}
export function inicializarAcompanhamentoSankhya(){
 const lista=el("listaAcompanhamentoSankhya"),estado=el("estadoAcompanhamentoSankhya"),faltantes=el("nomesSemVinculoSankhya")
 if(!lista&&!faltantes)return
 let dados=null,filtro="PENDENTES",seq=0
 function renderizar(){
  if(lista){
   const cortes=dados.cortes.filter(c=>filtro==="TODOS"||(filtro==="LANCADOS"?c.situacao==="LANCADO":c.situacao!=="LANCADO"))
   lista.replaceChildren()
   const lancados=dados.cortes.filter(c=>c.situacao==="LANCADO").length
   estado.textContent=`${dados.cortes.length-lancados} pendente(s) · ${lancados} lançado(s)`
   if(!cortes.length)lista.append(texto("p","Nenhum corte neste filtro."))
   for(const c of cortes){
    const linha=texto("a","");linha.href=`sankhya.html?corte=${c.numero}`;linha.className="acompanhamento-linha"
    linha.append(texto("strong",`${c.numero} · ${c.produto}`),texto("span",`${situacoes[c.situacao]}${c.total?` · ${c.lancados}/${c.total} lançado(s)`:""}`));lista.append(linha)
   }
  }
  if(faltantes){
   faltantes.replaceChildren()
   if(!dados.faltantes.length)faltantes.append(texto("p","Todos os nomes acompanhados têm produtos vinculados."))
   for(const n of dados.faltantes){
    const link=texto("a","");link.className="acompanhamento-linha";link.href=`sankhya.html?vincular=${encodeURIComponent(n.nome)}`
    link.append(texto("strong",n.nome),texto("span",`${n.cortes.length} corte(s) · Vincular →`));faltantes.append(link)
   }
  }
 }
 async function atualizar(){
  const s=++seq
  try{const r=await apiGet("/sankhya/acompanhamento");if(s!==seq)return;dados=r;renderizar()}
  catch(e){if(s!==seq)return;if(estado)estado.textContent=e.message;if(faltantes)faltantes.replaceChildren(texto("p",e.message))}
 }
 el("atualizarAcompanhamentoSankhya")?.addEventListener("click",atualizar)
 for(const [id,valor] of [["pendentesSankhya","PENDENTES"],["lancadosSankhya","LANCADOS"],["todosSankhya","TODOS"]])el(id)?.addEventListener("click",()=>{
  filtro=valor
  for(const b of ["pendentesSankhya","lancadosSankhya","todosSankhya"])el(b).setAttribute("aria-pressed",String(b===id))
  if(dados)renderizar()
 })
 window.addEventListener("sankhya-marcacao-salva",atualizar)
 window.addEventListener("focus",atualizar)
 atualizar()
}

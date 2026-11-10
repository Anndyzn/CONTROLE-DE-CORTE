export function inicializarAbasAdmin(){
 const abas=[['abaCorrecoesAdmin','painelCorrecoesAdmin'],['abaNomesAdmin','painelNomesAdmin'],['abaHistoricoAdmin','painelHistoricoAdmin']]
 function selecionar(indice,focar=false){
  abas.forEach(([id,painel],i)=>{const botao=document.getElementById(id);botao.setAttribute('aria-selected',String(i===indice));botao.tabIndex=i===indice?0:-1;document.getElementById(painel).hidden=i!==indice;if(i===indice&&focar)botao.focus()})
 }
 abas.forEach(([id],i)=>{
  const b=document.getElementById(id)
  b.addEventListener('click',()=>selecionar(i))
  b.addEventListener('keydown',e=>{let proxima;if(e.key==='ArrowRight')proxima=(i+1)%abas.length;if(e.key==='ArrowLeft')proxima=(i+abas.length-1)%abas.length;if(e.key==='Home')proxima=0;if(e.key==='End')proxima=abas.length-1;if(proxima!==undefined){e.preventDefault();selecionar(proxima,true)}})
 })
 selecionar(0)
}

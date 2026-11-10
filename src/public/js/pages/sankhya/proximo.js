import { apiGet } from "../../core/api.js"
export function escolherProximoPendente(cortes,atual){
  return cortes.filter(c=>Number(c.numero)!==Number(atual)&&["PENDENTE","SEM_VINCULO","ESCOLHER"].includes(c.situacao)).at(-1)??null
}
export function inicializarProximoPendente(obterAtual,abrir){
  const botao=document.getElementById("proximoPendenteSankhya"),estado=document.getElementById("estadoProximoPendenteSankhya")
  if(!botao||!estado)return
  let ocupado=false
  botao.addEventListener("click",async()=>{
    if(ocupado)return
    if(document.querySelector?.('#codigosCorteSankhya [aria-busy="true"]')){estado.textContent="Aguarde a marcação terminar de salvar.";return}
    ocupado=true;botao.disabled=true;estado.textContent="Buscando próximo pendente..."
    try{
      const dados=await apiGet("/sankhya/acompanhamento")
      const proximo=escolherProximoPendente(dados.cortes,obterAtual())
      if(!proximo){estado.textContent="Não há outro corte finalizado pendente.";return}
      estado.textContent="";abrir(proximo.numero)
    }catch(e){estado.textContent=e.message||"Não foi possível consultar a fila. Tente novamente."}
    finally{ocupado=false;botao.disabled=false}
  })
}

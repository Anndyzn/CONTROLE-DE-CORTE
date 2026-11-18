import { apiPost } from "../../core/api.js"
import { confirmarAcao } from "../../core/confirmacao.js"
import { mostrarToast } from "../../core/ui.js"
import { carregarItensCorte } from "./itens.js"
import { carregarPisPendentes } from "./finalizados.js"
import { validarValoresItem } from "../../utils/validations.js"
import { limparRascunhoGrupo, versaoRascunho } from "./rascunho.js"

const campos=["cor","metragem_usada","sobra_metros","perda_metros","metros_faltantes","quantidade_pecas"]
const el=id=>document.getElementById(id)
const normalizar=s=>s.trim().replace(/\s+/g," ").toUpperCase()

export function validarLinhasGrade(linhas,modelo,tecido) {
  if(!modelo.trim()||!tecido.trim())throw new Error("Informe o produto cortado e o tecido.")
  const usadas=linhas.filter(l=>campos.some(c=>String(l[c]??"").trim()!==""))
  if(!usadas.length)throw new Error("Preencha pelo menos uma cor, a metragem e a quantidade de peças.")
  if(usadas.length>50)throw new Error("Salve no máximo 50 cores por vez.")
  const cores=new Set()
  return usadas.map((l,i)=>{
    const cor=normalizar(String(l.cor??""))
    if(!cor||String(l.metragem_usada??"").trim()===""||String(l.quantidade_pecas??"").trim()==="")throw new Error(`Linha ${i+1}: informe cor, metragem e peças. Para aproveitamento, informe metragem 0.`)
    if(cores.has(cor))throw new Error(`A cor ${cor} está repetida. Confira as linhas antes de salvar.`)
    cores.add(cor)
    const erro=validarValoresItem({metragem:l.metragem_usada,sobra:l.sobra_metros||0,perda:l.perda_metros||0,faltantes:l.metros_faltantes||0,quantidade:l.quantidade_pecas})
    if(erro)throw new Error(`Linha ${i+1}: ${erro}`)
    return {modelo:normalizar(modelo),tecido:normalizar(tecido),cor,...Object.fromEntries(campos.slice(1).map(c=>[c,Number(l[c]||0)]))}
  })
}

export function inicializarGradePis() {
  const form=el("formItensCorte"),grade=el("gradePis"),lista=el("linhasGradePis"),estado=el("estadoGradePis")
  if(!form||!grade)return
  let numero="",ocupado=false
  const chave=()=>`grade-pis-v1:${numero}`
  const dados=()=>[...lista.querySelectorAll("tr")].map(tr=>Object.fromEntries([...tr.querySelectorAll("input")].map(c=>[c.name,c.value])))
  const produto=()=>el("modeloItem").value.trim()
  const tecido=()=>el("tecidoItem").value==="OUTRA"?el("tecidoOutro").value.trim():el("tecidoItem").value
  function guardar(){
    if(!form.classList.contains("modo-grade"))return
    const linhas=dados(),pendente=linhas.some(l=>campos.some(c=>l[c]!==""))
    grade.dataset.pendente=String(pendente)
    if(!numero)return
    try {
      if(pendente)sessionStorage.setItem(chave(),JSON.stringify({linhas,modelo:produto(),tecido:el("tecidoItem").value,outro:el("tecidoOutro").value}))
      else sessionStorage.removeItem(chave())
    }catch { /* O cadastro permanece disponível se a memória estiver bloqueada. */ }
  }
  function adicionar(linha={}){
    if(lista.children.length>=50){estado.textContent="Limite de 50 cores por envio.";return}
    const tr=document.createElement("tr")
    campos.forEach((campo,i)=>{
      const td=document.createElement("td"),input=document.createElement("input")
      input.name=campo;input.type=i===0?"text":"number";input.value=linha[campo]??""
      input.setAttribute("aria-label",`${["Cor","Metragem","Sobra","Perda","Metros faltantes","Peças"][i]} da linha ${lista.children.length+1}`)
      if(i===0){input.setAttribute("list","coresGradePis");input.placeholder="Digite a cor"}
      else {input.min="0";input.step="any";input.placeholder=i===1||i===5?"Obrigatório":"0"}
      input.addEventListener("input",guardar);td.append(input);tr.append(td)
    })
    const td=document.createElement("td"),remover=document.createElement("button")
    remover.type="button";remover.textContent="Remover";remover.className="btn-secondary"
    remover.addEventListener("click",()=>{tr.remove();if(!lista.children.length)adicionar();guardar()})
    td.append(remover);tr.append(td);lista.append(tr)
    return tr
  }
  function modo(usarGrade){
    if(ocupado||el("salvarItemCorte")?.disabled)return
    form.classList.toggle("modo-grade",usarGrade)
    el("modoPiGrade").setAttribute("aria-pressed",String(usarGrade))
    el("modoPiIndividual").setAttribute("aria-pressed",String(!usarGrade))
  }
  el("modoPiGrade").addEventListener("click",()=>{
    if(el("itemEditandoId").value){mostrarToast("Salve a correção do PI antes de mudar para a grade.","atencao");return}
    if(grade.dataset.pendente==="true") {
      try {const salvo=JSON.parse(sessionStorage.getItem(chave()));if(salvo){el("modeloItem").value=salvo.modelo;el("tecidoItem").value=salvo.tecido;el("tecidoOutro").value=salvo.outro;el("tecidoOutro").style.display=salvo.tecido==="OUTRA"?"block":"none"}}catch{}
    }
    modo(true)
  })
  el("modoPiIndividual").addEventListener("click",()=>modo(false))
  el("adicionarCorPi").addEventListener("click",()=>adicionar()?.querySelector("input")?.focus())
  for(const id of ["modeloItem","tecidoItem","tecidoOutro"])el(id).addEventListener("input",guardar)
  for(const opcao of el("corItem").options){if(opcao.value&&opcao.value!=="OUTRA"){const o=document.createElement("option");o.value=opcao.value;el("coresGradePis").append(o)}}
  function contexto(){
    const atual=el("numeroCorteSelecionado").textContent.trim()
    if(atual===numero)return
    numero=/^\d+$/.test(atual)?atual:""
    lista.replaceChildren();adicionar();grade.dataset.pendente="false";estado.textContent="Adicione as cores cortadas."
    el("rascunhoGradeAviso").hidden=true
    try{el("rascunhoGradeAviso").hidden=!numero||!sessionStorage.getItem(chave())}catch{}
    modo(true)
  }
  el("restaurarGradePis").addEventListener("click",()=>{
    try {
      const salvo=JSON.parse(sessionStorage.getItem(chave()))
      if(!Array.isArray(salvo?.linhas))return
      el("modeloItem").value=salvo.modelo??"";el("tecidoItem").value=salvo.tecido??"";el("tecidoOutro").value=salvo.outro??""
      el("tecidoOutro").style.display=salvo.tecido==="OUTRA"?"block":"none"
      lista.replaceChildren();salvo.linhas.slice(0,50).forEach(adicionar);guardar();el("rascunhoGradeAviso").hidden=true
    }catch {estado.textContent="Não foi possível restaurar a grade."}
  })
  el("salvarGradePis").addEventListener("click",async()=>{
    if(ocupado||form.style.display==="none")return
    const corte=numero
    if(!corte||String(el("numeroCorte").value)!==corte){estado.textContent="Selecione o corte novamente antes de salvar.";return}
    const invalido=[...lista.querySelectorAll("input")].find(c=>c.checkValidity?.()===false)
    if(invalido){invalido.reportValidity();return}
    let itens
    try {itens=validarLinhasGrade(dados(),produto(),tecido())}catch(e){estado.textContent=e.message;return}
    ocupado=true;grade.dataset.ocupado="true"
    const controles=[...form.querySelectorAll("input,select,button")],bloqueios=controles.map(c=>c.disabled)
    controles.forEach(c=>c.disabled=true)
    const versao=versaoRascunho("item",corte)
    try {
      const confirmado=await confirmarAcao(`${itens.length} cor(es). Confira os valores antes de salvar os PIs.`,{
        titulo:`Corte ${corte} · ${produto()}`,confirmar:"Salvar cores",linhas:itens.map(i=>`${i.cor} · ${i.tecido} — ${i.quantidade_pecas} peças · ${i.metragem_usada} m usados · sobra ${i.sobra_metros} m · perda ${i.perda_metros} m · faltantes ${i.metros_faltantes} m`)
      })
      if(!confirmado||numero!==corte||String(el("numeroCorte").value)!==corte)return
      estado.textContent="Salvando todas as cores…"
      await apiPost("/itens-corte/lote",{numero_corte:Number(corte),itens})
      try{sessionStorage.removeItem(`grade-pis-v1:${corte}`)}catch{}
      limparRascunhoGrupo("item",corte,versao)
      if(numero!==corte)return
      lista.replaceChildren();adicionar();grade.dataset.pendente="false";el("rascunhoGradeAviso").hidden=true
      estado.textContent=`${itens.length} PI(s) salvo(s). Adicione outro produto ou confirme os PIs abaixo.`
      mostrarToast("Cores salvas. Confira os itens e confirme os PIs para concluir.","sucesso")
      await carregarItensCorte(corte);carregarPisPendentes()
    }catch(e){estado.textContent=e.message||"Não foi possível salvar. Os valores foram mantidos."}
    finally {
      ocupado=false;grade.dataset.ocupado="false"
      if(form.style.display!=="none")controles.forEach((c,i)=>c.disabled=bloqueios[i])
    }
  })
  new MutationObserver(contexto).observe(el("numeroCorteSelecionado"),{childList:true,characterData:true,subtree:true})
  contexto();modo(true)
}

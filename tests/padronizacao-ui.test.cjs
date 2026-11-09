const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos,chamadas,mensagens,obter,enviar,justificar,ocultou,eventos,sequencia=0
class Elemento {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.eventos={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.textContent=''}
  append(...filhos){this.children.push(...filhos)}
  replaceChildren(...filhos){this.children=[];this.append(...filhos)}
  addEventListener(nome,fn){this.eventos[nome]=fn}
  setAttribute(nome,valor){this[nome]=valor}
  reportValidity(){return true}
}
beforeEach(async()=>{
  elementos={};chamadas=[];mensagens=[];ocultou=0;eventos=[]
  for(const id of ['painelPadronizacao','camposFiltroPadronizacao','camposPadronizacao','aplicarPadronizacao','previaPadronizacao','selecaoPadronizacao','nomesPadronizacao','estadoPadronizacao','tipoPadronizacao','buscaPadronizacao','destinoPadronizacao','formPadronizacao','resumoPadronizacao','registrosPadronizacao','filtroPadronizacao'])elementos[id]=new Elemento()
  elementos.tipoPadronizacao.value='modelos';elementos.painelPadronizacao.open=true
  obter=async()=>({nomes:[{nome:'CONJUNTO FEMINIA',registros:2,cortes:1},{nome:'CONJUNTO FEMININO',registros:3,cortes:2}],tem_mais:false})
  enviar=async(url)=>url.endsWith('/previa')?{token:'a'.repeat(64),total:2,cortes:1,correspondencias:1,destino:'CONJUNTO FEMININO',registros:[{id:1,numero_corte:922,antes:'CONJUNTO FEMINIA',depois:'CONJUNTO FEMININO'}]}:{total:2,correspondencias:1}
  justificar=async()=>({responsavel:'ANDY',motivo:'Corrigir grafias'})
  globalThis.document={getElementById:id=>elementos[id],createElement:tag=>new Elemento(tag),dispatchEvent:e=>eventos.push(e.type)}
  globalThis.__padronizacaoDeps={apiGet:url=>{chamadas.push({url});return obter(url)},apiPost:(url,body)=>{chamadas.push({url,body});return enviar(url,body)},mostrarToast:(...args)=>mensagens.push(args),solicitarJustificativa:(...args)=>justificar(...args),esconderDetalhesAdmin:()=>ocultou++}
  const codigo=fs.readFileSync('src/public/js/admin/padronizacao.js','utf8').replace(/^import .*$/gm,'')
  const modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,apiPost,mostrarToast,solicitarJustificativa,esconderDetalhesAdmin}=globalThis.__padronizacaoDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarPadronizacao()
})
const abrir=()=>elementos.painelPadronizacao.eventos.toggle()
const conferir=()=>elementos.formPadronizacao.eventos.submit({preventDefault(){}})
const aplicar=()=>elementos.aplicarPadronizacao.eventos.click()
const caixa=indice=>elementos.nomesPadronizacao.children[indice].children[0].children[0]
async function preparar(){await abrir();caixa(0).checked=true;caixa(0).eventos.change();elementos.destinoPadronizacao.value='CONJUNTO FEMININO';await conferir()}

test('lista somente ao abrir e apresenta nomes como texto, com seleção manual',async()=>{
  assert.equal(chamadas.length,0)
  obter=async()=>({nomes:[{nome:'<script>nome</script>',registros:1,cortes:1}],tem_mais:false})
  await abrir()
  assert.equal(elementos.nomesPadronizacao.children[0].children[1].children[0].textContent,'<script>nome</script>')
  assert.equal(caixa(0).checked,false)
  assert.equal(chamadas.filter(c=>c.body).length,0)
})
test('prévia mostra os afetados e qualquer edição do destino ou seleção a invalida',async()=>{
  await preparar()
  assert.equal(elementos.previaPadronizacao.hidden,false)
  assert.equal(elementos.aplicarPadronizacao.disabled,false)
  assert.match(elementos.resumoPadronizacao.textContent,/2 registro/)
  assert.deepEqual(chamadas.find(c=>c.body).body,{tipo:'modelos',origens:['CONJUNTO FEMINIA'],destino:'CONJUNTO FEMININO'})
  elementos.destinoPadronizacao.value='OUTRO';elementos.destinoPadronizacao.eventos.input()
  assert.equal(elementos.previaPadronizacao.hidden,true)
  await aplicar();assert.equal(chamadas.filter(c=>c.url.endsWith('/aplicar')).length,0)
  await conferir();caixa(0).checked=false;caixa(0).eventos.change()
  assert.equal(elementos.aplicarPadronizacao.disabled,true)
})
test('aplicar exige justificativa, manda o token da prévia e atualiza lista após sucesso',async()=>{
  await preparar();await aplicar()
  const envio=chamadas.find(c=>c.url.endsWith('/aplicar'))
  assert.equal(envio.body.token,'a'.repeat(64));assert.equal(envio.body.responsavel,'ANDY')
  assert.equal(envio.body.motivo,'Corrigir grafias')
  assert.equal(ocultou,1);assert.deepEqual(eventos,['corte-admin-carregado'])
  assert.equal(elementos.previaPadronizacao.hidden,true)
  assert.match(elementos.estadoPadronizacao.textContent,/2 registro\(s\) padronizado/)
})
test('cancelar justificativa conserva prévia e não envia; clique duplo fica bloqueado',async()=>{
  await preparar();justificar=async()=>null;await aplicar()
  assert.equal(chamadas.filter(c=>c.url.endsWith('/aplicar')).length,0)
  assert.equal(elementos.previaPadronizacao.hidden,false)
  let resolver;justificar=()=>new Promise(resolve=>{resolver=resolve})
  const pendente=aplicar();await aplicar()
  assert.equal(elementos.camposFiltroPadronizacao.disabled,true)
  resolver({responsavel:'ANDY',motivo:'Corrigir grafias'});await pendente
  assert.equal(chamadas.filter(c=>c.url.endsWith('/aplicar')).length,1)
})
test('falha ou conflito invalida confirmação e preserva nomes selecionados para nova prévia',async()=>{
  await preparar();enviar=async()=>{throw new Error('Registros mudaram; gere uma nova prévia')}
  await aplicar()
  assert.equal(elementos.previaPadronizacao.hidden,true)
  assert.equal(elementos.aplicarPadronizacao.disabled,true)
  assert.equal(caixa(0).checked,true)
  assert.match(elementos.estadoPadronizacao.textContent,/nova prévia/)
  assert.equal(ocultou,0)
})
test('trocar categoria ou refazer busca descarta a prévia antiga; seleção vazia não consulta',async()=>{
  await abrir();await conferir();assert.equal(chamadas.filter(c=>c.body).length,0)
  caixa(0).checked=true;elementos.destinoPadronizacao.value='CORRETO';await conferir()
  elementos.tipoPadronizacao.value='cortes';await elementos.tipoPadronizacao.eventos.change()
  assert.equal(elementos.previaPadronizacao.hidden,true)
  assert.equal(elementos.destinoPadronizacao.value,'')
  assert.equal(caixa(0).checked,false)
  assert.match(chamadas.at(-1).url,/tipo=cortes/)
})

const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, eventos, chamadas, mensagens, justificar, salvar, modulo, sequencia=0
function elemento() {return {hidden:true,disabled:false,value:'',textContent:'',dataset:{},eventos:{},
  addEventListener(nome,fn){this.eventos[nome]=fn},setAttribute(nome,valor){this[nome]=valor},focus(){},
  setCustomValidity(v){this.erro=v},reportValidity(){return !elementos.novoProdutoAdmin.erro}}}
beforeEach(async()=>{
  elementos=Object.fromEntries(['formProdutoAdmin','editarProdutoAdmin','cancelarProdutoAdmin','salvarProdutoAdmin','novoProdutoAdmin','adminCorteProduto','adminCorteNumero'].map(id=>[id,elemento()]))
  elementos.adminCorteNumero.textContent='917'
  elementos.adminCorteProduto.dataset.nomeOriginal='LISO INFRIOR'
  elementos.adminCorteProduto.textContent='LISO INFRIOR'
  chamadas=[];mensagens=[];eventos={}
  justificar=async()=>({responsavel:'ANDY',motivo:'Corrigir digitação'})
  salvar=async(url,body)=>{chamadas.push({url,body});return {corte:{produto:body.produto}}}
  globalThis.document={getElementById:id=>elementos[id],addEventListener:(nome,fn)=>{eventos[nome]=fn}}
  globalThis.__produtoDeps={apiPut:(...args)=>salvar(...args),mostrarToast:(...args)=>mensagens.push(args),solicitarJustificativa:(...args)=>justificar(...args)}
  const codigo=fs.readFileSync('src/public/js/admin/produto-admin.js','utf8').replace(/^import .*$/gm,'')
  modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiPut,mostrarToast,solicitarJustificativa}=globalThis.__produtoDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarProdutoAdmin()
})
const abrir=()=>elementos.editarProdutoAdmin.eventos.click()
const enviar=()=>elementos.formProdutoAdmin.eventos.submit({preventDefault(){}})

test('corrigir produto confirma justificativa e envia somente o corte selecionado',async()=>{
  abrir()
  assert.equal(elementos.novoProdutoAdmin.value,'LISO INFRIOR')
  elementos.novoProdutoAdmin.value=' liso inferior '
  await enviar()
  assert.deepEqual(chamadas,[{url:'/cortes/917/produto',body:{produto:'LISO INFERIOR',produto_anterior:'LISO INFRIOR',responsavel:'ANDY',motivo:'Corrigir digitação'}}])
  assert.equal(elementos.adminCorteProduto.textContent,'LISO INFERIOR')
  assert.equal(elementos.formProdutoAdmin.hidden,true)
  assert.equal(elementos.salvarProdutoAdmin.disabled,false)
})

test('cancelar justificativa ou não mudar o nome não envia correção',async()=>{
  abrir(); await enviar()
  assert.equal(chamadas.length,0)
  abrir();elementos.novoProdutoAdmin.value='NOVO';justificar=async()=>null
  await enviar()
  assert.equal(chamadas.length,0)
  assert.equal(elementos.formProdutoAdmin.hidden,false)
  assert.equal(elementos.novoProdutoAdmin.value,'NOVO')
})

test('nome vazio e falha do servidor preservam o produto e a edição',async()=>{
  abrir();elementos.novoProdutoAdmin.value='  '
  await enviar()
  assert.equal(chamadas.length,0)
  elementos.novoProdutoAdmin.value='NOVO'
  salvar=async()=>{throw new Error('Produto alterado por outra tela')}
  await enviar()
  assert.equal(elementos.adminCorteProduto.textContent,'LISO INFRIOR')
  assert.equal(elementos.formProdutoAdmin.hidden,false)
  assert.match(mensagens.at(-1)[0],/outra tela/)
})

test('trocar o corte durante a justificativa impede salvar a correção antiga',async()=>{
  abrir();elementos.novoProdutoAdmin.value='NOVO'
  let resolver
  justificar=()=>new Promise(resolve=>{resolver=resolve})
  const envio=enviar()
  elementos.adminCorteNumero.textContent='918'
  elementos.adminCorteProduto.dataset.nomeOriginal='OUTRO PRODUTO'
  elementos.adminCorteProduto.textContent='OUTRO PRODUTO'
  eventos['corte-admin-carregado']()
  resolver({responsavel:'ANDY',motivo:'Corrigir digitação'})
  await envio
  assert.equal(chamadas.length,0)
  assert.equal(elementos.adminCorteProduto.textContent,'OUTRO PRODUTO')
})

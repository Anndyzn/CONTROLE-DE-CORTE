const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let eventos, elementos, buscas, itens, atualizacoes, sequencia=0
beforeEach(async()=>{
  eventos={};buscas=[];itens=[];atualizacoes=0
  elementos={corteSelecionado:{hidden:true},numeroCorteSelecionado:{textContent:'--'},numeroCorte:{value:'999'},syncStatus:{classList:{remove(){},add(){}},innerHTML:''}}
  globalThis.document={getElementById:id=>elementos[id]}
  const canal={on(tipo,filtro,callback){eventos[filtro.table]=callback;return this},subscribe(){return this}}
  globalThis.window={supabase:{createClient:()=>({channel:()=>canal})}}
  globalThis.__realtimeDeps={carregarCortesEmAndamento:async()=>atualizacoes++,buscarCorte:async(...args)=>buscas.push(args),carregarItensCorte:async numero=>itens.push(numero),SUPABASE_URL:'teste',SUPABASE_PUBLIC_KEY:'teste'}
  const codigo=fs.readFileSync('src/public/js/core/realtime.js','utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'')
  const nomes=Object.keys(globalThis.__realtimeDeps).join(',')
  const modulo=await import(`data:text/javascript;base64,${Buffer.from(`const {${nomes}}=globalThis.__realtimeDeps;\n`+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarRealtime()
})

test('tempo real atualiza o acompanhamento sem abrir formulário a partir do número digitado',async()=>{
  await eventos.producao({})
  await eventos.itens_corte({})
  assert.equal(atualizacoes,1)
  assert.equal(buscas.length,0)
  assert.equal(itens.length,0)
})

test('tempo real usa o corte selecionado e pede atualização sem rolar a tela',async()=>{
  elementos.corteSelecionado.hidden=false
  elementos.numeroCorteSelecionado.textContent='922'
  await eventos.cortes({})
  await eventos.itens_corte({})
  assert.deepEqual(buscas,[['922',{rolar:false}]])
  assert.deepEqual(itens,['922'])
})

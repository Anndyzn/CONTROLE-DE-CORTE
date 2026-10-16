const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let modulo, botao, consulta, buscar, links, mensagens, sequencia=0
beforeEach(async t=>{
  botao={disabled:true,textContent:'📥 Exportar Excel',addEventListener(nome,fn){this[nome]=fn}}
  consulta=null;links=[];mensagens=[]
  buscar=async()=>({ok:true,blob:async()=>new Blob(['xlsx']),headers:new Headers({'Content-Disposition':'attachment; filename="relatorio-cortes-2026-10-16.xlsx"'})})
  t.mock.method(globalThis,'fetch',(...args)=>buscar(...args))
  t.mock.method(globalThis,'setTimeout',fn=>{fn();return 1})
  t.mock.method(URL,'createObjectURL',()=> 'blob:relatorio')
  t.mock.method(URL,'revokeObjectURL',()=>{})
  globalThis.document={getElementById:()=>botao,body:{append(){}},createElement:()=>{
    const link={click(){this.clicado=true},remove(){this.removido=true}};links.push(link);return link
  }}
  globalThis.__exportarDeps={mostrarToast:(...args)=>mensagens.push(args)}
  const codigo=fs.readFileSync('src/public/js/pages/consultar/exportar.js','utf8').replace(/^import .*$/gm,'')
  modulo=await import(`data:text/javascript;base64,${Buffer.from('const {mostrarToast}=globalThis.__exportarDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
})

test('exportação usa os filtros aplicados e libera o download com nome .xlsx',async()=>{
  const atualizar=modulo.inicializarExportacao(()=>consulta)
  atualizar();assert.equal(botao.disabled,true)
  consulta='produto=MANTA&status=FINALIZADO';atualizar()
  const original=buscar
  buscar=async url=>{assert.equal(url,'/consultar-cortes/exportar?'+consulta);return original()}
  await botao.click()
  assert.equal(links[0].download,'relatorio-cortes-2026-10-16.xlsx')
  assert.equal(links[0].clicado,true)
  assert.equal(links[0].removido,true)
  assert.equal(botao.disabled,false)
  assert.equal(mensagens.at(-1)[1],'sucesso')
})

test('exportação impede duplicidade e permanece desabilitada se uma nova busca falhar',async()=>{
  const atualizar=modulo.inicializarExportacao(()=>consulta)
  consulta='';atualizar()
  let resolver, chamadas=0
  const original=buscar
  buscar=()=>{chamadas++;return new Promise(resolve=>{resolver=resolve})}
  const envio=botao.click()
  assert.equal(botao.disabled,true)
  await botao.click()
  assert.equal(chamadas,1)
  consulta=null;atualizar()
  resolver(await original());await envio
  assert.equal(botao.disabled,true)
})

test('erro de exportação mostra a mensagem e permite tentar novamente',async()=>{
  consulta='numero=917'
  modulo.inicializarExportacao(()=>consulta)()
  buscar=async()=>({ok:false,json:async()=>({erro:'Nenhum corte encontrado'})})
  await botao.click()
  assert.equal(links.length,0)
  assert.equal(botao.disabled,false)
  assert.equal(mensagens.at(-1)[0],'Nenhum corte encontrado')
})

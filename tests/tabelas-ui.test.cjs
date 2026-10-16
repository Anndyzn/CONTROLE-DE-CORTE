const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('adaptação mantém as células e ações, rotula novos registros e trata mensagens vazias',async()=>{
  const elemento=(textContent='')=>({textContent,dataset:{},colSpan:1,atributos:{},classes:new Set(),
    setAttribute(nome,valor){this.atributos[nome]=valor},
    get classList(){return {add:n=>this.classes.add(n),toggle:(n,ativo)=>ativo?this.classes.add(n):this.classes.delete(n)}}})
  const headers=['Número','Produto','Ações'].map(elemento)
  const linha=elemento();linha.cells=[elemento('917'),elemento('LISO'),elemento('Abrir')]
  let cliques=0
  linha.cells[2].onclick=()=>cliques++
  const original=linha.cells[2]
  const vazia=elemento();vazia.cells=[elemento('Nenhum corte')];vazia.cells[0].colSpan=3
  let linhas=[linha,vazia], observado, desconectado=false
  const wrapper=elemento(),grupo=elemento(),cabecalho=elemento()
  const tabela=elemento()
  tabela.closest=()=>wrapper
  tabela.querySelectorAll=seletor=>seletor==='thead th'?headers:seletor==='tbody tr'?linhas:seletor==='thead tr'?[cabecalho]:[grupo]
  globalThis.document={querySelectorAll:()=>[tabela]}
  globalThis.MutationObserver=class {constructor(callback){observado=callback}observe(){}disconnect(){desconectado=true}}
  const codigo=fs.readFileSync('src/public/js/core/tabelas.js','utf8')
  const {inicializarTabelasResponsivas}=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
  const desconectar=inicializarTabelasResponsivas()
  assert.equal(linha.cells[1].dataset.label,'Produto')
  assert.equal(linha.cells[2],original)
  linha.cells[2].onclick();assert.equal(cliques,1)
  assert.ok(linha.cells[2].classes.has('tabela-acoes'))
  assert.equal(vazia.cells[0].dataset.label,undefined)
  assert.equal(tabela.atributos.role,'table')
  assert.equal(headers[0].atributos.scope,'col')
  const nova=elemento();nova.cells=[elemento('918'),elemento('MANTA'),elemento('Abrir')]
  linhas=[nova];observado()
  assert.equal(nova.cells[0].dataset.label,'Número')
  assert.equal(nova.cells[2].dataset.label,'Ações')
  desconectar();assert.equal(desconectado,true)
})

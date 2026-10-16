const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, consultar, obterExportacao, modulo, sequencia=0
function elemento() {
  return {value:'',textContent:'',disabled:false,dataset:{},style:{setProperty(nome,valor){this[nome]=valor}},
    children:[],eventos:{},classList:{add(){},remove(){}},focus(){},
    set innerHTML(valor){this.html=valor;this.children=[]},get innerHTML(){return this.html},
    appendChild(filho){this.children.push(filho)},addEventListener(nome,fn){this.eventos[nome]=fn}}
}
beforeEach(async()=>{
  elementos=Object.fromEntries(['buscarFiltros','limparFiltros','carregarMaisCortes','filtroNumero','filtroProduto','filtroDataInicial','filtroDataFinal','filtroStatus','resultadoFiltros','totalConsulta','consultaCarregarMais','consultaExibidos','detalheCorte','dashboardCorte','historicoConsulta','itensConsulta'].map(id=>[id,elemento()]))
  globalThis.document={getElementById:id=>elementos[id],querySelectorAll:()=>[],createElement:()=>{
    const row=elemento()
    Object.defineProperty(row,'innerHTML',{set(valor){this.html=valor;this.children=Array.from({length:6},elemento)},get(){return this.html}})
    return row
  }}
  consultar=async()=>[]
  globalThis.__consultaDeps={apiGet:(...args)=>consultar(...args),definirCarregamento:()=>{},mostrarToast:()=>{},
    maiusculo:v=>String(v).toUpperCase(),formatarData:v=>v,carregarHistoricoConsulta:()=>{},carregarItensConsulta:()=>{},carregarDashboardCorte:()=>{},
    inicializarExportacao:obter=>{obterExportacao=obter;return ()=>{}}}
  const codigo=fs.readFileSync('src/public/js/pages/consultar/filtros.js','utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'')
  const nomes=Object.keys(globalThis.__consultaDeps).join(',')
  modulo=await import(`data:text/javascript;base64,${Buffer.from(`const {${nomes}}=globalThis.__consultaDeps;\n`+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarFiltros()
})

test('exporta a busca aplicada e não apenas as 20 linhas ou os filtros ainda não buscados',async()=>{
  elementos.filtroDataInicial.value='2026-10-14'
  elementos.filtroDataFinal.value='2026-10-16'
  consultar=async()=>Array.from({length:45},(_,i)=>({numero:917-i,produto:'MANTA',status:'FINALIZADO'}))
  await modulo.carregarResultadosConsulta()
  assert.equal(elementos.resultadoFiltros.children.length,20)
  assert.equal(elementos.totalConsulta.textContent,45)
  assert.equal(obterExportacao(),'data_inicial=2026-10-14&data_final=2026-10-16')
  elementos.filtroNumero.value='917'
  assert.equal(obterExportacao(),'data_inicial=2026-10-14&data_final=2026-10-16')
  consultar=async()=>{throw new Error('Falha simulada')}
  await modulo.carregarResultadosConsulta()
  assert.equal(obterExportacao(),null)
})

test('resposta antiga não troca os resultados nem os filtros do Excel, e produto aparece como texto',async()=>{
  let resolver
  consultar=()=>new Promise(resolve=>{resolver=resolve})
  const antiga=modulo.carregarResultadosConsulta()
  elementos.filtroNumero.value='918'
  consultar=async()=>[{numero:918,produto:'<img src=x onerror=alert(1)>',status:'EM PRODUÇÃO'}]
  await modulo.carregarResultadosConsulta()
  resolver([{numero:917,produto:'ANTIGO'}]);await antiga
  assert.equal(obterExportacao(),'numero=918')
  assert.equal(elementos.resultadoFiltros.children.length,1)
  assert.equal(elementos.resultadoFiltros.children[0].children[1].textContent,'<IMG SRC=X ONERROR=ALERT(1)>')
  assert.ok(!elementos.resultadoFiltros.children[0].innerHTML.includes('<img'))
})

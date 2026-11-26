const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, consultar, obterExportacao, modulo, sequencia=0
function elemento() {
  return {value:'',textContent:'',disabled:false,dataset:{},style:{setProperty(nome,valor){this[nome]=valor}},
    attributes:{},setAttribute(n,v){this.attributes[n]=v},children:[],eventos:{},classList:{add(){},remove(){}},focus(){},scrollIntoView(){},
    set innerHTML(valor){this.html=valor;this.children=[]},get innerHTML(){return this.html},
    appendChild(filho){this.children.push(filho)},addEventListener(nome,fn){this.eventos[nome]=fn}}
}
beforeEach(async()=>{
  elementos=Object.fromEntries(['estadoConsulta','buscarFiltros','limparFiltros','carregarMaisCortes','filtroNumero','filtroProduto','filtroDataInicial','filtroDataFinal','filtroStatus','resultadoFiltros','totalConsulta','consultaCarregarMais','consultaExibidos','detalheCorte','dashboardCorte','historicoConsulta','itensConsulta'].map(id=>[id,elemento()]))
  globalThis.document={getElementById:id=>elementos[id],querySelectorAll:()=>[],createElement:()=>{
    const row=elemento()
    Object.defineProperty(row,'innerHTML',{set(valor){this.html=valor;this.children=Array.from({length:6},elemento)},get(){return this.html}})
    return row
  }}
  globalThis.window={scrollY:160,addEventListener(){},scrollTo(){}}
  globalThis.sessionStorage={getItem(){return null},setItem(){}}
  globalThis.requestAnimationFrame=fn=>fn()
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

test('restores filters, expanded results and list position from this browser session',async()=>{
 const saved={campos:{filtroProduto:'',filtroNumero:'',filtroDataInicial:'2026-10-01',filtroDataFinal:'',filtroStatus:'FINALIZADO'},exibidos:40,scroll:350}
 let memory=JSON.stringify(saved),position
 sessionStorage.getItem=()=>memory;sessionStorage.setItem=(_,v)=>memory=v
 window.scrollTo=(x,y)=>position=y
 modulo.inicializarFiltros()
 consultar=async url=>{assert.match(url,/data_inicial=2026-10-01/);return Array.from({length:45},(_,i)=>({numero:i+1,produto:'PI'}))}
 await modulo.carregarResultadosConsulta()
 assert.equal(elementos.resultadoFiltros.children.length,40)
 assert.equal(position,350)
 elementos.limparFiltros.eventos.click()
 assert.equal(elementos.filtroDataInicial.value,'')
})

test('atualizar preserva as linhas durante a espera e a falha identifica os dados anteriores',async()=>{
 consultar=async()=>[{numero:917,produto:'MANTA',status:'FINALIZADO'}]
 await modulo.carregarResultadosConsulta()
 const linha=elementos.resultadoFiltros.children[0]
 let resolver;consultar=()=>new Promise(r=>resolver=r)
 const carga=modulo.carregarResultadosConsulta()
 assert.equal(elementos.resultadoFiltros.children[0],linha)
 assert.equal(elementos.resultadoFiltros.attributes['aria-busy'],'true')
 resolver([{numero:918,produto:'CETIM'}]);await carga
 assert.equal(elementos.resultadoFiltros.attributes['aria-busy'],'false')
 assert.equal(elementos.estadoConsulta.hidden,true)
 const atual=elementos.resultadoFiltros.children[0]
 consultar=async()=>{throw Error('Rede indisponivel')}
 await modulo.carregarResultadosConsulta()
 assert.equal(elementos.resultadoFiltros.children[0],atual)
 assert.equal(elementos.totalConsulta.textContent,1)
 assert.match(elementos.estadoConsulta.textContent,/busca anterior/)
 assert.equal(obterExportacao(),null)
})

test('tempo real preserva detalhes, paginacao e a busca aplicada, sem usar filtros em edicao',async()=>{
 elementos.filtroStatus.value='FINALIZADO'
 const resultados=Array.from({length:45},(_,i)=>({numero:917+i,produto:'MANTA',status:'FINALIZADO'}))
 consultar=async()=>resultados;await modulo.carregarResultadosConsulta()
 elementos.carregarMaisCortes.eventos.click()
 await elementos.resultadoFiltros.children[0].eventos.click()
 assert.equal(modulo.obterCorteConsultaAtual(),917)
 elementos.filtroProduto.value='TEXTO AINDA NAO BUSCADO'
 consultar=async url=>{assert.ok(url.endsWith('status=FINALIZADO'));return resultados}
 await modulo.carregarResultadosConsulta({silencioso:true})
 assert.equal(elementos.resultadoFiltros.children.length,40)
 assert.equal(modulo.obterCorteConsultaAtual(),917)
 assert.equal(elementos.detalheCorte.style.display,'grid')
 assert.equal(obterExportacao(),'status=FINALIZADO')
 assert.equal(elementos.filtroProduto.value,'TEXTO AINDA NAO BUSCADO')
})

test('busca por produto inclui novos resultados tambem na atualizacao silenciosa',async()=>{
 elementos.filtroProduto.value='MANTA'
 consultar=async()=>Array.from({length:25},(_,i)=>({numero:i+1,produto:'MANTA'}))
 await modulo.carregarResultadosConsulta();assert.equal(elementos.resultadoFiltros.children.length,25)
 consultar=async()=>Array.from({length:30},(_,i)=>({numero:i+1,produto:'MANTA'}))
 await modulo.carregarResultadosConsulta({silencioso:true});assert.equal(elementos.resultadoFiltros.children.length,30)
})

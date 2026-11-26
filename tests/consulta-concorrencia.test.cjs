const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
function ambiente(){
  const elementos={},pendentes=[],chamadas=[]
  const el=id=>elementos[id]??={children:[],style:{display:'none'},textContent:'',
    set innerHTML(v){this.html=v;this.children=[]},get innerHTML(){return this.html},appendChild(e){this.children.push(e)}}
  const contexto={document:{getElementById:el,createElement:()=>el(Math.random())},console,
    apiGet:url=>{chamadas.push(url);return url.endsWith('/1')?new Promise(r=>pendentes.push(r)):Promise.resolve([])},
    maiusculo:String,formatarData:String,formatarNumero:String,formatarQuantidade:String,calcularDuracao:()=>''}
  vm.createContext(contexto)
  for(const arq of ['historico','dashboard'])vm.runInContext(fs.readFileSync(`src/public/js/pages/consultar/${arq}.js`,'utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'').replace(/export async function/g,'async function'),contexto)
  return {contexto,el,pendentes,chamadas}
}

test('dashboard inicia as duas leituras juntas e resposta antiga nao substitui o corte novo',async()=>{
 const a=ambiente(),antiga=a.contexto.carregarDashboardCorte(1)
 assert.deepEqual(a.chamadas,['/producao/1','/itens-corte/1'])
 await a.contexto.carregarDashboardCorte(2)
 a.pendentes.forEach(r=>r([{folha_inicio:0,folha_parou:99,quantidade_pecas:50}]));await antiga
 assert.equal(a.el('totalFolhas').textContent,'0');assert.equal(a.el('totalPecas').textContent,'0')
})

test('historico e PIs descartam respostas antigas e respeitam o fechamento dos detalhes',async()=>{
 const a=ambiente()
 for(const [funcao,tabela] of [['carregarHistoricoConsulta','historicoConsulta'],['carregarItensConsulta','itensConsulta']]){
   const antiga=a.contexto[funcao](1)
   await a.contexto[funcao](2)
   a.pendentes.at(-1)([{operador:'ANTIGO',modelo:'ANTIGO'}]);await antiga
   assert.equal(a.el(tabela).children.length,0);assert.match(a.el(tabela).innerHTML,/Nenhum/)
 }
 let atual=true
 const carga=a.contexto.carregarDashboardCorte(1,{aindaAtual:()=>atual});atual=false
 a.pendentes.slice(-2).forEach(r=>r([]));await carga
 assert.equal(a.el('dashboardCorte').style.display,'none')
})

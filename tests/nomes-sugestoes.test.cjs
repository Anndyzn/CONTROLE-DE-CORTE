const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,campos,listas,timers,obter,chamadas,sequencia=0
beforeEach(async()=>{
  listas={};timers=[];chamadas=[]
  const elemento=()=>({value:'',eventos:{},children:[],setAttribute(k,v){this[k]=v},replaceChildren(){this.children=[]},append(c){this.children.push(c)},addEventListener(n,f){this.eventos[n]=f},insertAdjacentElement(_,e){listas[this.id]=e}})
  campos={produtoNovo:elemento(),modeloItem:elemento()}
  for(const [id,campo]of Object.entries(campos))campo.id=id
  globalThis.document={getElementById:id=>campos[id],createElement:()=>elemento()}
  obter=async()=>({nomes:[{nome:'CONJUNTO FEMININO'},{nome:'VÉU GOTA'}]})
  globalThis.__nomesDeps={apiGet:url=>{chamadas.push(url);return obter(url)},agendar:fn=>{timers.push(fn);return timers.length},cancelar(){}}
  const codigo=fs.readFileSync('src/public/js/pages/index/nomes.js','utf8').replace(/^import .*$/gm,'')
  modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,agendar:setTimeout,cancelar:clearTimeout}=globalThis.__nomesDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarSugestoesNomes()
})
test('sugere no máximo cinco nomes sem exigir acentos e permite nome novo sem substituí-lo',async()=>{
  assert.deepEqual(modulo.filtrarSugestoes(['VÉU GOTA','VEU SIMPLES','Véu renda','VEU 4','VEU 5','VEU 6'],' veu '),['VÉU GOTA','VEU SIMPLES','Véu renda','VEU 4','VEU 5'])
  campos.produtoNovo.value='veu'
  await campos.produtoNovo.eventos.focus()
  assert.equal(listas.produtoNovo.children[0].value,'VÉU GOTA')
  assert.equal(campos.produtoNovo.value,'veu')
  campos.produtoNovo.value='PRODUTO NOVO';campos.produtoNovo.eventos.input()
  assert.equal(campos.produtoNovo.value,'PRODUTO NOVO')
  assert.equal(listas.produtoNovo.children.length,0)
  assert.match(chamadas[0],/tipo=cortes/)
})
test('resposta atrasada não troca sugestões de uma busca mais recente',async()=>{
  let resolverAntiga
  obter=()=>new Promise(resolve=>{resolverAntiga=resolve})
  campos.modeloItem.value='CONJ';const antiga=campos.modeloItem.eventos.focus()
  campos.modeloItem.value='VEU';campos.modeloItem.eventos.input()
  obter=async()=>({nomes:[{nome:'VEU SIMPLES'}]})
  await timers.at(-1)()
  resolverAntiga({nomes:[{nome:'CONJUNTO FEMININO'}]});await antiga
  assert.deepEqual(listas.modeloItem.children.map(o=>o.value),['VEU SIMPLES'])
  assert.equal(campos.modeloItem.value,'VEU')
})
test('falha de sugestões mantém cadastro livre e limpa opções antigas',async()=>{
  campos.modeloItem.value='CONJ';await campos.modeloItem.eventos.focus()
  obter=async()=>{throw new Error('Sem conexão')}
  await campos.modeloItem.eventos.focus()
  assert.equal(campos.modeloItem.value,'CONJ')
  assert.equal(listas.modeloItem.children.length,0)
})

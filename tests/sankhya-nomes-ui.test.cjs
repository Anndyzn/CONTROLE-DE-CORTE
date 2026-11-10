const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const catalogo=JSON.parse(fs.readFileSync('src/public/data/sankhya-produtos.json','utf8'))
let els,modulo,obter,gravar,confirmar,envios,sequencia=0
class Elemento {
  constructor(){this.value='';this.children=[];this.eventos={};this.dataset={};this.disabled=false}
  append(...itens){this.children.push(...itens)}
  replaceChildren(...itens){this.children=itens}
  addEventListener(n,f){this.eventos[n]=f}
}
beforeEach(async()=>{
  els={};envios=[]
  for(const id of ['painelNomesSankhya','produtoPossivelSankhya','buscarNomeSankhya','nomeOrigemSankhya','estadoNomesSankhya','listaPossibilidadesSankhya','salvarPossibilidadesSankhya','filtrarNomesSankhya','adicionarPossibilidadeSankhya','possibilidadeItemSankhya'])els[id]=new Elemento()
  globalThis.document={getElementById:id=>els[id],createElement:()=>new Elemento()}
  globalThis.window={addEventListener(){}}
  obter=async()=>({nomes:[{nome:'EDREDON LISO INFERIOR',cortes:3,versao:0,opcoes:[]}]})
  gravar=async body=>({versao:1,opcoes:body.opcoes.map(o=>({...o,rotulo:'6086 — PI CORTE EDREDON INF'}))})
  confirmar=async()=>true
  globalThis.__nomesSankhya={apiGet:u=>obter(u),apiPut:async(u,b)=>{envios.push({u,b});return gravar(b)},mostrarToast(){},confirmarAcao:(...a)=>confirmar(...a)}
  const fonte=fs.readFileSync('src/public/js/pages/sankhya/nomenclaturas.js','utf8').replace(/^import .*$/gm,'')
  modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,apiPut,mostrarToast,confirmarAcao}=globalThis.__nomesSankhya;\n'+fonte).toString('base64')}#${++sequencia}`)
  modulo.inicializarNomenclaturasSankhya(async()=>catalogo)
})
async function abrir(){els.painelNomesSankhya.open=true;await els.painelNomesSankhya.eventos.toggle();els.nomeOrigemSankhya.value='0';await els.nomeOrigemSankhya.eventos.change()}
test('cadastro por nome permite alternativas e componentes juntos, sem criar OPs ou controles',async()=>{
  await abrir()
  els.produtoPossivelSankhya.value='6086';els.adicionarPossibilidadeSankhya.eventos.click()
  els.adicionarPossibilidadeSankhya.eventos.click() // Não duplica a alternativa.
  els.produtoPossivelSankhya.value='g:conjunto-feminino';els.adicionarPossibilidadeSankhya.eventos.click()
  assert.equal(els.listaPossibilidadesSankhya.children.length,2)
  await els.salvarPossibilidadesSankhya.eventos.click()
  assert.equal(envios.length,1);assert.equal(envios[0].u,'/sankhya/nomenclaturas')
  assert.deepEqual(envios[0].b,{nome:'EDREDON LISO INFERIOR',versao:0,opcoes:[{codigos:[6086]},{codigos:[6073,6069]}]})
})
test('cancelamento protege edição e erro de gravação mantém possibilidades para tentar novamente',async()=>{
  await abrir();els.produtoPossivelSankhya.value='6086';els.adicionarPossibilidadeSankhya.eventos.click()
  confirmar=async()=>false
  await els.filtrarNomesSankhya.eventos.click()
  assert.equal(els.listaPossibilidadesSankhya.children.length,1)
  await els.salvarPossibilidadesSankhya.eventos.click();assert.equal(envios.length,0)
  confirmar=async()=>true;gravar=async()=>{throw Error('Conflito')}
  await els.salvarPossibilidadesSankhya.eventos.click()
  assert.equal(els.listaPossibilidadesSankhya.children.length,1);assert.equal(els.salvarPossibilidadesSankhya.disabled,false)
})
test('opções atrasadas de outro corte não substituem a nomenclatura atual',async()=>{
  let resolver
  obter=()=>new Promise(r=>resolver=r)
  const antiga=modulo.carregarPossibilidadesCorte('ANTIGO')
  obter=async()=>({nomes:[{opcoes:[{codigos:[6086],rotulo:'6086 — PI CORTE EDREDON INF'}]}]})
  await modulo.carregarPossibilidadesCorte('EDREDON LISO INFERIOR')
  resolver({nomes:[{opcoes:[{codigos:[6073],rotulo:'OUTRO'}]}]});await antiga
  assert.equal(els.possibilidadeItemSankhya.children.length,2)
  assert.equal(els.possibilidadeItemSankhya.children[1].dataset.codigos,'[6086]')
  assert.equal(els.possibilidadeItemSankhya.disabled,false)
})

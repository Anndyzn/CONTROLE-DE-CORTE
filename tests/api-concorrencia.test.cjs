const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
function ambiente(){
  const chamadas=[]
  const contexto={structuredClone,Event,document:{dispatchEvent(){}},fetch:(url,config)=>new Promise(resolve=>chamadas.push({url,config,resolve}))}
  vm.createContext(contexto)
  vm.runInContext(fs.readFileSync('src/public/js/core/api.js','utf8').replace(/export async function/g,'async function'),contexto)
  return {api:contexto,chamadas,responder:(i,dados,ok=true)=>chamadas[i].resolve({ok,json:async()=>dados})}
}

test('GETs simultaneos compartilham a rede, sem compartilhar objetos ou guardar cache depois',async()=>{
  const a=ambiente(),p=a.api.apiGet('/dados'),q=a.api.apiGet('/dados')
  assert.equal(a.chamadas.length,1);a.responder(0,{itens:[{nome:'Original'}]})
  const [um,dois]=await Promise.all([p,q]);um.itens[0].nome='Alterado';assert.equal(dois.itens[0].nome,'Original')
  const novo=a.api.apiGet('/dados');assert.equal(a.chamadas.length,2)
  a.responder(1,{itens:[]});await novo
})

test('erro libera nova tentativa e consultas de URLs diferentes seguem independentes',async()=>{
  const a=ambiente(),p=a.api.apiGet('/um'),q=a.api.apiGet('/um'),outro=a.api.apiGet('/outro')
  assert.equal(a.chamadas.length,2)
  const falhas=Promise.allSettled([p,q]);a.responder(0,{erro:'Falhou'},false);a.responder(1,{ok:true})
  assert.ok((await falhas).every(r=>r.status==='rejected'&&r.reason.message==='Falhou'));await outro
  const nova=a.api.apiGet('/um');assert.equal(a.chamadas.length,3);a.responder(2,{});await nova
})

test('gravacao invalida a leitura pendente e a resposta antiga nao remove a consulta nova',async()=>{
  const a=ambiente(),antiga=a.api.apiGet('/dados'),salvar=a.api.apiPost('/salvar',{valor:1})
  a.responder(1,{ok:true});await salvar
  const nova=a.api.apiGet('/dados');assert.equal(a.chamadas.length,3)
  a.responder(0,{versao:1});await antiga
  const compartilhada=a.api.apiGet('/dados');assert.equal(a.chamadas.length,3)
  a.responder(2,{versao:2});assert.equal((await nova).versao,2);assert.equal((await compartilhada).versao,2)
})

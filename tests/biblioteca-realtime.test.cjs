const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
function ambiente(){
  const scripts=[],contexto={window:{},document:{head:{append:e=>scripts.push(e)},createElement:()=>({remove(){this.removido=true}})}}
  vm.createContext(contexto)
  vm.runInContext(fs.readFileSync('src/public/js/core/biblioteca-realtime.js','utf8').replace('export function','function'),contexto)
  return {scripts,contexto,carregar:()=>contexto.carregarBibliotecaRealtime()}
}
test('tempo real carrega separadamente e chamadas simultaneas usam um unico script',async()=>{
  const a=ambiente(),p=a.carregar(),q=a.carregar()
  assert.equal(a.scripts.length,1);assert.equal(a.scripts[0].async,true)
  a.contexto.window.supabase={createClient(){}};a.scripts[0].onload()
  assert.equal(await p,await q);await a.carregar();assert.equal(a.scripts.length,1)
})
test('falha da biblioteca libera tentativa nova sem bloquear as leituras da tela',async()=>{
  const a=ambiente(),p=a.carregar();const falha=assert.rejects(p,/carregar/)
  a.scripts[0].onerror();await falha;assert.equal(a.scripts[0].removido,true)
  const nova=a.carregar();assert.equal(a.scripts.length,2)
  a.contexto.window.supabase={};a.scripts[1].onload();await nova
})

const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
function ambiente({semEventSource=false}={}) {
  const timers=new Map(),intervalos=new Map(),eventos={},visibilidade={},canais=[],estados=[]
  let seq=0,travado=false,chamadas=0,result=true
  class Canal {
    constructor(url){this.url=url;this.eventos={};canais.push(this)}
    addEventListener(nome,fn){this.eventos[nome]=fn}
    close(){this.fechado=true}
  }
  const contexto={document:{hidden:false,addEventListener:(nome,fn)=>visibilidade[nome]=fn},window:{addEventListener:(nome,fn)=>eventos[nome]=fn},
    setTimeout:fn=>{timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervalos.set(++seq,fn);return seq},clearInterval:id=>intervalos.delete(id),
    ...(semEventSource?{}:{EventSource:Canal})}
  vm.createContext(contexto)
  vm.runInContext(fs.readFileSync('src/public/js/pages/tecidos/realtime.js','utf8').replace('export function','function')+'\nthis.iniciar=iniciarAtualizacaoTecidos',contexto)
  const controle=contexto.iniciar({atualizar:async()=>{chamadas++;return typeof result==='function'?result():result},ocupado:()=>travado,indicar:(...a)=>estados.push(a)})
  return {canais,estados,eventos,visibilidade,intervalos,controle,contexto,get chamadas(){return chamadas},travar:v=>travado=v,resultado:v=>result=v,
    async executar(){const lista=[...timers];timers.clear();for(const [,fn]of lista)await fn()},get agendados(){return timers.size}}
}
test('eventos de outra aba atualizam sem duplicar cargas e reconexão refaz leitura',async()=>{
  const a=ambiente();assert.equal(a.canais[0].url,'/tecidos-defeitos/atualizacoes')
  a.canais[0].eventos.conectado();a.canais[0].eventos.alteracao();a.canais[0].eventos.alteracao()
  assert.equal(a.agendados,1);await a.executar();assert.equal(a.chamadas,1);assert.deepEqual(a.estados.at(-1),['Ao vivo','ok'])
  a.canais[0].eventos.error();assert.deepEqual(a.estados.at(-1),['Reconectando','aviso'])
  await a.executar();a.canais[0].eventos.conectado();await a.executar();assert.equal(a.chamadas,3)
})
test('não atualiza durante atendimento/envio; evento pendente é processado ao liberar',async()=>{
  const a=ambiente();a.travar(true);a.canais[0].eventos.alteracao();await a.executar();assert.equal(a.chamadas,0)
  a.travar(false);a.controle.retomar();await a.executar();assert.equal(a.chamadas,1)
})
test('voltar à aba atualiza e o fallback funciona sem EventSource',async()=>{
  const a=ambiente({semEventSource:true});assert.equal(a.canais.length,0)
  a.contexto.document.hidden=true;for(const fn of a.intervalos.values())fn();await a.executar();assert.equal(a.chamadas,0)
  a.contexto.document.hidden=false;a.visibilidade.visibilitychange();await a.executar();assert.equal(a.chamadas,1)
  assert.deepEqual(a.estados.at(-1),['Atualização automática','ok'])
  a.resultado(false);for(const fn of a.intervalos.values())fn();await a.executar();assert.deepEqual(a.estados.at(-1),['Falha ao atualizar','erro'])
})
test('navegar fecha o canal e cancela timers; voltar pelo cache reconecta',async()=>{
  const a=ambiente();a.canais[0].eventos.alteracao();a.eventos.pagehide()
  assert.ok(a.canais[0].fechado);assert.equal(a.agendados,0);assert.equal(a.intervalos.size,0)
  a.eventos.pageshow({persisted:true});assert.equal(a.canais.length,2);await a.executar();assert.equal(a.chamadas,1)
})

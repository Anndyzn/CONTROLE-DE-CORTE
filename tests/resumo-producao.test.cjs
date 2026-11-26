const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const fonte=fs.readFileSync('src/public/js/pages/index/resumo-producao.js','utf8').replace(/export function/g,'function')
function ambiente(){
  const elementos={},observadores=[]
  const el=id=>elementos[id]??=( {value:'',textContent:'',dataset:{},hidden:false,listeners:{},classes:new Set(),
    classList:{contains:c=>elementos[id].classes.has(c)},addEventListener(n,f){this.listeners[n]=f}} )
  for(const id of ['resumoAntesSalvar','secaoProducao','resumoProducaoLinha','resumoProducaoDetalhe','resumoProducaoSituacao','numeroCorteSelecionado','mesa','trabalhoSelecionadoResumo','data','turno','operador','operadorOutro','horaInicio','horaFim','folhaInicio','folhaParouInput','statusProducao','preencherHoraFim'])el(id)
  const contexto={document:{getElementById:id=>elementos[id]},queueMicrotask:f=>f(),MutationObserver:class{constructor(f){observadores.push(f)}observe(){}}}
  vm.createContext(contexto);vm.runInContext(fonte,contexto)
  return {el,contexto,observar:()=>observadores.forEach(f=>f())}
}

test('resumo diferencia campos pendentes, folha zero e termino no dia seguinte',()=>{
  const a=ambiente(),montar=a.contexto.montarResumoProducao
  const dados={numero:'970',operador:'CICERA',mesa:'MESA 1',data:'2026-11-26',turno:'2º TURNO',horaInicio:'22:00',horaFim:'02:30',folhaInicio:'0',folhaFim:'12',status:'EM PRODUÇÃO'}
  const resumo=montar(dados)
  assert.match(resumo.linha,/CICERA.*MESA 1.*22:00.*02:30.*dia seguinte/)
  assert.match(resumo.detalhe,/26\/11\/2026.*Folhas 0 → 12/)
  assert.match(resumo.situacao,/continua em produção/)
  assert.match(montar({...dados,horaFim:'',folhaFim:'',status:''}).linha,/término pendente/)
  assert.match(montar({...dados,status:'FINALIZADO'}).situacao,/Vai finalizar/)
})

test('resumo acompanha digitacao, Agora e dados restaurados sem alterar os campos',()=>{
  const a=ambiente(),e=a.el
  a.contexto.inicializarResumoProducao();assert.equal(e('resumoAntesSalvar').hidden,true)
  e('secaoProducao').classes.add('producao-vinculada')
  e('operador').value='OUTRO';e('operadorOutro').value='<b>ANA</b>'
  e('numeroCorteSelecionado').textContent='970';e('mesa').textContent='MESA 2'
  e('horaInicio').value='06:00';e('folhaInicio').value='0';a.observar()
  assert.equal(e('resumoAntesSalvar').hidden,false);assert.match(e('resumoProducaoLinha').textContent,/<b>ANA<\/b>/)
  e('horaFim').value='14:00';e('preencherHoraFim').listeners.click()
  assert.match(e('resumoProducaoLinha').textContent,/14:00/)
  e('folhaParouInput').value='48';e('statusProducao').value='FINALIZADO';e('secaoProducao').listeners.change()
  assert.match(e('resumoProducaoDetalhe').textContent,/0 → 48/);assert.equal(e('resumoAntesSalvar').dataset.finaliza,'true')
  e('horaFim').value='15:30';e('folhaParouInput').value='50';a.observar()
  assert.match(e('resumoProducaoLinha').textContent,/15:30/);assert.equal(e('folhaParouInput').value,'50')
  e('secaoProducao').classes.add('aguardando-inicio');a.observar();assert.equal(e('resumoAntesSalvar').hidden,true)
  a.contexto.inicializarResumoProducao();assert.equal(e('horaFim').value,'15:30')
})

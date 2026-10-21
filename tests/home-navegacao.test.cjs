const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let modulo, elementos, consultar, verificarMesa, carregarItens, gravacoes, configuracao, atualizacoes, falhas, sequencia=0
function elemento(tag='div') {
  return {tag,value:'',textContent:'',disabled:false,hidden:true,dataset:{},style:{},eventos:{},children:[],
    classList:{add(){},remove(){}},focus(){this.focado=true},scrollIntoView(){this.rolou=true},
    addEventListener(nome,fn){this.eventos[nome]=fn},appendChild(filho){this.children.push(filho)},
    querySelector(){return this.botao ??= elemento('button')},
    set innerHTML(valor){this.html=valor;this.children=tag==='tr'?Array.from({length:6},()=>elemento('td')):[]},
    get innerHTML(){return this.html}}
}
const resumo=(numero=922,status='EM PRODUÇÃO')=>({corte:{numero,produto:'VEU GOTA',mesa:'MESA 1'},ultima_producao:{id:40,status,folha_parou:50}})
beforeEach(async t=>{
  elementos=Object.fromEntries([
    'corteSelecionado','secaoProducao','secaoHistorico','blocoItensCorte','limparCorteSelecionado',
    'numeroCorte','produto','mesa','folhaParou','numeroCorteSelecionado','novoCorte','historicoVazio','conteudoHistorico',
    'alternarHistorico','statusProducao','folhaInicio','produtoNovo','mesaNova','cortesEmAndamento','totalCortesEmAndamento',
    'buscarCorte','cadastrarCorte','gerarProximoCorte','atualizarCortesEmAndamento','cancelarNovoCorte',
    'turno','operador','operadorOutro','horaInicio','horaFim','folhaParouInput'
  ].map(id=>[id,elemento()]))
  elementos.numeroCorteSelecionado.textContent='--'
  globalThis.document={getElementById:id=>elementos[id],querySelectorAll:()=>[],createElement:elemento}
  const codigoUi=fs.readFileSync('src/public/js/pages/index/ui-corte.js','utf8')
  const ui=await import(`data:text/javascript;base64,${Buffer.from(codigoUi).toString('base64')}`)
  t.mock.method(globalThis,'setTimeout',fn=>{fn();return 1})
  consultar=async url=>url.endsWith('/proximo-numero')?{proximo_numero:923}:url.endsWith('/finalizacao-itens')?{itens_finalizados:0}:url==='/cortes-em-andamento'?[]:resumo()
  verificarMesa=async()=>{}
  carregarItens=async()=>0
  gravacoes=[];atualizacoes=[];falhas=0
  globalThis.__homeDeps={
    apiGet:(...args)=>consultar(...args),apiPost:(...args)=>gravacoes.push(args),
    carregarResumoFinalizados:()=>{},selecionarContextoRascunho:()=>{},limparRascunhoGrupo:()=>{},versaoRascunho:()=>null,
    atualizarControleMesas:()=>{},atualizarOcupacaoMesas:cortes=>atualizacoes.push(cortes),definirCadastroEmAndamento:()=>{},
    informarMesaOcupada:()=>{},informarFalhaOcupacaoMesas:()=>falhas++,inicializarControleMesas:acoes=>{configuracao=acoes},
    verificarDisponibilidadeMesa:(...args)=>verificarMesa(...args),mostrarToast:()=>{},
    definirCarregamento:(botao,ativo)=>{if(botao)botao.disabled=ativo},maiusculo:v=>String(v).toUpperCase(),
    renderizarStatus:()=>{},limparTabelaHistorico:()=>{},limparTabelaItens:()=>{},limparCamposItens:()=>{},habilitarProducao:()=>{},
    desabilitarProducao:()=>{},habilitarItens:()=>{},desabilitarItens:()=>{},mostrarAreaCorte:ui.mostrarAreaCorte,
    carregarHistorico:async()=>{},carregarItensCorte:(...args)=>carregarItens(...args)
  }
  const codigo=fs.readFileSync('src/public/js/pages/index/cortes.js','utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'')
  const nomes=Object.keys(globalThis.__homeDeps).join(',')
  modulo=await import(`data:text/javascript;base64,${Buffer.from(`const {${nomes}}=globalThis.__homeDeps;\n`+codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarCortes()
})

test('Home inicia com formulários ocultos; abrir um cartão seleciona o corte e limpar recolhe a área',async()=>{
  for(const id of ['corteSelecionado','secaoProducao','secaoHistorico']) assert.equal(elementos[id].hidden,true)
  await configuracao.abrirCorte(922)
  for(const id of ['corteSelecionado','secaoProducao','secaoHistorico']) assert.equal(elementos[id].hidden,false)
  assert.equal(elementos.numeroCorte.value,922)
  assert.equal(elementos.numeroCorteSelecionado.textContent,922)
  assert.equal(elementos.folhaInicio.value,50)
  assert.equal(elementos.corteSelecionado.rolou,true)
  modulo.limparCorteSelecionado()
  for(const id of ['corteSelecionado','secaoProducao','secaoHistorico']) assert.equal(elementos[id].hidden,true)
  assert.equal(elementos.blocoItensCorte.style.display,'none')
})

test('novo corte da mesa livre só prepara o cadastro com a mesa escolhida, sem gravar',async()=>{
  const mesas=[]
  verificarMesa=async mesa=>mesas.push(mesa)
  await configuracao.novoCorte('MESA 2')
  assert.deepEqual(mesas,['MESA 2'])
  assert.equal(elementos.numeroCorte.value,923)
  assert.equal(elementos.mesaNova.value,'MESA 2')
  assert.equal(elementos.novoCorte.style.display,'block')
  assert.equal(elementos.secaoProducao.hidden,true)
  assert.equal(elementos.produtoNovo.focado,true)
  assert.equal(gravacoes.length,0)
  elementos.cancelarNovoCorte.eventos.click()
  assert.equal(elementos.novoCorte.style.display,'none')
  assert.equal(elementos.numeroCorte.value,'')
})

test('mesa que ficou ocupada bloqueia a preparação sem limpar os campos preenchidos',async()=>{
  elementos.produtoNovo.value='DIGITADO'
  verificarMesa=async()=>{throw new Error('Mesa ocupada')}
  await assert.rejects(modulo.iniciarNovoCorte('MESA 1'),/Mesa ocupada/)
  assert.equal(elementos.produtoNovo.value,'DIGITADO')
  assert.equal(gravacoes.length,0)
})

test('resposta da busca antiga ou de cadastro cancelado não reabre o formulário',async()=>{
  let resolver
  consultar=()=>new Promise(resolve=>{resolver=resolve})
  const busca=modulo.buscarCorte(922)
  modulo.limparCorteSelecionado()
  resolver(resumo())
  await busca
  assert.equal(elementos.secaoProducao.hidden,true)
  assert.equal(elementos.numeroCorte.value,'')
  const novo=modulo.iniciarNovoCorte()
  modulo.limparCorteSelecionado()
  resolver({proximo_numero:923})
  await novo
  assert.equal(elementos.novoCorte.style.display,'none')
})

test('atualização em segundo plano preserva a posição da página e exibe PIs de corte finalizado',async()=>{
  elementos.numeroCorte.value='999'
  consultar=async url=>url.endsWith('/finalizacao-itens')?{itens_finalizados:1}:resumo(922,'FINALIZADO')
  carregarItens=async()=>1
  await modulo.buscarCorte(922,{rolar:false})
  assert.equal(elementos.corteSelecionado.hidden,false)
  assert.equal(elementos.blocoItensCorte.style.display,'block')
  assert.equal(elementos.corteSelecionado.rolou,undefined)
  assert.equal(elementos.blocoItensCorte.rolou,undefined)
  assert.equal(elementos.numeroCorte.value,'999')
})

test('corte excluído durante o acompanhamento recolhe o formulário sem preparar um cadastro',async()=>{
  await modulo.buscarCorte(922)
  consultar=async()=>{throw new Error('Corte não encontrado')}
  await modulo.buscarCorte(922,{rolar:false})
  assert.equal(elementos.corteSelecionado.hidden,true)
  assert.equal(elementos.secaoProducao.hidden,true)
  assert.equal(elementos.novoCorte.style.display,'none')
})

test('consulta de ocupação antiga não substitui os dados de uma atualização mais recente',async()=>{
  let resolver
  consultar=()=>new Promise(resolve=>{resolver=resolve})
  const antiga=modulo.carregarCortesEmAndamento()
  const recente=[{numero:923,produto:'NOVO',mesa:'MESA 1',status:'EM PRODUÇÃO'}]
  consultar=async()=>recente
  await modulo.carregarCortesEmAndamento()
  resolver([])
  await antiga
  assert.deepEqual(atualizacoes,[recente])
  assert.equal(elementos.totalCortesEmAndamento.textContent,'1 corte')
  consultar=async()=>{throw new Error('Falha simulada')}
  await modulo.carregarCortesEmAndamento()
  assert.equal(atualizacoes.length,1)
  assert.equal(falhas,1)
})

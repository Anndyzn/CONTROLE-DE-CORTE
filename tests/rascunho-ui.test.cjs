const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let modulo, store, elementos, mensagens, consulta, confirmar, sequencia = 0

function elemento(tag = 'input') {
  return {tag, value:'', textContent:'', hidden:false, disabled:false, style:{}, children:[], eventos:{},
    addEventListener(nome, handler) { (this.eventos[nome] ??= []).push(handler) },
    replaceChildren() { this.children = []; if (tag === 'select') this.value = '' },
    append(filho) { this.children.push(filho); if (tag === 'select' && !this.value) this.value = filho.value }
  }
}

beforeEach(async () => {
  const codigoStore = fs.readFileSync('src/public/js/utils/rascunhos.js', 'utf8')
  const {Rascunhos} = await import(`data:text/javascript;base64,${Buffer.from(codigoStore).toString('base64')}`)
  const dados = new Map()
  globalThis.localStorage = {getItem:c => dados.get(c) ?? null, setItem:(c,v) => dados.set(c,v)}
  store = new Rascunhos(localStorage)
  elementos = Object.fromEntries([
    'avisoRascunho','estadoRascunho','acoesRascunho','restaurarRascunho','descartarRascunho','numeroCorte',
    'produtoNovo','mesaNova','data','turno','operador','operadorOutro','horaInicio','horaFim','folhaInicio','folhaParouInput','statusProducao',
    'itemEditandoId','modeloItem','corItem','corOutra','tecidoItem','tecidoOutro','metragemItem','sobraItem','perdaItem','metrosFaltantesItem','quantidadeItem',
    'salvarItemCorte','blocoItensCorte'
  ].map(id => [id, elemento()]))
  elementos.rascunhoSelecionado = elemento('select')
  elementos.folhaInicio.value = '77'
  globalThis.document = {getElementById:id => elementos[id], createElement:elemento}
  globalThis.window = {addEventListener(){}}
  mensagens = []
  consulta = async () => ({itens_finalizados:0})
  confirmar = async () => false
  globalThis.__depsRascunho = {Rascunhos, mostrarToast:(...args) => mensagens.push(args), apiGet:(...args) => consulta(...args), atualizarControleMesas:() => {}, confirmarAcao:(...args) => confirmar(...args)}
  const codigo = fs.readFileSync('src/public/js/pages/index/rascunho.js','utf8')
    .replace(/^import .*$/gm, '')
  modulo = await import(`data:text/javascript;base64,${Buffer.from('const {Rascunhos,mostrarToast,apiGet,atualizarControleMesas,confirmarAcao} = globalThis.__depsRascunho;\n' + codigo).toString('base64')}#${++sequencia}`)
})

test('digitar salva automaticamente, e restaurar recupera o corte certo sem enviar dados', async () => {
  modulo.inicializarRascunhos(async numero => {
    assert.equal(numero, '843')
    return {ultima_producao:{id:10,status:'EM PRODUÇÃO',folha_parou:77}}
  })
  modulo.selecionarContextoRascunho({numero:'843',novo:false,ultimaProducaoId:10})
  elementos.turno.value = '2º TURNO'
  elementos.folhaParouInput.value = '85'
  elementos.turno.eventos.change[0]()
  assert.equal(store.ler()['843'].grupos.producao.campos.folhaParouInput, '85')
  elementos.turno.value = ''; elementos.folhaParouInput.value = ''
  await modulo.restaurarRascunho()
  assert.equal(elementos.numeroCorte.value, '843')
  assert.equal(elementos.turno.value, '2º TURNO')
  assert.equal(elementos.folhaParouInput.value, '85')
  assert.equal(elementos.folhaInicio.value, '77')
  assert.ok(store.ler()['843'])
})

test('um lançamento mais recente impede restaurar produção baseada em folhas antigas', async () => {
  store.salvar('843', false, 'producao', {folhaParouInput:'20'}, '10')
  modulo.inicializarRascunhos(async () => ({ultima_producao:{id:11,status:'EM PRODUÇÃO'}}))
  await modulo.restaurarRascunho()
  assert.equal(elementos.folhaParouInput.value, '')
  assert.match(mensagens.at(-1)[0], /mais recente/)
  assert.ok(store.ler()['843'])
})

test('a produção finalizada não recebe rascunho, enquanto os PIs abertos podem ser recuperados', async () => {
  store.salvar('843', false, 'producao', {folhaParouInput:'20'}, '10')
  store.salvar('843', false, 'item', {modeloItem:'PI A', corItem:'OUTRA', corOutra:'AZUL'}, null)
  modulo.inicializarRascunhos(async () => ({ultima_producao:{id:10,status:'FINALIZADO'}}))
  await modulo.restaurarRascunho()
  assert.equal(elementos.folhaParouInput.value, '')
  assert.equal(elementos.modeloItem.value, 'PI A')
  assert.equal(elementos.corOutra.style.display, 'block')
  assert.match(mensagens.at(-1)[0], /produção já foi finalizada/)
})

test('PIs registrados e itens alterados depois do rascunho não são preenchidos novamente', async () => {
  store.salvar('843', false, 'item', {itemEditandoId:'20', modeloItem:'ANTIGO'}, {id:20,modelo:'BASE'})
  modulo.inicializarRascunhos(async () => ({ultima_producao:{id:10,status:'FINALIZADO'}}))
  consulta = async () => ({itens_finalizados:1})
  await modulo.restaurarRascunho()
  assert.equal(elementos.modeloItem.value, '')
  consulta = async rota => rota.startsWith('/itens-corte') ? [{id:20,modelo:'ALTERADO'}] : {itens_finalizados:0}
  await modulo.restaurarRascunho()
  assert.equal(elementos.modeloItem.value, '')
  assert.ok(store.ler()['843'])
})

test('rascunho de cadastro não preenche um número que já foi utilizado por outro corte', async () => {
  store.salvar('843', true, 'novo', {produtoNovo:'ANTIGO',mesaNova:'MESA 1'}, null)
  modulo.inicializarRascunhos(async () => ({corte:{numero:843}}))
  await modulo.restaurarRascunho()
  assert.equal(elementos.produtoNovo.value, '')
  assert.match(mensagens.at(-1)[0], /já foi cadastrado/)
  assert.ok(store.ler()['843'])
})

test('falha de conexão conserva o rascunho e libera o botão para tentar novamente', async () => {
  store.salvar('843', false, 'producao', {turno:'1º TURNO'}, '10')
  modulo.inicializarRascunhos(async () => {throw new Error('Sem conexão')})
  await modulo.restaurarRascunho()
  assert.equal(elementos.restaurarRascunho.disabled, false)
  assert.equal(elementos.turno.value, '')
  assert.ok(store.ler()['843'])
})

test('falha de armazenamento avisa sem apagar o formulário nem interromper a digitação', () => {
  modulo.inicializarRascunhos(async () => null)
  modulo.selecionarContextoRascunho({numero:'843',novo:true})
  localStorage.setItem = () => {throw new Error('Sem espaço')}
  elementos.produtoNovo.value = 'PRODUTO DIGITADO'
  assert.doesNotThrow(() => elementos.produtoNovo.eventos.input[0]())
  assert.equal(elementos.produtoNovo.value, 'PRODUTO DIGITADO')
  assert.match(elementos.estadoRascunho.textContent, /Não foi possível salvar/)
})

test('o próximo turno usa como base o lançamento que acabou de ser salvo', () => {
  modulo.inicializarRascunhos(async () => null)
  modulo.selecionarContextoRascunho({numero:'843',novo:false,ultimaProducaoId:10})
  modulo.atualizarBaseProducaoRascunho('843', 11)
  elementos.turno.value = '2º TURNO'
  modulo.salvarRascunhoGrupo('producao')
  assert.deepEqual(store.ler()['843'].grupos.producao.base, {id:'11',folha:77})
})

test('salvar outro item sem alterações não apaga o rascunho anterior ainda não enviado', () => {
  modulo.inicializarRascunhos(async () => null)
  modulo.selecionarContextoRascunho({numero:'843',novo:false})
  elementos.itemEditandoId.value = '20'
  elementos.modeloItem.value = 'ALTERAÇÃO NÃO ENVIADA'
  modulo.salvarRascunhoGrupo('item')
  elementos.itemEditandoId.value = '21'
  elementos.modeloItem.value = 'OUTRO ITEM'
  const versao = modulo.versaoRascunho('item', '843')
  assert.equal(versao, null)
  modulo.limparRascunhoGrupo('item', '843', versao)
  assert.equal(store.ler()['843'].grupos.item.campos.modeloItem, 'ALTERAÇÃO NÃO ENVIADA')
})

test('uma correção da última folha no Admin impede restaurar valores antigos mesmo com o mesmo lançamento', async () => {
  store.salvar('843', false, 'producao', {folhaParouInput:'85'}, {id:'10',folha:77})
  modulo.inicializarRascunhos(async () => ({ultima_producao:{id:10,status:'EM PRODUÇÃO',folha_parou:90}}))
  await modulo.restaurarRascunho()
  assert.equal(elementos.folhaParouInput.value, '')
  assert.match(mensagens.at(-1)[0], /última folha foi corrigida/)
  assert.ok(store.ler()['843'])
})

test('cancelar o descarte mantém o rascunho; confirmar descarta somente o que estava selecionado', async () => {
  store.salvar('843', true, 'novo', {produtoNovo:'MANTA'}, null)
  store.salvar('844', true, 'novo', {produtoNovo:'CORTINA'}, null)
  modulo.inicializarRascunhos(async () => null)
  elementos.rascunhoSelecionado.value = '843'
  await elementos.descartarRascunho.eventos.click[0]()
  assert.ok(store.ler()['843'])
  let resolver
  confirmar = () => new Promise(resolve => {resolver = resolve})
  const descarte = elementos.descartarRascunho.eventos.click[0]()
  elementos.rascunhoSelecionado.value = '844'
  resolver(true)
  await descarte
  assert.equal(store.ler()['843'], undefined)
  assert.ok(store.ler()['844'])
})

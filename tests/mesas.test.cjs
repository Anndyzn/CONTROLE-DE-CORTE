const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

let elementos, modulo, consulta, sequencia = 0
function elemento(tag) {
  return {
    tag, children:[], className:'', hidden:false, disabled:false, texto:'', events:{}, attributes:{},
    get textContent() { return this.texto + this.children.map(c => c.textContent).join(' ') },
    set textContent(texto) { this.texto = String(texto); this.children = [] },
    append(...filhos) { this.children.push(...filhos) },
    replaceChildren(...filhos) { this.texto = ''; this.children = filhos },
    addEventListener(nome, handler) { this.events[nome] = handler },
    setAttribute(nome, valor) { this.attributes[nome] = valor }
  }
}

beforeEach(async () => {
  const select = {
    value:'MESA 1', attributes:{}, events:{},
    options:['','MESA 1','MESA 2','MESA 3'].map(value => ({value, textContent:value})),
    setAttribute(nome, valor) { this.attributes[nome] = valor },
    addEventListener(nome, handler) { this.events[nome] = handler }
  }
  elementos = {
    mesaNova:select, avisoMesaOcupada:{hidden:true, textContent:''},
    cadastrarCorte:{disabled:false}, produtoNovo:{value:'PRODUTO DIGITADO'},
    painelMesas:elemento('div'), estadoPainelMesas:elemento('p'), ultimaAtualizacaoMesas:elemento('time')
  }
  globalThis.document = {getElementById:id => elementos[id], createElement:elemento}
  consulta = async () => []
  globalThis.__apiMesasTeste = (...args) => consulta(...args)
  const codigo = fs.readFileSync('src/public/js/pages/index/mesas.js', 'utf8')
    .replace('import { apiGet } from "../../core/api.js"', 'const apiGet = globalThis.__apiMesasTeste')
  modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarControleMesas()
})

test('mesa ocupada exibe aviso com o número do corte e desabilita o cadastro', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, mesa:'MESA 1', status:'EM PRODUÇÃO'}])
  assert.equal(elementos.cadastrarCorte.disabled, true)
  assert.equal(elementos.avisoMesaOcupada.hidden, false)
  assert.match(elementos.avisoMesaOcupada.textContent, /corte 843/)
  assert.match(elementos.mesaNova.options[1].textContent, /ocupada/)
  assert.equal(elementos.mesaNova.attributes['aria-invalid'], 'true')
  assert.equal(elementos.produtoNovo.value, 'PRODUTO DIGITADO')
})

test('mudar para uma mesa livre libera o cadastro e limpa o aviso', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, mesa:'MESA 1'}])
  elementos.mesaNova.value = 'MESA 2'
  elementos.mesaNova.events.change()
  assert.equal(elementos.cadastrarCorte.disabled, false)
  assert.equal(elementos.avisoMesaOcupada.hidden, true)
  assert.equal(elementos.mesaNova.attributes['aria-invalid'], 'false')
  assert.match(elementos.mesaNova.options[2].textContent, /livre/)
})

test('uma atualização após a finalização libera a mesa selecionada', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, mesa:'MESA 1'}])
  modulo.atualizarOcupacaoMesas([])
  assert.equal(elementos.cadastrarCorte.disabled, false)
  assert.equal(elementos.avisoMesaOcupada.hidden, true)
})

test('atualizações não reativam o botão durante o envio do cadastro', () => {
  modulo.definirCadastroEmAndamento(true)
  modulo.atualizarOcupacaoMesas([])
  assert.equal(elementos.cadastrarCorte.disabled, true)
  modulo.definirCadastroEmAndamento(false)
  assert.equal(elementos.cadastrarCorte.disabled, false)
  modulo.atualizarOcupacaoMesas([{numero:843, mesa:'MESA 1'}])
  modulo.definirCadastroEmAndamento(false)
  assert.equal(elementos.cadastrarCorte.disabled, true)
})

test('antes do envio, confere a mesa novamente e recusa uma ocupação recente', async () => {
  modulo.atualizarOcupacaoMesas([])
  consulta = async url => {
    assert.equal(url, '/cortes-em-andamento')
    return [{numero:844, mesa:'MESA 1', status:'EM PRODUÇÃO'}]
  }
  await assert.rejects(modulo.verificarDisponibilidadeMesa('MESA 1'), erro => {
    assert.equal(erro.codigo, 'MESA_OCUPADA')
    assert.match(erro.message, /corte 844/)
    return true
  })
  assert.equal(elementos.cadastrarCorte.disabled, true)
})

test('falha ao consultar disponibilidade impede continuar e preserva os campos', async () => {
  consulta = async () => { throw new Error('Sem conexão') }
  await assert.rejects(modulo.verificarDisponibilidadeMesa('MESA 1'), /Sem conexão/)
  assert.equal(elementos.mesaNova.value, 'MESA 1')
  assert.equal(elementos.produtoNovo.value, 'PRODUTO DIGITADO')
})

test('conflito retornado pelo servidor informa todos os cortes ocupantes', () => {
  modulo.atualizarOcupacaoMesas([])
  modulo.informarMesaOcupada('MESA 1', [{numero:843}, {numero:842}])
  assert.match(elementos.avisoMesaOcupada.textContent, /cortes 843, 842/)
  assert.equal(elementos.cadastrarCorte.disabled, true)
})

test('o painel inicia com as três mesas em consulta, sem afirmar que estão livres', () => {
  assert.equal(elementos.painelMesas.children.length, 3)
  for (const card of elementos.painelMesas.children) {
    assert.match(card.textContent, /Consultando/)
    assert.doesNotMatch(card.textContent, /Livre|Disponível para/)
  }
  assert.equal(elementos.estadoPainelMesas.hidden, false)
})

test('o painel apresenta a mesa ocupada, corte e produto, e as outras duas livres', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, produto:'VESTIDO RENDA', mesa:' mesa  1 ', status:'EM PRODUÇÃO'}])
  const cards = elementos.painelMesas.children
  assert.match(cards[0].className, /mesa-ocupada/)
  assert.match(cards[0].textContent, /MESA 1.*Ocupada.*Corte 843.*VESTIDO RENDA/)
  for (const card of cards.slice(1)) {
    assert.match(card.className, /mesa-livre/)
    assert.match(card.textContent, /Livre.*Disponível para um novo corte/)
  }
  assert.equal(elementos.estadoPainelMesas.hidden, true)
})

test('o painel libera a mesa após a atualização e não inclui cortes finalizados', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, produto:'TESTE', mesa:'MESA 1'}])
  modulo.atualizarOcupacaoMesas([{numero:843, produto:'TESTE', mesa:'MESA 1', status:'FINALIZADO'}])
  assert.match(elementos.painelMesas.children[0].textContent, /Livre/)
  assert.doesNotMatch(elementos.painelMesas.children[0].textContent, /Corte 843/)
})

test('o painel mostra todos os cortes duplicados existentes e pede conferir as finalizações', () => {
  modulo.atualizarOcupacaoMesas([
    {numero:843, produto:'PRODUTO A', mesa:'MESA 1'},
    {numero:842, produto:'PRODUTO B', mesa:'MESA 1'}
  ])
  const card = elementos.painelMesas.children[0]
  assert.match(card.textContent, /Corte 843.*PRODUTO A.*Corte 842.*PRODUTO B/)
  assert.match(card.textContent, /2 cortes em aberto/)
})

test('o nome do produto é inserido como texto, sem criar elementos HTML', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, produto:'<img src=x onerror=alert(1)>', mesa:'MESA 1'}])
  const lista = elementos.painelMesas.children[0].children[1]
  const produto = lista.children[0].children[1]
  assert.equal(produto.tag, 'span')
  assert.equal(produto.textContent, '<img src=x onerror=alert(1)>')
  assert.equal(produto.children.length, 0)
})

test('uma falha inicial deixa a ocupação indisponível; uma nova consulta recupera o painel', () => {
  modulo.informarFalhaOcupacaoMesas()
  for (const card of elementos.painelMesas.children) {
    assert.match(card.textContent, /Indisponível/)
    assert.doesNotMatch(card.textContent, /Livre/)
  }
  assert.match(elementos.estadoPainelMesas.textContent, /Não foi possível consultar/)
  modulo.atualizarOcupacaoMesas([])
  assert.equal(elementos.estadoPainelMesas.hidden, true)
  assert.match(elementos.painelMesas.children[0].textContent, /Livre/)
})

test('falha de atualização preserva os últimos dados e identifica que podem estar desatualizados', () => {
  modulo.atualizarOcupacaoMesas([{numero:843, produto:'TESTE', mesa:'MESA 1'}])
  modulo.informarFalhaOcupacaoMesas()
  assert.match(elementos.painelMesas.children[0].textContent, /Ocupada.*Corte 843/)
  assert.equal(elementos.estadoPainelMesas.hidden, false)
  assert.match(elementos.estadoPainelMesas.textContent, /últimos dados recebidos/)
})

const ultima = {
  id:40, data:'2026-10-21', turno:'1º TURNO', operador:'MATHEUS',
  folha_inicio:0, folha_parou:50, dias_sem_lancamento:0
}
const corteComProducao = alteracoes => ({
  numero:922,produto:'VEU GOTA / ESPECIAL',mesa:'MESA 1',status:'EM PRODUÇÃO',
  ultima_producao:{...ultima,...alteracoes}
})

test('mesa exibe a última produção com data, turno, operador e folhas, sem buscar o histórico', () => {
  consulta = async () => { throw new Error('A prévia não deve buscar o histórico por corte') }
  modulo.atualizarOcupacaoMesas([corteComProducao()])
  const card = elementos.painelMesas.children[0]
  assert.match(card.textContent, /Corte 922.*Última produção.*Hoje.*21\/10\/2026.*1º TURNO.*MATHEUS.*0 → 50/)
  const previa = card.children[1].children[0].children[2]
  assert.match(previa.children[0].children[1].className, /mesa-producao-hoje/)
})

test('idade da produção distingue ontem, vários dias e datas futuras com os dados do servidor', () => {
  for (const [dias, texto, destaque] of [[1,'Ontem',false],[7,'Há 7 dias',true],[-1,'Data futura',true]]) {
    modulo.atualizarOcupacaoMesas([corteComProducao({data:'2026-10-14',dias_sem_lancamento:dias})])
    const previa = elementos.painelMesas.children[0].children[1].children[0].children[2]
    const idade = previa.children[0].children[1]
    assert.equal(idade.textContent,texto)
    assert.equal(idade.className.includes('mesa-producao-antiga'),destaque)
  }
})

test('corte sem produção é identificado; uma prévia indisponível não é confundida com ausência de lançamentos', () => {
  modulo.atualizarOcupacaoMesas([{...corteComProducao(),ultima_producao:null}])
  let card = elementos.painelMesas.children[0]
  assert.match(card.textContent, /ainda não possui lançamentos de produção/)
  assert.doesNotMatch(card.textContent,/Operador|Folhas/)
  modulo.atualizarOcupacaoMesas([{numero:922,produto:'VEU GOTA',mesa:'MESA 1'}])
  card = elementos.painelMesas.children[0]
  assert.match(card.textContent,/Prévia indisponível/)
  assert.doesNotMatch(card.textContent,/não possui lançamentos/)
})

test('atualização da ocupação substitui a prévia antiga pelo último lançamento', () => {
  modulo.atualizarOcupacaoMesas([corteComProducao({operador:'MATHEUS',folha_parou:50})])
  modulo.atualizarOcupacaoMesas([corteComProducao({id:41,operador:'SOFIA',folha_inicio:50,folha_parou:100})])
  const card = elementos.painelMesas.children[0]
  assert.match(card.textContent,/SOFIA.*50 → 100/)
  assert.doesNotMatch(card.textContent,/MATHEUS/)
})

test('conflito de mesa não apaga a prévia já carregada do mesmo corte', () => {
  modulo.atualizarOcupacaoMesas([corteComProducao()])
  modulo.informarMesaOcupada('MESA 1',[{numero:922,produto:'VEU GOTA / ESPECIAL'}])
  assert.match(elementos.painelMesas.children[0].textContent,/MATHEUS.*0 → 50/)
  assert.equal(elementos.cadastrarCorte.disabled,true)
})

test('cortes legados na mesma mesa mantêm prévias independentes e operador é texto seguro', () => {
  modulo.atualizarOcupacaoMesas([
    corteComProducao({operador:'<img src=x onerror=alert(1)>',folha_parou:50}),
    {...corteComProducao({operador:'SOFIA',folha_inicio:100,folha_parou:120}),numero:919}
  ])
  const lista = elementos.painelMesas.children[0].children[1]
  assert.match(lista.children[0].textContent,/922.*<img src=x onerror=alert\(1\)>.*0 → 50/)
  assert.match(lista.children[1].textContent,/919.*SOFIA.*100 → 120/)
  const dados = lista.children[0].children[2].children[1]
  const operador = dados.children[2].children[1]
  assert.equal(operador.tag,'dd')
  assert.equal(operador.children.length,0)
})

test('campos não informados ficam explícitos sem transformar folha zero em vazio ou data em hoje', () => {
  modulo.atualizarOcupacaoMesas([corteComProducao({data:null,turno:null,operador:null,folha_inicio:0,folha_parou:0,dias_sem_lancamento:null})])
  const card = elementos.painelMesas.children[0]
  assert.match(card.textContent,/Data Não informada.*Operador Não informado.*0 → 0/)
  assert.doesNotMatch(card.textContent,/Hoje|Ontem|Há \d+ dias/)
})

test('os cartões abrem o corte correto e preparam um novo somente na mesa livre escolhida', async () => {
  const abertas=[], novas=[]
  modulo.inicializarControleMesas({abrirCorte:async numero=>abertas.push(numero),novoCorte:async mesa=>novas.push(mesa)})
  modulo.atualizarOcupacaoMesas([corteComProducao()])
  const cards=elementos.painelMesas.children
  const abrir=cards[0].children[1].children[0].children[3]
  const novo=cards[1].children[2]
  assert.equal(abrir.textContent,'Abrir corte')
  assert.equal(abrir.attributes['aria-label'],'Abrir corte 922 da MESA 1')
  await abrir.events.click()
  await novo.events.click()
  assert.deepEqual(abertas,[922])
  assert.deepEqual(novas,['MESA 2'])
})

test('ações das mesas evitam duplo clique e liberam os botões após falha', async () => {
  let resolver, chamadas=0
  const erros=[]
  modulo.inicializarControleMesas({novoCorte:()=>{chamadas++;return new Promise((_,reject)=>{resolver=reject})},aoErro:erro=>erros.push(erro.message)})
  modulo.atualizarOcupacaoMesas([])
  const primeiro=elementos.painelMesas.children[0].children[2]
  const segundo=elementos.painelMesas.children[1].children[2]
  const acao=primeiro.events.click()
  assert.equal(primeiro.disabled,true)
  assert.equal(segundo.disabled,true)
  await segundo.events.click()
  assert.equal(chamadas,1)
  resolver(new Error('Mesa ocupada'))
  await acao
  assert.deepEqual(erros,['Mesa ocupada'])
  assert.equal(primeiro.disabled,false)
  assert.equal(segundo.disabled,false)
})

test('horário usa Brasília, só muda em uma consulta bem-sucedida e falha impede preparar mesa desatualizada', async () => {
  const agora=new Date('2026-10-21T11:42:00Z')
  let novas=0
  modulo.inicializarControleMesas({novoCorte:async()=>novas++})
  assert.equal(elementos.ultimaAtualizacaoMesas.hidden,true)
  modulo.atualizarOcupacaoMesas([],agora)
  assert.match(elementos.ultimaAtualizacaoMesas.textContent,/21\/10\/2026 às 08:42/)
  const horario=elementos.ultimaAtualizacaoMesas.dateTime
  modulo.informarFalhaOcupacaoMesas()
  assert.equal(elementos.ultimaAtualizacaoMesas.dateTime,horario)
  assert.match(elementos.ultimaAtualizacaoMesas.className,/antiga/)
  const novo=elementos.painelMesas.children[0].children[2]
  assert.equal(novo.disabled,true)
  await novo.events.click()
  assert.equal(novas,0)
  modulo.atualizarOcupacaoMesas([],new Date('2026-10-21T11:45:00Z'))
  assert.match(elementos.ultimaAtualizacaoMesas.textContent,/08:45/)
  assert.doesNotMatch(elementos.ultimaAtualizacaoMesas.className,/antiga/)
})

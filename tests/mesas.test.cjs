const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

let elementos, modulo, consulta, sequencia = 0
function elemento(tag) {
  return {
    tag, children:[], className:'', hidden:false, texto:'',
    get textContent() { return this.texto + this.children.map(c => c.textContent).join(' ') },
    set textContent(texto) { this.texto = String(texto); this.children = [] },
    append(...filhos) { this.children.push(...filhos) },
    replaceChildren(...filhos) { this.texto = ''; this.children = filhos }
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
    painelMesas:elemento('div'), estadoPainelMesas:elemento('p')
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

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

class Elemento {
  constructor() {
    this.children = []
    this.textContent = ''
    this.dataset = {}
    this.attributes = {}
    this.events = {}
    this.hidden = false
    this.value = ''
  }
  replaceChildren(...children) { this.children = children }
  append(...children) { this.children.push(...children) }
  appendChild(child) { this.children.push(child) }
  setAttribute(name, value) { this.attributes[name] = value }
  addEventListener(name, handler) { this.events[name] = handler }
  async click() { await this.events.click?.() }
}

let elementos, botoes, api, modulo, sequencia = 0
const resposta = {
  hoje: '2026-10-14', data_inicial: '2026-10-12',
  cortes: [
    { numero: 843, produto: 'VOIL', mesa: 'MESA 1', data_finalizacao: '2026-10-14' },
    { numero: 842, produto: 'OXFORD', mesa: 'MESA 2', data_finalizacao: '2026-10-13' },
    { numero: 841, produto: 'TULE', mesa: 'MESA 3', data_finalizacao: '2026-10-12' }
  ]
}

beforeEach(async () => {
  elementos = Object.fromEntries([
    'listaFinalizadosRecentes', 'estadoFinalizadosRecentes',
    'totalFinalizadosRecentes', 'numeroCorte'
  ].map(id => [id, new Elemento()]))
  botoes = ['hoje', 'recentes'].map(periodo => {
    const elemento = new Elemento()
    elemento.dataset.periodoFinalizados = periodo
    return elemento
  })
  globalThis.document = {
    getElementById: id => elementos[id],
    querySelectorAll: () => botoes,
    createElement: () => new Elemento()
  }
  api = async () => resposta
  globalThis.__apiResumoTeste = (...args) => api(...args)
  const codigo = fs.readFileSync('src/public/js/pages/index/finalizados.js', 'utf8')
    .replace('import { apiGet } from "../../core/api.js"', 'const apiGet = globalThis.__apiResumoTeste')
  modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${++sequencia}`)
  modulo.inicializarResumoFinalizados(() => {})
})

test('Hoje mostra apenas a data do servidor e o segundo filtro inclui os dois dias anteriores', async () => {
  await modulo.carregarResumoFinalizados()
  assert.equal(elementos.totalFinalizadosRecentes.textContent, '1 corte')
  assert.equal(elementos.listaFinalizadosRecentes.children.length, 1)
  assert.equal(botoes[0].attributes['aria-pressed'], 'true')
  await botoes[1].click()
  assert.equal(elementos.totalFinalizadosRecentes.textContent, '3 cortes')
  assert.equal(elementos.listaFinalizadosRecentes.children.length, 3)
  assert.equal(botoes[1].attributes['aria-pressed'], 'true')
  assert.equal(botoes[0].attributes['aria-pressed'], 'false')
})

test('cartão seleciona o corte e apresenta o produto como texto', async () => {
  api = async () => ({ ...resposta, cortes: [{ ...resposta.cortes[0], produto: '<img src=x onerror=alert(1)>' }] })
  let aberto
  modulo.inicializarResumoFinalizados(numero => { aberto = numero })
  await modulo.carregarResumoFinalizados()
  const cartao = elementos.listaFinalizadosRecentes.children[0]
  assert.equal(cartao.children[1].textContent, '<img src=x onerror=alert(1)>')
  assert.equal(cartao.children[2].textContent, 'MESA 1 · 14/10/2026')
  await cartao.click()
  assert.equal(aberto, 843)
  assert.equal(elementos.numeroCorte.value, 843)
})

test('resumo vazio e falha de carregamento têm mensagens diferentes', async t => {
  api = async () => ({ ...resposta, cortes: [] })
  await modulo.carregarResumoFinalizados()
  assert.equal(elementos.estadoFinalizadosRecentes.textContent, 'Nenhum corte finalizado hoje.')
  assert.equal(elementos.totalFinalizadosRecentes.textContent, '0 cortes')
  t.mock.method(console, 'error', () => {})
  api = async () => { throw new Error('Falha de conexão') }
  await modulo.carregarResumoFinalizados()
  assert.match(elementos.estadoFinalizadosRecentes.textContent, /Não foi possível carregar/)
  assert.equal(elementos.totalFinalizadosRecentes.textContent, '—')
})

test('resposta antiga não substitui uma atualização mais recente', async () => {
  const pendentes = []
  api = () => new Promise(resolve => pendentes.push(resolve))
  const antiga = modulo.carregarResumoFinalizados()
  const nova = modulo.carregarResumoFinalizados()
  pendentes[1]({ ...resposta, cortes: [] })
  await nova
  pendentes[0](resposta)
  await antiga
  assert.equal(elementos.totalFinalizadosRecentes.textContent, '0 cortes')
})

test('a validação na tela recusa folhas invertidas e negativos e aceita zero', async () => {
  const codigo = fs.readFileSync('src/public/js/utils/validations.js', 'utf8')
  const validacoes = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
  assert.ok(validacoes.validarFolhas('10', '9'))
  assert.ok(validacoes.validarFolhas('-1', '10'))
  assert.ok(validacoes.validarFolhas('0', 'Infinity'))
  assert.equal(validacoes.validarFolhas('0', '0'), null)
  assert.ok(validacoes.validarValoresItem({ perda: '-0.5' }))
  assert.ok(validacoes.validarValoresItem({ quantidade: 'NaN' }))
  assert.equal(validacoes.validarValoresItem({ metragem: '0', quantidade: '2.5' }), null)
})

const {test, before, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

let Rascunhos, dados, armazenamento
before(async () => {
  const codigo = fs.readFileSync('src/public/js/utils/rascunhos.js', 'utf8')
  ;({Rascunhos} = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`))
})
beforeEach(() => {
  dados = new Map()
  armazenamento = {getItem:chave => dados.get(chave) ?? null, setItem:(chave,valor) => dados.set(chave,valor)}
})

test('o rascunho permanece disponível em uma nova sessão e separa os grupos e os cortes', () => {
  const atual = new Rascunhos(armazenamento)
  atual.salvar('843', false, 'producao', {turno:'1º TURNO'}, '10')
  atual.salvar('843', false, 'item', {modeloItem:'PI A'}, null)
  atual.salvar('844', true, 'novo', {produtoNovo:'VESTIDO'}, null)
  const recuperado = new Rascunhos(armazenamento).ler()
  assert.equal(recuperado['843'].grupos.producao.campos.turno, '1º TURNO')
  assert.equal(recuperado['843'].grupos.item.campos.modeloItem, 'PI A')
  assert.equal(recuperado['844'].grupos.novo.campos.produtoNovo, 'VESTIDO')
})

test('concluir um envio remove somente o grupo enviado, mantendo os outros rascunhos', () => {
  const atual = new Rascunhos(armazenamento)
  atual.salvar('843', false, 'producao', {turno:'1º TURNO'}, '10')
  atual.salvar('843', false, 'item', {modeloItem:'PI'}, null)
  atual.excluirGrupo('843', 'producao', atual.ler()['843'].grupos.producao.versao)
  assert.equal(atual.ler()['843'].grupos.producao, undefined)
  assert.ok(atual.ler()['843'].grupos.item)
  atual.excluirGrupo('843', 'item')
  assert.equal(atual.ler()['843'], undefined)
})

test('a resposta de um envio antigo não apaga campos digitados depois dele', () => {
  const atual = new Rascunhos(armazenamento)
  atual.salvar('843', false, 'producao', {folhaParouInput:'20'}, '10')
  const enviada = atual.ler()['843'].grupos.producao.versao
  atual.salvar('843', false, 'producao', {folhaParouInput:'25'}, '10')
  atual.excluirGrupo('843', 'producao', enviada)
  assert.equal(atual.ler()['843'].grupos.producao.campos.folhaParouInput, '25')
})

test('descartar um corte não remove dados de outros cortes ou outras preferências do navegador', () => {
  dados.set('preferencia', 'mantida')
  const atual = new Rascunhos(armazenamento)
  for (const numero of ['843','844']) atual.salvar(numero, true, 'novo', {produtoNovo:numero}, null)
  atual.excluir('843')
  assert.ok(atual.ler()['844'])
  assert.equal(atual.ler()['843'], undefined)
  assert.equal(dados.get('preferencia'), 'mantida')
})

test('armazenamento inválido ou bloqueado é sinalizado sem apagar o conteúdo existente', () => {
  dados.set('controle-corte:rascunhos:v1', '{inválido')
  assert.throws(() => new Rascunhos(armazenamento).salvar('843', true, 'novo', {}, null))
  assert.equal(dados.get('controle-corte:rascunhos:v1'), '{inválido')
  const bloqueado = {getItem:() => {throw new Error('Bloqueado')}}
  assert.throws(() => new Rascunhos(bloqueado).ler(), /Bloqueado/)
})

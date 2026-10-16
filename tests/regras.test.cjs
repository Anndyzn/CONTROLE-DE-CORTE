const { test, before, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { periodoResumo } = require('../dist/utils/periodo-resumo')

// Banco em memória: estes testes nunca carregam credenciais nem escrevem no banco real.
let banco
const tabelas = {
  producao: ['data', 'numero_corte', 'turno', 'operador', 'folha_inicio', 'folha_parou', 'status', 'hora_inicio', 'hora_fim'],
  itens_corte: ['numero_corte', 'modelo', 'cor', 'tecido', 'metragem_usada', 'sobra_metros', 'perda_metros', 'metros_faltantes', 'quantidade_pecas'],
  cortes: ['numero', 'produto', 'mesa']
}

const cortesCadastrados = () => [...(banco.corte ? [banco.corte] : []), ...banco.outrosCortes]
const normalizarMesa = mesa => String(mesa ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
const producoesDoCorte = numero => banco.producao.filter(p => p.numero_corte === Number(numero)).sort((a, b) => b.id - a.id)

async function consultar(sql, valores = [], desfazer = []) {
  const query = sql.replace(/\s+/g, ' ').trim()
  banco.consultas++

  if (query.startsWith('BEGIN') || ['COMMIT', 'ROLLBACK'].includes(query)) return { rows: [] }
  if (query.includes('pg_advisory_xact_lock')) return { rows: [] }
  if (/^(CREATE|ALTER) /.test(query)) return { rows: [] }
  if (query.startsWith('INSERT INTO historico_admin')) {
    if (banco.falharHistorico) throw new Error('Falha simulada ao registrar histórico')
    const [numero_corte, acao, registro_id, responsavel, motivo, antes, depois] = valores
    const registro = {id:banco.historico.length+1, criado_em:new Date().toISOString(), numero_corte, acao, registro_id,
      responsavel, motivo, antes:JSON.parse(antes), depois:JSON.parse(depois)}
    banco.historico.push(registro)
    desfazer.push(() => { banco.historico = banco.historico.filter(r => r !== registro) })
    return {rows:[]}
  }
  if (query.startsWith('SELECT * FROM historico_admin')) {
    return {rows:banco.historico.filter(r => (valores[0] === null || r.numero_corte === valores[0])
      && (valores[1] === null || r.id < Number(valores[1]))).sort((a,b) => b.id-a.id).slice(0,51)}
  }
  if (/SELECT \* FROM cortes WHERE numero/.test(query)) {
    return {rows:structuredClone(cortesCadastrados().filter(c => c.numero === Number(valores[0])))}
  }
  if (/SELECT (\*|numero_corte) FROM (producao|itens_corte) WHERE id/.test(query)) {
    const tabela = query.match(/FROM (\w+)/)[1]
    return {rows:structuredClone(banco[tabela].filter(r => BigInt(r.id) === BigInt(valores[0])))}
  }
  const exclusao = query.match(/^DELETE FROM (producao|itens_corte) WHERE (id|numero_corte)/)
  if (exclusao) {
    const [,tabela,campo] = exclusao
    const removidos = banco[tabela].filter(r => BigInt(r[campo]) === BigInt(valores[0]))
    banco[tabela] = banco[tabela].filter(r => !removidos.includes(r))
    desfazer.push(() => { banco[tabela].push(...removidos) })
    banco.gravacoes += removidos.length
    return {rows:structuredClone(removidos), rowCount:removidos.length}
  }
  if (query.startsWith('DELETE FROM cortes')) {
    const anterior = banco.corte
    const outros = banco.outrosCortes.filter(c => c.numero === Number(valores[0]))
    if (banco.corte?.numero === Number(valores[0])) banco.corte = null
    banco.outrosCortes = banco.outrosCortes.filter(c => !outros.includes(c))
    desfazer.push(() => { banco.corte = anterior; banco.outrosCortes.push(...outros) })
    return {rows:[]}
  }
  if (query.includes('REGEXP_REPLACE(c.mesa')) {
    const ocupantes = cortesCadastrados().filter(corte => {
      const ultima = producoesDoCorte(corte.numero)[0]
      return normalizarMesa(corte.mesa) === valores[0] && ultima?.status !== 'FINALIZADO'
        && corte.numero !== valores[1]
    }).sort((a, b) => b.numero - a.numero)
    return { rows: ocupantes.map(({numero, produto}) => ({numero, produto})) }
  }
  if (/SELECT numero, itens_finalizados, mesa FROM cortes/.test(query)) {
    const corte = cortesCadastrados().find(c => c.numero === Number(valores[0]))
    return { rows: corte ? [corte] : [] }
  }
  if (/SELECT status FROM producao/.test(query)) {
    return { rows: producoesDoCorte(valores[0]).slice(0, 1) }
  }
  if (/SELECT id, numero_corte FROM producao WHERE id/.test(query)) {
    return { rows: banco.producao.filter(p => BigInt(p.id) === BigInt(valores[0])) }
  }
  if (/SELECT id, status FROM producao/.test(query)) {
    return { rows: producoesDoCorte(valores[0]).slice(0, 2) }
  }
  if (/SELECT COUNT\(\*\)/.test(query)) return { rows: [{ total: banco.itens_corte.filter(item => item.numero_corte === Number(valores[0])).length }] }
  if (/TO_CHAR\(p.data/.test(query)) {
    banco.periodo = valores
    return { rows: banco.resumo }
  }

  const insercao = query.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES/i)
  if (insercao) {
    const tabela = insercao[1]
    const colunas = insercao[2].split(',').map(c => c.trim())
    assert.ok(colunas.every(c => tabelas[tabela].includes(c)), 'Colunas SQL válidas')
    const registro = Object.fromEntries(colunas.map((coluna, i) => [coluna, valores[i]]))
    registro.id = Math.max(0, ...[...banco.producao,...banco.itens_corte,...banco.outrosCortes].map(r => Number(r.id)||0)) + 1
    if (tabela === 'cortes' && cortesCadastrados().some(c => c.numero === registro.numero)) {
      throw Object.assign(new Error('Número de corte duplicado'), {code:'23505'})
    }
    // Mantém a primeira finalização em andamento enquanto a segunda requisição chega.
    await new Promise(resolve => setTimeout(resolve, 15))
    banco.gravacoes++
    const nome = tabela === 'cortes' ? 'outrosCortes' : tabela
    if (tabela === 'cortes') registro.itens_finalizados = 0
    banco[nome].push(registro)
    desfazer.push(() => { banco[nome] = banco[nome].filter(r => r !== registro) })
    return { rows: [registro] }
  }

  if (/^UPDATE (producao|itens_corte) /.test(query)) {
    const tabela = query.match(/^UPDATE (\w+)/)[1]
    const registro = banco[tabela].find(item => BigInt(item.id) === BigInt(valores.at(-1)))
    if (!registro) return { rows: [] }
    await new Promise(resolve => setTimeout(resolve, 15))
    const anterior = structuredClone(registro)
    desfazer.push(() => Object.assign(registro, anterior))
    for (const campo of query.matchAll(/(\w+)\s*=\s*\$(\d+)/g)) registro[campo[1]] = valores[Number(campo[2]) - 1]
    banco.gravacoes++
    return { rows: [registro] }
  }
  if (/^UPDATE cortes SET produto/.test(query)) {
    const corte = cortesCadastrados().find(c => c.numero === Number(valores[1]))
    const anterior = structuredClone(corte)
    desfazer.push(() => Object.assign(corte, anterior))
    corte.produto = valores[0]
    banco.gravacoes++
    return { rows: [structuredClone(corte)] }
  }
  if (/^UPDATE cortes SET itens_finalizados/.test(query)) {
    const anterior = banco.corte.itens_finalizados
    desfazer.push(() => { banco.corte.itens_finalizados = anterior })
    banco.corte.itens_finalizados = query.includes('= 1') ? 1 : 0
    banco.gravacoes++
    return { rows: [banco.corte] }
  }
  throw new Error(`Consulta não suportada pelo banco de teste: ${query}`)
}

const pool = {
  query: consultar,
  async connect() {
    const liberacoes = []
    const desfazer = []
    return {
      async query(sql, valores) {
        if (sql === 'COMMIT') desfazer.length = 0
        if (sql === 'ROLLBACK') { for (const operacao of desfazer.reverse()) operacao(); desfazer.length = 0 }
        const chave = sql.includes('FOR UPDATE') ? `corte:${valores[0]}`
          : sql.includes('pg_advisory_xact_lock') ? `mesa:${valores.join(':')}` : null
        if (chave) {
          const anterior = banco.filas.get(chave) ?? Promise.resolve()
          banco.filas.set(chave, new Promise(resolve => { liberacoes.push(resolve) }))
          await anterior
        }
        return consultar(sql, valores, desfazer)
      },
      release() { liberacoes.forEach(liberar => liberar()) }
    }
  }
}

const moduloBanco = require.resolve('../dist/database-pg')
require.cache[moduloBanco] = { id: moduloBanco, filename: moduloBanco, loaded: true, exports: { __esModule: true, default: pool } }
const app = express()
app.use(express.json())
for (const rota of ['producao', 'itens', 'cortes', 'consultas', 'historico-admin']) app.use(require(`../dist/routes/${rota}.routes`).default)

let servidor, url
before(async () => {
  servidor = await new Promise(resolve => {
    const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia))
  })
  url = `http://127.0.0.1:${servidor.address().port}`
})
beforeEach(() => {
  banco = {
    corte: { numero: 843, itens_finalizados: 0 },
    producao: [], itens_corte: [], outrosCortes: [], resumo: [], historico: [], falharHistorico:false,
    gravacoes: 0, consultas: 0, filas: new Map()
  }
})
after(() => new Promise(resolve => servidor.close(resolve)))

async function enviar(path, dados, method = 'POST') {
  if (method === 'PUT' || method === 'DELETE' || path.endsWith('/reabrir-itens')) {
    dados = {responsavel:'RESPONSÁVEL TESTE', motivo:'Correção para conferência', ...dados}
  }
  const resposta = await fetch(url + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
  })
  return { status: resposta.status, dados: await resposta.json() }
}

const producao = {
  data: '2026-10-14', numero_corte: 843, turno: '1º TURNO', operador: 'OPERADOR',
  folha_inicio: 10, folha_parou: 20, status: 'EM PRODUÇÃO', hora_inicio: '08:00', hora_fim: '09:00'
}
const item = { numero_corte: 843, modelo: 'PI', cor: 'BRANCO', tecido: 'VOIL', metragem_usada: 12.5, quantidade_pecas: 5 }

test('recusa folhas invertidas e números negativos, vazios ou não finitos sem consultar o banco', async () => {
  for (const alteracao of [
    { folha_parou: 9 }, { folha_inicio: -1 }, { folha_parou: -1 },
    { folha_parou: 'NaN' }, { folha_inicio: 'Infinity' }, { folha_parou: '' },
    { folha_inicio: null }, { folha_parou: false }, { folha_parou: 20.5 },
    { folha_parou: 2147483648 }, { numero_corte: -843 }
  ]) assert.equal((await enviar('/producao', { ...producao, ...alteracao })).status, 400)
  assert.equal(banco.consultas, 0)
  assert.equal(banco.gravacoes, 0)
})

test('aceita zero, valores iguais e turno que atravessa meia-noite', async () => {
  const resposta = await enviar('/producao', { ...producao, folha_inicio: '0', folha_parou: '0', hora_inicio: '23:00', hora_fim: '01:00' })
  assert.equal(resposta.status, 201)
  assert.equal(banco.producao[0].folha_inicio, 0)
})

test('recusa produção em corte inexistente ou finalizado', async () => {
  banco.corte = null
  assert.equal((await enviar('/producao', producao)).status, 404)
  banco.corte = { numero: 843, itens_finalizados: 0 }
  banco.producao = [{ ...producao, id: 1, status: 'FINALIZADO' }]
  assert.equal((await enviar('/producao', producao)).status, 409)
  banco.producao = []
  banco.corte.itens_finalizados = 1
  assert.equal((await enviar('/producao', producao)).status, 409)
  assert.equal(banco.gravacoes, 0)
})

test('duas finalizações simultâneas gravam apenas um lançamento', async () => {
  const respostas = await Promise.all([
    enviar('/producao', { ...producao, status: 'FINALIZADO' }),
    enviar('/producao', { ...producao, status: 'FINALIZADO' })
  ])
  assert.deepEqual(respostas.map(r => r.status).sort(), [201, 409])
  assert.equal(banco.producao.length, 1)
})

test('Admin recusa folhas inválidas e preserva a correção de lançamento finalizado', async () => {
  banco.producao = [{ ...producao, id: 1, status: 'FINALIZADO' }]
  for (const alteracao of [{ folha_inicio: -1 }, { folha_parou: 9 }]) {
    assert.equal((await enviar('/producao/1', { ...producao, ...alteracao }, 'PUT')).status, 400)
  }
  assert.equal((await enviar('/producao/1', { ...producao, status: 'FINALIZADO', folha_parou: 30 }, 'PUT')).status, 200)
  assert.equal(banco.producao[0].folha_parou, 30)
})

test('POST e PUT de PIs recusam negativos e valores não numéricos', async () => {
  for (const campo of ['metragem_usada', 'sobra_metros', 'perda_metros', 'metros_faltantes', 'quantidade_pecas']) {
    for (const valor of [-1, 'NaN', null, false]) {
      // Os campos opcionais podem ser omitidos ou nulos, equivalendo a zero.
      if (valor === null && !['metragem_usada', 'quantidade_pecas'].includes(campo)) continue
      const dados = { ...item, [campo]: valor }
      assert.equal((await enviar('/itens-corte', dados)).status, 400)
      assert.equal((await enviar('/itens-corte/1', dados, 'PUT')).status, 400)
    }
  }
  assert.equal(banco.gravacoes, 0)
})

test('permite os PIs após encerrar a produção e bloqueia novos PIs após a confirmação', async () => {
  assert.equal((await enviar('/producao', { ...producao, status: 'FINALIZADO' })).status, 201)
  assert.equal((await enviar('/itens-corte', { ...item, metragem_usada: 0 })).status, 201)
  assert.equal((await enviar('/cortes/843/finalizar-itens', {})).status, 200)
  assert.equal((await enviar('/itens-corte', item)).status, 409)
  assert.equal((await enviar('/itens-corte/2', { ...item, metragem_usada: 15 }, 'PUT')).status, 200)
  assert.equal((await enviar('/cortes/843/reabrir-itens', {})).status, 200)
  assert.equal((await enviar('/itens-corte', item)).status, 201)
})

test('não confirma PIs vazios e recusa número de corte negativo no cadastro', async () => {
  assert.equal((await enviar('/cortes/843/finalizar-itens', {})).status, 400)
  assert.equal(banco.corte.itens_finalizados, 0)
  assert.equal((await enviar('/cortes', { numero: -1, produto: 'PI', mesa: 'MESA 1' })).status, 400)
  assert.equal(banco.gravacoes, 0)
})

test('resumo retorna datas do período mesmo sem cortes finalizados', async () => {
  const resposta = await fetch(url + '/cortes-finalizados-recentes')
  const dados = await resposta.json()
  assert.equal(resposta.status, 200)
  assert.deepEqual(dados.cortes, [])
  assert.deepEqual(banco.periodo, [dados.data_inicial, dados.hoje])
  assert.equal((Date.parse(dados.hoje) - Date.parse(dados.data_inicial)) / 86400000, 2)
})

test('período usa a data de São Paulo e atravessa meses e anos corretamente', () => {
  assert.deepEqual(periodoResumo(new Date('2026-10-15T01:00:00Z')), { hoje: '2026-10-14', data_inicial: '2026-10-12' })
  assert.deepEqual(periodoResumo(new Date('2026-01-01T12:00:00Z')), { hoje: '2026-01-01', data_inicial: '2025-12-30' })
  assert.deepEqual(periodoResumo(new Date('2024-03-01T12:00:00Z')), { hoje: '2024-03-01', data_inicial: '2024-02-28' })
})

test('mesa ocupada por corte sem produção recusa novo cadastro e informa o corte anterior', async () => {
  banco.corte.mesa = 'MESA 1'
  banco.corte.produto = 'VOIL'
  const resposta = await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})
  assert.equal(resposta.status, 409)
  assert.equal(resposta.dados.codigo, 'MESA_OCUPADA')
  assert.equal(resposta.dados.mesa, 'MESA 1')
  assert.deepEqual(resposta.dados.cortes, [{numero:843, produto:'VOIL'}])
  assert.match(resposta.dados.erro, /Finalize esse corte/)
  assert.equal(banco.gravacoes, 0)
})

test('mesa ocupada continua bloqueada durante a produção e outra mesa pode receber corte', async () => {
  banco.corte.mesa = 'MESA 1'
  banco.producao = [{...producao, id:1}]
  assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})).status, 409)
  const livre = await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 2'})
  assert.equal(livre.status, 201)
  assert.equal(livre.dados.corte.mesa, 'MESA 2')
})

test('finalizar a produção libera a mesa e o novo cadastro já reserva a mesma mesa', async () => {
  banco.corte.mesa = 'MESA 1'
  assert.equal((await enviar('/producao', {...producao, status:'FINALIZADO'})).status, 201)
  assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})).status, 201)
  const terceiro = await enviar('/cortes', {numero:845, produto:'OUTRO', mesa:'MESA 1'})
  assert.equal(terceiro.status, 409)
  assert.equal(terceiro.dados.cortes[0].numero, 844)
})

test('usa o último status e não uma finalização antiga para decidir a ocupação', async () => {
  banco.corte.mesa = 'MESA 1'
  banco.producao = [
    {...producao, id:1, status:'FINALIZADO'},
    {...producao, id:2, status:'EM PRODUÇÃO'}
  ]
  assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})).status, 409)
})

test('diferenças de espaços e letras não permitem contornar a ocupação da mesa', async () => {
  banco.corte.mesa = ' mesa  1 '
  const resposta = await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'  mesa\t1 '})
  assert.equal(resposta.status, 409)
  assert.equal(resposta.dados.mesa, 'MESA 1')
  const livre = await enviar('/cortes', {numero:844, produto:' NOVO ', mesa:'  mesa  2 '})
  assert.equal(livre.status, 201)
  assert.equal(livre.dados.corte.mesa, 'MESA 2')
  assert.equal(livre.dados.corte.produto, 'NOVO')
})

test('informa todos os cortes antigos ainda abertos na mesma mesa', async () => {
  banco.corte.mesa = 'MESA 1'
  banco.outrosCortes = [{numero:842, produto:'OUTRO', mesa:'MESA 1', itens_finalizados:0}]
  const resposta = await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})
  assert.equal(resposta.status, 409)
  assert.deepEqual(resposta.dados.cortes.map(corte => corte.numero), [843,842])
  assert.match(resposta.dados.erro, /Finalize esses cortes/)
})

test('dois cadastros simultâneos na mesma mesa criam apenas um corte', async () => {
  banco.corte = null
  const respostas = await Promise.all([
    enviar('/cortes', {numero:844, produto:'NOVO A', mesa:'MESA 1'}),
    enviar('/cortes', {numero:845, produto:'NOVO B', mesa:'MESA 1'})
  ])
  assert.deepEqual(respostas.map(resposta => resposta.status).sort(), [201,409])
  assert.equal(banco.outrosCortes.length, 1)
})

test('cadastros simultâneos em mesas diferentes são permitidos', async () => {
  banco.corte = null
  const respostas = await Promise.all([
    enviar('/cortes', {numero:844, produto:'NOVO A', mesa:'MESA 1'}),
    enviar('/cortes', {numero:845, produto:'NOVO B', mesa:'MESA 2'})
  ])
  assert.deepEqual(respostas.map(resposta => resposta.status), [201,201])
  assert.equal(banco.outrosCortes.length, 2)
})

test('recusa mesas inexistentes e dados inválidos antes de consultar o banco', async () => {
  for (const mesa of ['', 'MESA 4', 'MESA1', null, {}]) {
    assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa})).status, 400)
  }
  assert.equal((await enviar('/cortes', {numero:844, produto:{nome:'NOVO'}, mesa:'MESA 1'})).status, 400)
  assert.equal(banco.consultas, 0)
})

function prepararReabertura({ocupada = false, historico = []} = {}) {
  banco.corte.mesa = 'MESA 1'
  banco.producao = [...historico, {...producao, id:10, status:'FINALIZADO'}]
  if (ocupada) banco.outrosCortes.push({numero:844, produto:'OUTRO CORTE', mesa:'MESA 1', itens_finalizados:0})
}

test('Admin bloqueia reabrir pela edição quando outro corte ocupa a mesa, preservando o lançamento', async () => {
  prepararReabertura({ocupada:true})
  const resposta = await enviar('/producao/10', {...producao, folha_parou:25}, 'PUT')
  assert.equal(resposta.status, 409)
  assert.equal(resposta.dados.codigo, 'MESA_OCUPADA')
  assert.equal(resposta.dados.mesa, 'MESA 1')
  assert.deepEqual(resposta.dados.cortes.map(c => c.numero), [844])
  assert.match(resposta.dados.erro, /antes de reabrir este corte/)
  assert.equal(banco.producao[0].status, 'FINALIZADO')
  assert.equal(banco.producao[0].folha_parou, 20)
  assert.equal(banco.gravacoes, 0)
})

test('Admin permite reabrir na mesa livre e a reabertura impede um novo cadastro nela', async () => {
  prepararReabertura()
  assert.equal((await enviar('/producao/10', producao, 'PUT')).status, 200)
  assert.equal(banco.producao[0].status, 'EM PRODUÇÃO')
  assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})).status, 409)
})

test('a grafia numérica do ID não permite contornar a proteção da reabertura', async () => {
  prepararReabertura({ocupada:true})
  assert.equal((await enviar('/producao/010', producao, 'PUT')).status, 409)
  assert.equal((await enviar('/producao/010', {}, 'DELETE')).status, 409)
  assert.equal(banco.gravacoes, 0)
})

test('Admin preserva correções finalizadas e de registros antigos sem reabrir a mesa', async () => {
  prepararReabertura({ocupada:true, historico:[{...producao, id:1, status:'FINALIZADO'}]})
  assert.equal((await enviar('/producao/10', {...producao, status:'FINALIZADO', folha_parou:30}, 'PUT')).status, 200)
  assert.equal((await enviar('/producao/1', producao, 'PUT')).status, 200)
  assert.equal(producoesDoCorte(843)[0].status, 'FINALIZADO')
  assert.equal(producoesDoCorte(843)[0].folha_parou, 30)
})

test('excluir a finalização não reabre uma mesa ocupada, mesmo quando não há produção anterior', async () => {
  for (const historico of [[], [{...producao, id:1}]]) {
    prepararReabertura({historico})
    banco.outrosCortes = [{numero:844, produto:'OUTRO', mesa:'MESA 1', itens_finalizados:0}]
    const resposta = await enviar('/producao/10', {}, 'DELETE')
    assert.equal(resposta.status, 409)
    assert.equal(resposta.dados.codigo, 'MESA_OCUPADA')
    assert.equal(producoesDoCorte(843)[0].id, 10)
    assert.equal(banco.gravacoes, 0)
  }
})

test('Admin permite excluir a finalização na mesa livre e reserva a mesa para o corte reaberto', async () => {
  prepararReabertura()
  assert.equal((await enviar('/producao/10', {}, 'DELETE')).status, 200)
  assert.equal(banco.producao.length, 0)
  assert.equal((await enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})).status, 409)
})

test('excluir registros antigos ou manter um status finalizado anterior não altera a ocupação', async () => {
  prepararReabertura({ocupada:true, historico:[{...producao, id:1}, {...producao, id:2, status:'FINALIZADO'}]})
  assert.equal((await enviar('/producao/1', {}, 'DELETE')).status, 200)
  assert.equal((await enviar('/producao/10', {}, 'DELETE')).status, 200)
  assert.equal(producoesDoCorte(843)[0].id, 2)
  assert.equal(producoesDoCorte(843)[0].status, 'FINALIZADO')
})

test('duas reaberturas simultâneas na mesma mesa liberam apenas um dos cortes', async () => {
  prepararReabertura()
  banco.outrosCortes.push({numero:844, produto:'OUTRO', mesa:'MESA 1', itens_finalizados:0})
  banco.producao.push({...producao, id:11, numero_corte:844, status:'FINALIZADO'})
  const respostas = await Promise.all([
    enviar('/producao/10', producao, 'PUT'),
    enviar('/producao/11', producao, 'PUT')
  ])
  assert.deepEqual(respostas.map(r => r.status).sort(), [200,409])
  assert.equal(banco.producao.filter(p => p.status === 'EM PRODUÇÃO').length, 1)
})

test('reabertura e cadastro simultâneos disputam a mesma reserva da mesa', async () => {
  prepararReabertura()
  const respostas = await Promise.all([
    enviar('/producao/10', producao, 'PUT'),
    enviar('/cortes', {numero:844, produto:'NOVO', mesa:'MESA 1'})
  ])
  assert.equal(respostas.filter(r => r.status === 409).length, 1)
  assert.equal(respostas.filter(r => [200,201].includes(r.status)).length, 1)
  const abertos = cortesCadastrados().filter(c => producoesDoCorte(c.numero)[0]?.status !== 'FINALIZADO')
  assert.equal(abertos.length, 1)
})

test('Admin informa lançamento inexistente em edição e exclusão', async () => {
  assert.equal((await enviar('/producao/999', producao, 'PUT')).status, 404)
  assert.equal((await enviar('/producao/999', {}, 'DELETE')).status, 404)
  assert.equal(banco.gravacoes, 0)
})

test('o servidor exige responsável e motivo válidos para correções, reaberturas e exclusões', async () => {
  prepararReabertura()
  banco.itens_corte = [{...item, id:20}]
  for (const invalido of [
    {responsavel:undefined}, {responsavel:' '}, {responsavel:'a'}, {responsavel:'a'.repeat(101)},
    {motivo:undefined}, {motivo:'  '}, {motivo:'ab'}, {motivo:{}}, {motivo:'a'.repeat(1001)}
  ]) {
    assert.equal((await enviar('/producao/10', {...producao, ...invalido}, 'PUT')).status, 400)
    assert.equal((await enviar('/producao/10', invalido, 'DELETE')).status, 400)
    assert.equal((await enviar('/itens-corte/20', {...item, ...invalido}, 'PUT')).status, 400)
    assert.equal((await enviar('/itens-corte/20', invalido, 'DELETE')).status, 400)
    assert.equal((await enviar('/cortes/843/reabrir-itens', invalido)).status, 400)
    assert.equal((await enviar('/cortes/843', invalido, 'DELETE')).status, 400)
  }
  assert.equal(banco.corte.numero, 843)
  assert.equal(banco.producao.length, 1)
  assert.equal(banco.itens_corte.length, 1)
  assert.equal(banco.historico.length, 0)
})

test('uma reabertura grava responsável, motivo e os estados antes e depois', async () => {
  prepararReabertura()
  const resposta = await enviar('/producao/10', {...producao, responsavel:'  ANDY  ', motivo:'  Finalizado por engano  '}, 'PUT')
  assert.equal(resposta.status, 200)
  const registro = banco.historico[0]
  assert.equal(registro.acao, 'REABERTURA_PRODUCAO')
  assert.equal(registro.responsavel, 'ANDY')
  assert.equal(registro.motivo, 'Finalizado por engano')
  assert.equal(registro.antes.status, 'FINALIZADO')
  assert.equal(registro.depois.status, 'EM PRODUÇÃO')
  assert.equal(registro.numero_corte, 843)
})

test('reabertura recusada por mesa ocupada não registra uma alteração que não aconteceu', async () => {
  prepararReabertura({ocupada:true})
  assert.equal((await enviar('/producao/10', producao, 'PUT')).status, 409)
  assert.equal(banco.historico.length, 0)
})

test('excluir a finalização registra a exclusão e conserva seus dados no histórico', async () => {
  prepararReabertura()
  assert.equal((await enviar('/producao/10', {}, 'DELETE')).status, 200)
  assert.equal(banco.historico[0].acao, 'EXCLUSAO_PRODUCAO')
  assert.equal(banco.historico[0].antes.id, 10)
  assert.equal(banco.historico[0].depois, null)
})

test('correção, exclusão e reabertura de PIs também possuem histórico', async () => {
  banco.itens_corte = [{...item, id:20}]
  assert.equal((await enviar('/itens-corte/20', {...item, metragem_usada:30}, 'PUT')).status, 200)
  assert.equal(banco.historico[0].antes.metragem_usada, 12.5)
  assert.equal(banco.historico[0].depois.metragem_usada, 30)
  banco.corte.itens_finalizados = 1
  assert.equal((await enviar('/cortes/843/reabrir-itens', {})).status, 200)
  assert.equal(banco.historico[1].acao, 'REABERTURA_PIS')
  assert.equal(banco.historico[1].antes.itens_finalizados, 1)
  assert.equal(banco.historico[1].depois.itens_finalizados, 0)
  assert.equal((await enviar('/itens-corte/20', {}, 'DELETE')).status, 200)
  assert.equal(banco.historico[2].acao, 'EXCLUSAO_PI')
})

test('excluir um corte preserva toda a cópia removida e o histórico permanece consultável', async () => {
  prepararReabertura()
  banco.itens_corte = [{...item, id:20}]
  const resposta = await enviar('/cortes/843', {}, 'DELETE')
  assert.equal(resposta.status, 200)
  assert.equal(resposta.dados.itens_excluidos, 1)
  assert.equal(resposta.dados.producoes_excluidas, 1)
  assert.equal(banco.corte, null)
  assert.equal(banco.producao.length, 0)
  assert.equal(banco.itens_corte.length, 0)
  const consulta = await fetch(url + '/historico-admin?numero=843')
  const dados = await consulta.json()
  assert.equal(consulta.status, 200)
  assert.equal(dados.registros[0].acao, 'EXCLUSAO_CORTE')
  assert.equal(dados.registros[0].antes.producao[0].id, 10)
  assert.equal(dados.registros[0].antes.itens[0].id, 20)
})

test('falha no histórico desfaz a alteração principal e não retorna sucesso', async () => {
  prepararReabertura()
  banco.itens_corte = [{...item, id:20}]
  banco.falharHistorico = true
  for (const [path, dados, method] of [
    ['/producao/10', producao, 'PUT'], ['/producao/10', {}, 'DELETE'],
    ['/itens-corte/20', {...item, metragem_usada:30}, 'PUT'], ['/itens-corte/20', {}, 'DELETE'],
    ['/cortes/843', {}, 'DELETE']
  ]) {
    assert.equal((await enviar(path, dados, method)).status, 500)
    assert.equal(banco.corte.numero, 843)
    assert.equal(banco.producao[0].status, 'FINALIZADO')
    assert.equal(banco.itens_corte[0].metragem_usada, 12.5)
    assert.equal(banco.historico.length, 0)
  }
})

test('histórico pagina sem duplicar registros e valida os filtros', async () => {
  banco.historico = Array.from({length:55}, (_,i) => ({id:i+1, numero_corte:843}))
  const pagina = await (await fetch(url + '/historico-admin?numero=843')).json()
  assert.equal(pagina.registros.length, 50)
  assert.equal(pagina.tem_mais, true)
  const seguintes = await (await fetch(url + '/historico-admin?numero=843&antes=' + pagina.registros.at(-1).id)).json()
  assert.equal(seguintes.registros.length, 5)
  assert.equal(seguintes.tem_mais, false)
  assert.equal(new Set([...pagina.registros, ...seguintes.registros].map(r => r.id)).size, 55)
  for (const filtro of ['numero=-1','numero=abc','antes=-1','antes=abc','antes=9999999999999999999']) {
    assert.equal((await fetch(url + '/historico-admin?' + filtro)).status, 400)
  }
})

test('corrigir produto preserva mesa, produção e PIs e registra nome anterior e novo', async () => {
  banco.corte = {numero:843, produto:'LISO INFRIOR', mesa:'MESA 1', itens_finalizados:1}
  banco.producao = [{...producao, id:10, status:'FINALIZADO'}]
  banco.itens_corte = [{...item, id:20}]
  const resposta = await enviar('/cortes/843/produto', {
    produto:'  liso inferior  ', produto_anterior:'LISO INFRIOR', mesa:'MESA 2', numero:999
  }, 'PUT')
  assert.equal(resposta.status, 200)
  assert.equal(resposta.dados.corte.produto, 'LISO INFERIOR')
  assert.equal(banco.corte.numero, 843)
  assert.equal(banco.corte.mesa, 'MESA 1')
  assert.equal(banco.corte.itens_finalizados, 1)
  assert.equal(banco.producao[0].status, 'FINALIZADO')
  assert.equal(banco.itens_corte[0].metragem_usada, 12.5)
  assert.equal(banco.historico[0].acao, 'EDICAO_PRODUTO')
  assert.equal(banco.historico[0].antes.produto, 'LISO INFRIOR')
  assert.equal(banco.historico[0].depois.produto, 'LISO INFERIOR')
  assert.equal(banco.historico[0].motivo, 'Correção para conferência')
})

test('produto exige nome válido, responsável, motivo e referência do nome anterior', async () => {
  banco.corte.produto = 'MANTA'
  for (const dados of [
    {produto:''}, {produto:'  '}, {produto:null}, {produto:'A'.repeat(201)},
    {produto:'EDREDOM', responsavel:''}, {produto:'EDREDOM', motivo:''},
    {produto:'EDREDOM', produto_anterior:null}
  ]) {
    assert.equal((await enviar('/cortes/843/produto', {produto_anterior:'MANTA', ...dados}, 'PUT')).status, 400)
  }
  assert.equal(banco.gravacoes, 0)
})

test('duas correções simultâneas não sobrescrevem o produto silenciosamente', async () => {
  banco.corte.produto = 'MANTA'
  const respostas = await Promise.all(['MANTA FLORAL','MANTA LISA'].map(produto =>
    enviar('/cortes/843/produto', {produto, produto_anterior:'MANTA'}, 'PUT')))
  assert.deepEqual(respostas.map(r => r.status).sort(), [200,409])
  assert.equal(banco.historico.length, 1)
  assert.equal(banco.historico[0].depois.produto, banco.corte.produto)
})

test('falha de auditoria desfaz a correção do produto; corte inexistente retorna 404', async () => {
  banco.corte.produto = 'MANTA'
  banco.falharHistorico = true
  assert.equal((await enviar('/cortes/843/produto', {produto:'MANTA LISA',produto_anterior:'MANTA'}, 'PUT')).status, 500)
  assert.equal(banco.corte.produto, 'MANTA')
  assert.equal(banco.historico.length, 0)
  assert.equal((await enviar('/cortes/999/produto', {produto:'MANTA LISA',produto_anterior:'MANTA'}, 'PUT')).status, 404)
})

test('salvar o mesmo produto não cria histórico de correção', async () => {
  banco.corte.produto = 'MANTA'
  assert.equal((await enviar('/cortes/843/produto', {produto:' manta ',produto_anterior:'MANTA'}, 'PUT')).status, 200)
  assert.equal(banco.historico.length, 0)
  assert.equal(banco.gravacoes, 0)
})

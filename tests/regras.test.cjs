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

async function consultar(sql, valores = []) {
  const query = sql.replace(/\s+/g, ' ').trim()
  banco.consultas++

  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(query)) return { rows: [] }
  if (/SELECT numero, itens_finalizados FROM cortes/.test(query)) {
    return { rows: banco.corte && Number(valores[0]) === banco.corte.numero ? [banco.corte] : [] }
  }
  if (/SELECT status FROM producao/.test(query)) {
    return { rows: banco.producao.filter(p => p.numero_corte === Number(valores[0])).slice(-1) }
  }
  if (/SELECT COUNT\(\*\)/.test(query)) return { rows: [{ total: banco.itens_corte.length }] }
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
    registro.id = banco.producao.length + banco.itens_corte.length + 1
    // Mantém a primeira finalização em andamento enquanto a segunda requisição chega.
    await new Promise(resolve => setTimeout(resolve, 15))
    banco.gravacoes++
    if (tabela === 'cortes') banco.corte = registro
    else banco[tabela].push(registro)
    return { rows: [registro] }
  }

  if (/^UPDATE (producao|itens_corte) /.test(query)) {
    const tabela = query.match(/^UPDATE (\w+)/)[1]
    const registro = banco[tabela].find(item => String(item.id) === String(valores.at(-1)))
    if (!registro) return { rows: [] }
    for (const campo of query.matchAll(/(\w+)\s*=\s*\$(\d+)/g)) registro[campo[1]] = valores[Number(campo[2]) - 1]
    banco.gravacoes++
    return { rows: [registro] }
  }
  if (/^UPDATE cortes SET itens_finalizados/.test(query)) {
    banco.corte.itens_finalizados = query.includes('= 1') ? 1 : 0
    banco.gravacoes++
    return { rows: [banco.corte] }
  }
  throw new Error(`Consulta não suportada pelo banco de teste: ${query}`)
}

const pool = {
  query: consultar,
  async connect() {
    let liberar
    return {
      async query(sql, valores) {
        if (sql.includes('FOR UPDATE')) {
          const anterior = banco.fila
          banco.fila = new Promise(resolve => { liberar = resolve })
          await anterior
        }
        return consultar(sql, valores)
      },
      release() { liberar?.() }
    }
  }
}

const moduloBanco = require.resolve('../dist/database-pg')
require.cache[moduloBanco] = { id: moduloBanco, filename: moduloBanco, loaded: true, exports: { __esModule: true, default: pool } }
const app = express()
app.use(express.json())
for (const rota of ['producao', 'itens', 'cortes', 'consultas']) app.use(require(`../dist/routes/${rota}.routes`).default)

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
    producao: [], itens_corte: [], resumo: [],
    gravacoes: 0, consultas: 0, fila: Promise.resolve()
  }
})
after(() => new Promise(resolve => servidor.close(resolve)))

async function enviar(path, dados, method = 'POST') {
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

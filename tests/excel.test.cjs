const {test, before, beforeEach, after} = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const ExcelJS = require('exceljs')
const {gerarRelatorioExcel} = require('../dist/services/relatorio-excel')

// Somente dados fictícios: este arquivo não carrega .env nem conecta ao Supabase.
let chamadas, vazia, falhar, liberado
const cortes = [
  {numero:917,produto:'=PRODUTO ÁÇÕ',mesa:'MESA 1',data:'2026-10-16',status:'FINALIZADO',folha_parou:20,itens_finalizados:1},
  {numero:916,produto:'MANTA',mesa:'MESA 2',data:null,status:null,folha_parou:null,itens_finalizados:0}
]
const producao = [
  {id:1,numero_corte:917,data:'2026-10-15',turno:'2º TURNO',operador:'@OPERADOR',hora_inicio:'23:30:00',hora_fim:'01:00:00',folha_inicio:0,folha_parou:10,status:'EM PRODUÇÃO'},
  {id:2,numero_corte:917,data:'2026-10-16',turno:'1º TURNO',operador:'JOÃO',hora_inicio:'08:00:00',hora_fim:'08:30:00',folha_inicio:10,folha_parou:20,status:'FINALIZADO'}
]
const itens = [{id:1,numero_corte:917,modelo:'PI 001',cor:'BRANCO',tecido:'VOIL',metragem_usada:'12.50',sobra_metros:'0.25',perda_metros:'0.10',metros_faltantes:'0',quantidade_pecas:5}]
const pool = {
  async query(sql, params) {
    chamadas.push({sql, params})
    if (sql.startsWith('BEGIN') || ['COMMIT','ROLLBACK'].includes(sql)) return {rows:[]}
    if (sql.includes('FROM cortes c')) return {rows:vazia ? [] : cortes}
    if (falhar) throw new Error('Falha simulada na leitura')
    if (sql.includes('FROM producao WHERE')) return {rows:producao}
    if (sql.includes('FROM itens_corte WHERE')) return {rows:itens}
    throw new Error('Consulta inesperada no teste')
  },
  async connect() {return {query:this.query, release(){liberado++}}}
}
const moduloBanco = require.resolve('../dist/database-pg')
require.cache[moduloBanco] = {id:moduloBanco, filename:moduloBanco, loaded:true, exports:{__esModule:true, default:pool}}
const {montarConsultaCortes} = require('../dist/services/consulta-cortes')
const app = express()
app.use(require('../dist/routes/consultas.routes').default)
let servidor, url
before(async () => {
  servidor = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  url = `http://127.0.0.1:${servidor.address().port}`
})
beforeEach(() => {chamadas=[]; vazia=false; falhar=false; liberado=0})
after(() => new Promise(resolve => servidor.close(resolve)))

async function abrir(buffer) {const w=new ExcelJS.Workbook(); await w.xlsx.load(buffer); return w}

test('Excel preserva números, acentos e textos semelhantes a fórmulas nas três abas', async () => {
  const workbook = await abrir(await gerarRelatorioExcel({cortes,producao,itens}, {status:'FINALIZADO'}, new Date('2026-10-16T12:00:00Z')))
  assert.deepEqual(workbook.worksheets.map(s=>s.name), ['Cortes','Produção','PIs'])
  const resumo = workbook.getWorksheet('Cortes')
  assert.equal(resumo.getCell('B6').value, '=PRODUTO ÁÇÕ')
  assert.equal(resumo.getCell('B6').type, ExcelJS.ValueType.String)
  assert.equal(resumo.getCell('A6').value, 917)
  assert.equal(resumo.getCell('D6').value.toISOString(), '2026-10-16T00:00:00.000Z')
  assert.equal(resumo.getCell('G6').value, 20)
  // ExcelJS relê células com formato de duração como Date; no XLSX são frações de dia.
  assert.equal(resumo.getCell('H6').value.toISOString(), '1899-12-30T02:00:00.000Z')
  assert.equal(resumo.getCell('H6').numFmt, '[h]:mm')
  assert.equal(resumo.getCell('I6').value, 5)
  assert.equal(resumo.getCell('J6').value, 12.5)
  assert.equal(resumo.getCell('K6').value, 0.25)
  assert.equal(resumo.getCell('L6').value, 0.1)
  assert.equal(resumo.getCell('N6').value, 'Sim')
  assert.equal(resumo.getCell('D7').value, null)
  assert.equal(resumo.getCell('E7').value, 'SEM LANÇAMENTO')
  assert.equal(resumo.getCell('F7').value, null)
  assert.equal(workbook.getWorksheet('Produção').getCell('E6').value, '@OPERADOR')
  assert.equal(workbook.getWorksheet('PIs').getCell('F6').value, 12.5)
  assert.equal(resumo.views[0].ySplit, 5)
  assert.match(resumo.getCell('A2').value, /09:00:00.*Status: FINALIZADO/)
  assert.match(resumo.getCell('A3').value, /histórico completo/)
})

test('exporta mais de 20 cortes, sem depender da paginação visual', async () => {
  const muitos = Array.from({length:45},(_,i)=>({...cortes[1],numero:900-i}))
  const workbook = await abrir(await gerarRelatorioExcel({cortes:muitos,producao:[],itens:[]}, {}))
  assert.equal(workbook.getWorksheet('Cortes').rowCount, 50)
  assert.equal(workbook.getWorksheet('Cortes').getCell('A50').value, 856)
  assert.equal(workbook.getWorksheet('PIs').rowCount, 5)
})

test('consulta e exportação usam os mesmos filtros parametrizados, incluindo período e status', async () => {
  const filtros = {numero:'917',produto:"MANTA' OR 1=1 --",data_inicial:'2026-10-14',data_final:'2026-10-16',status:'FINALIZADO'}
  const query = new URLSearchParams(filtros)
  assert.equal((await fetch(`${url}/consultar-cortes?${query}`)).status, 200)
  const consulta = chamadas[0]
  const resposta = await fetch(`${url}/consultar-cortes/exportar?${query}`)
  assert.equal(resposta.status, 200)
  assert.match(resposta.headers.get('content-type'), /spreadsheetml.sheet/)
  assert.match(resposta.headers.get('content-disposition'), /relatorio-cortes-.*\.xlsx/)
  assert.equal(resposta.headers.get('cache-control'), 'no-store')
  const exportacao = chamadas.find((c,i)=>i>0 && c.sql.includes('FROM cortes c'))
  assert.deepEqual(exportacao, consulta)
  assert.ok(!consulta.sql.includes(filtros.produto))
  assert.deepEqual(consulta.params, ['917',`%${filtros.produto}%`,'2026-10-14','2026-10-16','FINALIZADO'])
  assert.match(chamadas[1].sql, /REPEATABLE READ READ ONLY/)
  assert.deepEqual(chamadas.find(c=>c.sql.includes('ANY')).params, [[917,916]])
  assert.equal(chamadas.at(-1).sql, 'COMMIT')
  assert.equal(liberado, 1)
  assert.equal((await abrir(Buffer.from(await resposta.arrayBuffer()))).worksheets.length, 3)
})

test('datas inválidas, status e filtros repetidos retornam 400 antes de consultar o banco', async () => {
  for (const query of ['numero=-1','numero=1.5','data_inicial=2026-02-30','data_final=x','data_inicial=2026-10-16&data_final=2026-10-14','status=OUTRO','produto=x&produto=y']) {
    for (const rota of ['consultar-cortes','consultar-cortes/exportar']) {
      assert.equal((await fetch(`${url}/${rota}?${query}`)).status, 400, query)
    }
  }
  assert.equal(chamadas.length, 0)
  assert.throws(()=>montarConsultaCortes({status:['FINALIZADO']}), /filtros válidos/)
})

test('consulta vazia ou falha de leitura não baixa um Excel incompleto e libera a conexão', async () => {
  vazia = true
  let resposta = await fetch(`${url}/consultar-cortes/exportar`)
  assert.equal(resposta.status, 404)
  assert.match((await resposta.json()).erro, /Nenhum corte/)
  assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  assert.equal(liberado, 1)
  vazia = false; falhar = true
  resposta = await fetch(`${url}/consultar-cortes/exportar`)
  assert.equal(resposta.status, 500)
  assert.match(resposta.headers.get('content-type'), /json/)
  assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  assert.equal(liberado, 2)
})

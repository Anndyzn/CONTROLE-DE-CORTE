const {test, before, after, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const ExcelJS = require('exceljs')

// Banco simulado: nenhum acesso ao ERP ou ao PostgreSQL da empresa.
let regras, corte, itens, consultas, falhar, liberado
const pool = {
  async query(sql, valores = []) {
    const q = sql.replace(/\s+/g, ' ').trim()
    consultas.push({q, valores})
    if (falhar && q.startsWith('SELECT')) throw new Error('Falha simulada')
    if (/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|SELECT pg_advisory)/.test(q)) return {rows:[]}
    if (q.includes('SELECT c.numero, c.produto FROM cortes')) return {rows: corte ? [{numero:corte.numero, produto:corte.produto}] : []}
    if (q.includes('FROM cortes c WHERE')) return {rows:corte ? [structuredClone(corte)] : []}
    if (q.startsWith('SELECT id, modelo')) return {rows:structuredClone(itens)}
    if (q.startsWith('SELECT modelo, tecido')) return {rows:structuredClone([...regras.values()])}
    if (/^(INSERT|UPDATE)/.test(q)) {
      const [modelo, tecido, cor, destinos, versao] = valores
      const chave = JSON.stringify([modelo, tecido, cor]), anterior = regras.get(chave)
      if (q.startsWith('INSERT') ? !!anterior : !anterior || anterior.versao !== versao) return {rows:[]}
      const regra = {modelo, tecido, cor, destinos:JSON.parse(destinos), versao:(anterior?.versao ?? 0)+1}
      regras.set(chave, regra)
      return {rows:[{versao:regra.versao}]}
    }
    throw new Error(`Consulta não simulada: ${q}`)
  },
  async connect() { return {query:(...args)=>pool.query(...args),release(){liberado++}} }
}
const caminho = require.resolve('../dist/database-pg')
require.cache[caminho] = {id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:pool}}
const {validarCorrespondencia, montarConferencia, prepararCorrespondenciasSankhya} = require('../dist/services/sankhya-preparacao')
const app = express(); app.use(express.json()); app.use(require('../dist/routes/sankhya.routes').default)
let servidor, base
before(async()=>{
  servidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  base=`http://127.0.0.1:${servidor.address().port}`
})
after(()=>new Promise(resolve=>servidor.close(resolve)))
const destino = (codigo, produto) => ({codigo_produto:codigo, produto, controle:'BRANCO'})
const regra = () => ({modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'BRANCO',versao:0,
  destinos:[destino(6073,'PI CORTE BLAZER CONJUNTO FEMININO'),destino(6069,'PI CORTE VESTIDO CONJUNTO FEMININO')]})
beforeEach(()=>{
  regras=new Map(); consultas=[];falhar=false;liberado=0
  corte={numero:922,produto:'CONJUNTO FEMININO',itens_finalizados:1,status:'FINALIZADO'}
  itens=[{id:1,modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'BRANCO',quantidade_pecas:216,metragem_usada:'481.68'}]
})
async function salvar(body) {
  const resposta=await fetch(base+'/sankhya/correspondencias',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  return {status:resposta.status,body:await resposta.json()}
}
test('conjunto gera uma OP por produto com quantidade integral; metragem permanece somente na origem',()=>{
  const original=structuredClone(itens)
  const resultado=montarConferencia(itens,[validarCorrespondencia(regra())])
  assert.deepEqual(resultado[0].ordens.map(o=>[o.codigo_produto,o.quantidade]),[[6073,216],[6069,216]])
  assert.equal(resultado[0].metragem_usada,'481.68')
  assert.ok(resultado[0].ordens.every(o=>!('metragem_usada' in o)))
  assert.deepEqual(itens,original)
})
test('reutiliza grafias normalizadas, mas exige correspondência exata de tecido e cor',()=>{
  const r=validarCorrespondencia({...regra(),modelo:' conjunto   feminino '})
  const linhas=[itens[0],{...itens[0],id:2,cor:'VERDE CLARO'},{...itens[0],id:3,tecido:'CETIM'}]
  const resultado=montarConferencia(linhas,[r])
  assert.equal(resultado[0].ordens.length,2)
  assert.equal(resultado[1].ordens.length,0)
  assert.equal(resultado[2].ordens.length,0)
  assert.equal(resultado[1].pendencias.length,1)
})
test('itens repetidos conservam identidade; quantidade zero ou fracionada bloqueia a preparação',()=>{
  const resultado=montarConferencia([itens[0],{...itens[0],id:2},{...itens[0],id:3,quantidade_pecas:0},{...itens[0],id:4,quantidade_pecas:1.5}],[validarCorrespondencia(regra())])
  assert.deepEqual(resultado.map(i=>i.ordens.length),[2,2,0,0])
  assert.deepEqual(resultado.map(i=>i.id),[1,2,3,4])
})
test('valida limites, códigos, campos, duplicatas e versão antes de gravar',async()=>{
  for(const alteracao of [
    {modelo:''},{cor:['BRANCO']},{tecido:'X'.repeat(201)},{versao:-1},{versao:'0'},
    {destinos:[]},{destinos:Array(11).fill(destino(1,'X'))},
    {destinos:[destino(1,'X'),destino(1,'X')]},
    {destinos:[destino('6073','X')]},{destinos:[destino(1.5,'X')]},
    {destinos:[destino(2147483648,'X')]},{destinos:[{...destino(1,'X'),controle:''}]},
    {destinos:[destino(1,'')]},{destinos:[null]}
  ]) assert.equal((await salvar({...regra(),...alteracao})).status,400)
  assert.equal(consultas.length,0)
})
test('salva e reutiliza um para muitos; criação concorrente e edição desatualizada são recusadas',async()=>{
  assert.equal((await salvar(regra())).body.versao,1)
  assert.equal((await salvar(regra())).status,409)
  assert.equal((await salvar({...regra(),versao:1,destinos:[destino(6073,'BLAZER')]})).body.versao,2)
  assert.equal((await salvar({...regra(),versao:1})).status,409)
  const resposta=await fetch(base+'/sankhya/cortes/922/conferencia')
  const dados=await resposta.json()
  assert.equal(dados.total_ops,1)
  assert.equal(dados.envio_disponivel,false)
  assert.equal(dados.completa,true)
  assert.equal(liberado,1)
  assert.ok(consultas.some(c=>c.q==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'))
  assert.ok(consultas.filter(c=>/^(INSERT|UPDATE)/.test(c.q)).every(c=>c.q.includes('sankhya_correspondencias')))
})
test('conferência sem correspondência informa pendência e nunca simula OP criada',async()=>{
  const dados=await (await fetch(base+'/sankhya/cortes/922/conferencia')).json()
  assert.equal(dados.completa,false);assert.equal(dados.total_ops,0)
  assert.equal(dados.itens[0].correspondencia,null)
  assert.equal(dados.envio_disponivel,false)
  assert.ok(!consultas.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.q)))
})
test('recusa corte inexistente, em andamento, PIs abertos e corte sem itens',async()=>{
  corte=null
  assert.equal((await fetch(base+'/sankhya/cortes/922/conferencia')).status,404)
  corte={numero:922,status:'EM PRODUÇÃO',itens_finalizados:1}
  assert.equal((await fetch(base+'/sankhya/cortes/922/conferencia')).status,409)
  corte.status='FINALIZADO';corte.itens_finalizados=0
  assert.equal((await fetch(base+'/sankhya/cortes/922/conferencia')).status,409)
  corte.itens_finalizados=1;itens=[]
  assert.equal((await fetch(base+'/sankhya/cortes/922/conferencia')).status,409)
  assert.equal(liberado,4)
  assert.equal(consultas.filter(c=>c.q==='ROLLBACK').length,4)
})
test('busca inválida não consulta banco; falha de leitura libera transação e não expõe detalhes',async()=>{
  assert.equal((await fetch(base+'/sankhya/cortes/0/conferencia')).status,400)
  assert.equal(consultas.length,0)
  falhar=true
  const resposta=await fetch(base+'/sankhya/cortes/922/conferencia')
  assert.equal(resposta.status,500)
  assert.doesNotMatch((await resposta.json()).erro,/simulada/)
  assert.equal(liberado,1)
  assert.equal(consultas.at(-1).q,'ROLLBACK')
})
test('lista cortes para conferência sem classificá-los como pendentes no ERP',async()=>{
  const dados=await (await fetch(base+'/sankhya/cortes')).json()
  assert.deepEqual(dados,[{numero:922,produto:'CONJUNTO FEMININO'}])
  assert.match(consultas[0].q,/c.itens_finalizados = 1 AND p.status = 'FINALIZADO'/)
  assert.match(consultas[0].q,/LIMIT 50/)
})
test('preparação da estrutura cria somente tabela de correspondências com RLS, em transação',async()=>{
  await prepararCorrespondenciasSankhya()
  assert.equal(consultas[0].q,'BEGIN')
  assert.ok(consultas.some(c=>c.q.startsWith('CREATE TABLE IF NOT EXISTS sankhya_correspondencias')))
  assert.ok(consultas.some(c=>c.q==='ALTER TABLE sankhya_correspondencias ENABLE ROW LEVEL SECURITY'))
  assert.equal(consultas.at(-1).q,'COMMIT'); assert.equal(liberado,1)
})

test('guia Excel gera uma linha por OP e mantém a metragem uma única vez por item',async()=>{
  await salvar(regra());consultas=[]
  const antes=structuredClone(itens)
  const resposta=await fetch(base+'/sankhya/cortes/922/excel')
  assert.equal(resposta.status,200)
  assert.match(resposta.headers.get('content-type'),/spreadsheetml/)
  assert.match(resposta.headers.get('content-disposition'),/guia-sankhya-corte-922.xlsx/)
  assert.equal(resposta.headers.get('cache-control'),'no-store')
  const livro=new ExcelJS.Workbook();await livro.xlsx.load(Buffer.from(await resposta.arrayBuffer()))
  assert.deepEqual(livro.worksheets.map(a=>a.name),['OPs para lançar','Consumo por item','Como usar'])
  const ops=livro.getWorksheet('OPs para lançar'),consumo=livro.getWorksheet('Consumo por item')
  assert.equal(ops.rowCount,7)
  assert.equal(ops.getCell('E6').value,6073);assert.equal(ops.getCell('E7').value,6069)
  assert.equal(ops.getCell('H6').value,216);assert.equal(ops.getCell('H7').value,216)
  assert.equal(ops.getCell('I6').value,null)
  assert.ok(!ops.getRow(5).values.some(v=>String(v).includes('Metragem')))
  assert.equal(consumo.rowCount,6);assert.equal(consumo.getCell('F6').value,481.68)
  assert.equal(consumo.getCell('G6').value,216)
  assert.match(ops.getCell('A2').value,/Não é um arquivo de importação/)
  assert.equal(ops.views[0].ySplit,5)
  assert.deepEqual(itens,antes)
  assert.ok(!consultas.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.q)))
})

test('guia recusa correspondência incompleta, quantidade zero, PIs abertos e corte inválido',async()=>{
  for(const codigo of [0,'abc'])assert.equal((await fetch(base+`/sankhya/cortes/${codigo}/excel`)).status,400)
  let resposta=await fetch(base+'/sankhya/cortes/922/excel')
  assert.equal(resposta.status,409);assert.match((await resposta.json()).erro,/Complete as correspondências/)
  await salvar(regra());itens[0].quantidade_pecas=0
  assert.equal((await fetch(base+'/sankhya/cortes/922/excel')).status,409)
  itens[0].quantidade_pecas=216;corte.itens_finalizados=0
  assert.equal((await fetch(base+'/sankhya/cortes/922/excel')).status,409)
  corte=null
  assert.equal((await fetch(base+'/sankhya/cortes/922/excel')).status,404)
})

test('guia usa os dados atuais e preserva textos que parecem fórmulas como texto',async()=>{
  const r=regra();r.destinos[0].produto='=1+1'
  await salvar(r)
  await fetch(base+'/sankhya/cortes/922/conferencia')
  itens[0].quantidade_pecas=100;itens[0].modelo='CONJUNTO FEMININO'
  const resposta=await fetch(base+'/sankhya/cortes/922/excel')
  const livro=new ExcelJS.Workbook();await livro.xlsx.load(Buffer.from(await resposta.arrayBuffer()))
  const ops=livro.getWorksheet('OPs para lançar')
  assert.equal(ops.getCell('H6').value,100)
  assert.equal(ops.getCell('F6').value,'=1+1');assert.equal(ops.getCell('F6').type,ExcelJS.ValueType.String)
  assert.equal(ops.getCell('F6').formula,undefined)
})

const {test,before,after,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
let consultas,regra,liberado
const db={async query(sql,valores=[]){
  consultas.push({sql,valores})
  if(sql.startsWith('WITH nomes')) return {rows:[{nome:'EDREDON LISO INFERIOR',cortes:3,opcoes:regra?.opcoes??[],versao:regra?.versao??0}]}
  if(sql.startsWith('INSERT INTO sankhya_nomes')||sql.startsWith('UPDATE sankhya_nomes')){
    if(regra ? valores[2]!==regra.versao : sql.startsWith('UPDATE')) return {rows:[]}
    regra={opcoes:JSON.parse(valores[1]),versao:(regra?.versao??0)+1};return {rows:[{versao:regra.versao}]}
  }
  if(/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory|CREATE TABLE|ALTER TABLE)/.test(sql))return {rows:[]}
  throw Error('SQL inesperado')
},async connect(){return {query:(...a)=>db.query(...a),release(){liberado++}}}}
const caminho=require.resolve('../dist/database-pg')
require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:db}}
const {validarOpcoesNome,prepararNomesSankhya}=require('../dist/services/sankhya-nomes')
const app=express();app.use(express.json());app.use(require('../dist/routes/sankhya-nomes.routes').default)
let server,base
before(async()=>{server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});base=`http://127.0.0.1:${server.address().port}`})
after(()=>new Promise(r=>server.close(r)))
beforeEach(()=>{consultas=[];regra=null;liberado=0})
const corpo=()=>({nome:' edredon   liso inferior ',versao:0,opcoes:[{codigos:[6086]}]})
test('opções são alternativas canônicas, sem controles; conjunto preserva componentes juntos',()=>{
  const v=validarOpcoesNome({...corpo(),opcoes:[{codigos:[6086],rotulo:'nome adulterado'},{codigos:[6073,6069]}]})
  assert.equal(v.nome,'EDREDON LISO INFERIOR');assert.match(v.opcoes[0].rotulo,/6086 — PI CORTE EDREDON INF/)
  assert.deepEqual(v.opcoes[1].codigos,[6073,6069]);assert.equal('controle' in v.opcoes[0],false)
  for(const opcoes of [[{codigos:[999999]}],[{codigos:[6086,6086]}],[{codigos:[6073,6069]},{codigos:[6069,6073]}],[{codigos:[]}],Array(31).fill({codigos:[6086]})])assert.throws(()=>validarOpcoesNome({...corpo(),opcoes}))
  assert.deepEqual(validarOpcoesNome({...corpo(),opcoes:[]}).opcoes,[])
})
test('lista nomes existentes e salva opções separadamente, com controle de concorrência',async()=>{
  const lista=await fetch(base+'/sankhya/nomenclaturas?nome=EDREDON%20LISO%20INFERIOR')
  assert.equal(lista.status,200);assert.equal((await lista.json()).nomes[0].nome,'EDREDON LISO INFERIOR')
  const put=body=>fetch(base+'/sankhya/nomenclaturas',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  assert.equal((await put(corpo())).status,200)
  assert.equal((await put(corpo())).status,409)
  assert.equal((await put({...corpo(),versao:1,opcoes:[]})).status,200)
  assert.ok(!consultas.some(c=>/UPDATE (cortes|itens_corte|sankhya_correspondencias)|DELETE FROM/.test(c.sql)))
  assert.equal((await fetch(base+'/sankhya/nomenclaturas?nome='+('x'.repeat(201)))).status,400)
})
test('estrutura própria usa transação, bloqueio e RLS, sem alterar cortes',async()=>{
  await prepararNomesSankhya()
  assert.equal(consultas[0].sql,'BEGIN');assert.match(consultas[2].sql,/CREATE TABLE IF NOT EXISTS sankhya_nomes/)
  assert.match(consultas[3].sql,/ENABLE ROW LEVEL SECURITY/);assert.equal(consultas.at(-1).sql,'COMMIT');assert.equal(liberado,1)
})

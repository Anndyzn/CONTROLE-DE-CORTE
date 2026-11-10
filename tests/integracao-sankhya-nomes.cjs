// Valida os SQLs reais no PostgreSQL usando somente EXPLAIN, sem ANALYZE ou gravações.
require('dotenv/config')
const assert=require('node:assert/strict')
const {Pool}=require('pg')
const express=require('express')
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}})
let cliente,servidor,planos=0
const caminho=require.resolve('../dist/database-pg')
const item={id:1,modelo:'CONJUNTO',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:100,metragem_usada:200}
const simulado={async query(sql,valores){
  if(/^(BEGIN|COMMIT|ROLLBACK)/.test(sql))return {rows:[]}
  await cliente.query('EXPLAIN '+sql,valores)
  planos++
  if(sql.startsWith('SELECT id,'))return {rows:[item]}
  if(sql.startsWith('SELECT i.id'))return {rows:[]}
  return {rows:[{versao:1}]}
},async connect(){return {query:(...a)=>simulado.query(...a),release(){}}}}
require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:simulado}}
async function executar(){
  try{
    cliente=await pool.connect()
    await cliente.query('BEGIN READ ONLY')
    const app=express();app.use(express.json());app.use(require('../dist/routes/sankhya-nomes.routes').default)
    servidor=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))})
    const url=`http://127.0.0.1:${servidor.address().port}/sankhya/nomenclaturas`
    for(const versao of [0,1]){
      const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:'EDREDON LISO INFERIOR',versao,opcoes:[{codigos:[6086]}]})})
      assert.equal(r.status,200)
    }
    assert.equal((await fetch(url+'?nome=EDREDON%20LISO%20INFERIOR')).status,200)
    assert.equal(planos,3)
    const {default:rotas,assinaturaItem}=require('../dist/routes/sankhya-lancamentos.routes')
    app.use(rotas)
    const lancamento=`http://127.0.0.1:${servidor.address().port}/sankhya/itens/1/lancamento`
    for(const versao of [0,1]){
      const r=await fetch(lancamento,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigos:[6073,6069],lancados:[6073],assinatura:assinaturaItem(item),versao})})
      assert.equal(r.status,200)
    }
    assert.equal((await fetch(`http://127.0.0.1:${servidor.address().port}/sankhya/cortes/932/lancamentos`)).status,200)
    assert.equal(planos,8)
    console.log('Inserção, atualização e listagem validadas no PostgreSQL com EXPLAIN; nenhum dado alterado.')
  }finally{
    if(servidor)await new Promise(r=>servidor.close(r))
    if(cliente){await cliente.query('ROLLBACK');cliente.release()}
    await pool.end()
  }
}
executar().catch(erro=>{console.error('Falha na validação SQL:',erro.message);process.exitCode=1})

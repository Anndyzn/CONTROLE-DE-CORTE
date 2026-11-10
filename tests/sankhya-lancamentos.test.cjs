const {test,before,after,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
let registro,consultas,item
const db={async query(sql,v=[]){
 consultas.push(sql)
 if(sql.startsWith('SELECT i.id'))return {rows:[{...item,codigos:registro?.codigos,lancados:registro?.lancados,anterior:registro?.assinatura,versao:registro?.versao??0}]}
 if(sql.startsWith('SELECT id,'))return {rows:item?[item]:[]}
 if(sql.startsWith('INSERT INTO sankhya_lancamentos')||sql.startsWith('UPDATE sankhya_lancamentos')){
  if(registro ? v[4]!==registro.versao : sql.startsWith('UPDATE'))return {rows:[]}
  registro={codigos:JSON.parse(v[1]),lancados:JSON.parse(v[2]),assinatura:v[3],versao:(registro?.versao??0)+1};return {rows:[{versao:registro.versao}]}
 }
 if(/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory|CREATE TABLE|ALTER TABLE)/.test(sql))return {rows:[]}
 throw Error('SQL inesperado')
},async connect(){return {query:(...a)=>db.query(...a),release(){}}}}
const caminho=require.resolve('../dist/database-pg');require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:db}}
const {default:rotas,assinaturaItem,prepararLancamentosSankhya}=require('../dist/routes/sankhya-lancamentos.routes')
const app=express();app.use(express.json());app.use(rotas)
let server,base
before(async()=>{server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});base=`http://127.0.0.1:${server.address().port}`})
after(()=>new Promise(r=>server.close(r)))
beforeEach(()=>{registro=null;consultas=[];item={id:1,modelo:'CONJUNTO',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:100,metragem_usada:200}})
const corpo=()=>({codigos:[6073,6069],lancados:[6073],versao:0,assinatura:assinaturaItem(item)})
const salvar=b=>fetch(base+'/sankhya/itens/1/lancamento',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})
test('salva dois produtos, confirma somente um e permite desmarcar preservando seleção',async()=>{
 assert.equal((await salvar(corpo())).status,200)
 let r=await (await fetch(base+'/sankhya/cortes/932/lancamentos')).json()
 assert.deepEqual(r.itens[0].codigos,[6073,6069]);assert.deepEqual(r.itens[0].lancados,[6073])
 assert.equal((await salvar({...corpo(),versao:1,lancados:[]})).status,200)
 assert.equal((await salvar(corpo())).status,409)
 assert.ok(consultas.includes('ROLLBACK'))
 assert.ok(!consultas.some(q=>/UPDATE (itens_corte|cortes)|DELETE FROM/.test(q)))
})
test('mudança de produção invalida marcação antiga e bloqueia gravação desatualizada',async()=>{
 const antigo=corpo();await salvar(antigo);item.quantidade_pecas=200
 const r=await (await fetch(base+'/sankhya/cortes/932/lancamentos')).json()
 assert.equal(r.itens[0].revisar,true);assert.equal(r.itens[0].codigos,null);assert.deepEqual(r.itens[0].lancados,[])
 assert.equal((await salvar({...antigo,versao:1})).status,409)
 assert.equal((await salvar({...corpo(),versao:1,lancados:[]})).status,200)
})
test('valida seleção, marcação e versão antes de consultar o banco',async()=>{
 for(const v of [{codigos:[6073,6073]},{lancados:[6086]},{codigos:[999999]},{versao:-1},{assinatura:'invalida'},{lancados:'sim'}])assert.equal((await salvar({...corpo(),...v})).status,400)
 assert.equal(consultas.length,0)
})
test('cria estrutura separada com RLS, vínculo ao PI e exclusão em cascata',async()=>{
 await prepararLancamentosSankhya()
 assert.match(consultas[2],/REFERENCES itens_corte\(id\) ON DELETE CASCADE/)
 assert.match(consultas[3],/ENABLE ROW LEVEL SECURITY/)
 assert.equal(consultas.at(-1),'COMMIT')
})

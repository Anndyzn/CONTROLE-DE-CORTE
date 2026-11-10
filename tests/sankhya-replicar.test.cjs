const {test,before,after,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
let itens,estados,snapshot,falhar
const db={async query(q,v=[]){
 if(q==='BEGIN'){snapshot=structuredClone(estados);return {rows:[]}}
 if(q==='ROLLBACK'){estados=snapshot;return {rows:[]}}
 if(q==='COMMIT')return {rows:[]}
 if(q.startsWith('SELECT numero_corte'))return {rows:itens.some(i=>i.id===v[0])?[{numero_corte:946}]:[]}
 if(q.startsWith('SELECT i.*'))return {rows:structuredClone(itens)}
 if(q.startsWith('SELECT item_id,versao'))return {rows:structuredClone([...estados.values()])}
 if(q.startsWith('SELECT modelo,tecido,cor'))return {rows:[{modelo:'CONJUNTO',tecido:'OXFORD',cor:'VERDE'}]}
 if(q.startsWith('INSERT INTO sankhya_lancamentos')){
  if(falhar===v[0])throw Error('Falha simulada')
  if(estados.has(v[0]))return {rows:[]}
  estados.set(v[0],{item_id:v[0],codigos:JSON.parse(v[1]),lancados:[],assinatura:v[2],versao:1});return {rows:[{item_id:v[0]}]}
 }
 throw Error('SQL não simulado')
},async connect(){return {query:(...a)=>db.query(...a),release(){}}}}
const caminho=require.resolve('../dist/database-pg');require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:db}}
const {default:rotas,assinaturaItem}=require('../dist/routes/sankhya-lancamentos.routes')
const app=express();app.use(express.json());app.use(rotas);let server,base
before(async()=>{server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});base=`http://127.0.0.1:${server.address().port}`})
after(()=>new Promise(r=>server.close(r)))
beforeEach(()=>{
 const origem={id:1,numero_corte:946,modelo:'CONJUNTO',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:100,metragem_usada:200}
 itens=[origem,{...origem,id:2,cor:'BEGE',quantidade_pecas:50},{...origem,id:3,cor:'ROSA'},{...origem,id:4,cor:'VERDE'},{...origem,id:5,cor:'AZUL',tecido:'CETIM'},{...origem,id:6,cor:'AZUL',modelo:'OUTRO'},{...origem,id:7}]
 estados=new Map([[1,{item_id:1,versao:1,codigos:[6073,6069],lancados:[6073]}],[3,{item_id:3,versao:2,codigos:[6073],lancados:[6073]}]])
 falhar=null
})
const corpo=()=>({versao:1,assinatura:assinaturaItem(itens[0]),codigos:[6073,6069]})
const enviar=b=>fetch(base+'/sankhya/itens/1/replicar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})
test('replica dois produtos para outra cor igual, preservando escolhas existentes e sem copiar lançados ou produção',async()=>{
 const antes=structuredClone(itens),antigos=structuredClone(estados)
 const r=await enviar(corpo());assert.equal(r.status,200);assert.deepEqual(await r.json(),{aplicados:1,preservados:2})
 assert.deepEqual(estados.get(2).codigos,[6073,6069]);assert.deepEqual(estados.get(2).lancados,[])
 assert.equal(estados.get(2).assinatura,assinaturaItem(itens[1]))
 assert.deepEqual(estados.get(3),antigos.get(3));assert.deepEqual(estados.get(1),antigos.get(1));assert.deepEqual(itens,antes)
 assert.equal(estados.has(5),false);assert.equal(estados.has(6),false);assert.equal(estados.has(7),false)
})
test('recusa origem desatualizada e desfaz a replicação inteira se uma gravação falhar',async()=>{
 assert.equal((await enviar({...corpo(),versao:0})).status,409);assert.equal(estados.has(2),false)
 itens.push({...itens[0],id:8,cor:'AZUL'});falhar=8
 assert.equal((await enviar(corpo())).status,500);assert.equal(estados.has(2),false);assert.equal(estados.has(8),false)
})

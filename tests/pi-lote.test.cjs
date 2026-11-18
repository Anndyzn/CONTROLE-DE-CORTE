const {test,before,beforeEach,after}=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
let state,backup,server,base
const pool={async connect(){return {release(){},async query(sql,args=[]){
 const q=sql.replace(/\s+/g,' ').trim()
 if(q.startsWith('BEGIN')){backup=structuredClone(state.rows);return {rows:[]}}
 if(q==='ROLLBACK'){state.rows=backup;return {rows:[]}}
 if(q==='COMMIT')return {rows:[]}
 if(q.includes('FROM cortes WHERE numero'))return {rows:args[0]===950?[{numero:950,itens_finalizados:state.confirmed,mesa:'MESA 1'}]:[]}
 if(q.startsWith('INSERT INTO itens_corte')){
  if(state.fail && state.rows.length===1)throw Error('simulated write failure')
  const item={id:state.rows.length+1,numero_corte:args[0],modelo:args[1],cor:args[2],quantidade_pecas:args[8]};state.rows.push(item);return {rows:[item]}
 }
 throw Error('unexpected query')
}}}}
const path=require.resolve('../dist/database-pg');require.cache[path]={id:path,filename:path,loaded:true,exports:{__esModule:true,default:pool}}
before(async()=>{const app=express();app.use(express.json());app.use(require('../dist/routes/itens.routes').default);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});base=`http://127.0.0.1:${server.address().port}`})
after(()=>new Promise(r=>server.close(r)))
beforeEach(()=>state={rows:[],confirmed:0,fail:false})
const item=cor=>({modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor,metragem_usada:12,sobra_metros:0,perda_metros:0,metros_faltantes:0,quantidade_pecas:22})
const send=(itens,numero_corte=950)=>fetch(base+'/itens-corte/lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numero_corte,itens})})
test('saves every color in one transaction, retaining the chosen cut and quantities',async()=>{
 const r=await send([item('BRANCO'),item('BEGE')]);assert.equal(r.status,201);assert.equal((await r.json()).itens.length,2)
 assert.deepEqual(state.rows.map(i=>[i.numero_corte,i.cor,i.quantidade_pecas]),[[950,'BRANCO',22],[950,'BEGE',22]])
})
test('invalid later row prevents any item from being written',async()=>{
 const r=await send([item('BRANCO'),{...item('BEGE'),metragem_usada:-1}]);assert.equal(r.status,400);assert.equal(state.rows.length,0)
})
test('confirmed or unknown cuts cannot receive colors',async()=>{
 state.confirmed=1;assert.equal((await send([item('BRANCO')])).status,409);assert.equal(state.rows.length,0)
 assert.equal((await send([item('BRANCO')],999)).status,404)
})
test('write failure rolls back colors already inserted in this batch',async()=>{
 state.fail=true;assert.equal((await send([item('BRANCO'),item('BEGE')])).status,500);assert.deepEqual(state.rows,[])
})

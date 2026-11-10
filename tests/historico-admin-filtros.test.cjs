const {test,before,after}=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
let consultas=[]
const caminho=require.resolve('../dist/database-pg')
require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:{async query(sql,valores){consultas.push({sql,valores});return {rows:[]}}}}}
const app=express();app.use(require('../dist/routes/historico-admin.routes').default)
let server,base
before(async()=>{server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});base=`http://127.0.0.1:${server.address().port}/historico-admin`})
after(()=>new Promise(r=>server.close(r)))
test('busca cobre nomes antes e depois; período usa Brasília e paginação preserva parâmetros',async()=>{
 const r=await fetch(base+'?numero=932&antes=90&acao=NOMENCLATURAS&busca=V%C3%89U&inicio=2026-11-01&fim=2026-11-10')
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store')
 const q=consultas.at(-1)
 assert.deepEqual(q.valores,[932,'90',['PADRONIZACAO_PRODUTO','PADRONIZACAO_MODELO','EDICAO_PRODUTO'],'%VEU%','2026-11-01','2026-11-10'])
 assert.match(q.sql,/antes::text, depois::text/);assert.match(q.sql,/America\/Sao_Paulo/);assert.match(q.sql,/\$6::date \+ 1/)
})
test('filtros inválidos são recusados sem consultar banco',async()=>{
 consultas=[]
 for(const filtro of ['acao=INVALIDA','busca=a&busca=b','inicio=2026-02-30','fim=0000-01-01','inicio=2026-11-10&fim=2026-11-01','busca='+('a'.repeat(201))])assert.equal((await fetch(base+'?'+filtro)).status,400,filtro)
 assert.equal(consultas.length,0)
})
test('busca é parâmetro e trata porcentagem e sublinhado como texto',async()=>{
 assert.equal((await fetch(base+'?busca='+encodeURIComponent("50%_'; DROP TABLE cortes;--"))).status,200)
 const q=consultas.at(-1)
 assert.ok(!q.sql.includes('DROP TABLE'));assert.match(q.valores[3],/50\\%\\_/)
})

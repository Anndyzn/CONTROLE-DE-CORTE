const {test,before,beforeEach,after} = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
let banco, consultas, liberar, falharAuditoria
const ordenarRegras = regras => [...regras].sort((a,b)=>JSON.stringify([a.modelo,a.tecido,a.cor]).localeCompare(JSON.stringify([b.modelo,b.tecido,b.cor])))
async function consulta(sql,valores=[]){
  const q=sql.replace(/\s+/g,' ').trim();consultas.push({q,valores})
  if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|LOCK TABLE)/.test(q)) return {rows:[]}
  if (q.startsWith('SELECT modelo, tecido')) return {rows:structuredClone(ordenarRegras(banco.regras))}
  if (q.startsWith('SELECT numero, produto')) return {rows:structuredClone(banco.cortes.filter(c=>valores[0].includes(c.produto)).sort((a,b)=>a.numero-b.numero).slice(0,2001).map(({numero,produto})=>({numero,produto})))}
  if (q.startsWith('SELECT id, numero_corte, modelo')) return {rows:structuredClone(banco.itens.filter(i=>valores[0].includes(i.modelo)).sort((a,b)=>a.id-b.id).slice(0,2001).map(({id,numero_corte,modelo})=>({id,numero_corte,modelo})))}
  if (q.includes('AS nome, COUNT(*)')){
    const cortes=q.includes('FROM cortes'),campo=cortes?'produto':'modelo',grupo=new Map()
    for(const r of cortes?banco.cortes:banco.itens){
      if(!r[campo].toUpperCase().includes(valores[0].slice(1,-1).toUpperCase()))continue
      const nome=r[campo],g=grupo.get(nome)??{nome,registros:0,numeros:new Set()}
      g.registros++;g.numeros.add(r.numero??r.numero_corte);grupo.set(nome,g)
    }
    return {rows:[...grupo.values()].map(({nome,registros,numeros})=>({nome,registros,cortes:numeros.size}))}
  }
  if(q.startsWith('INSERT INTO sankhya_correspondencias')){
    banco.regras.push({modelo:valores[0],tecido:valores[1],cor:valores[2],destinos:JSON.parse(valores[3]),versao:1});return {rows:[]}
  }
  if(q.startsWith('UPDATE cortes')){for(const c of banco.cortes)if(valores[1].includes(c.produto))c.produto=valores[0];return {rows:[]}}
  if(q.startsWith('UPDATE itens_corte')){for(const i of banco.itens)if(valores[1].includes(i.modelo))i.modelo=valores[0];return {rows:[]}}
  if(q.startsWith('INSERT INTO historico_admin')){
    if(falharAuditoria)throw new Error('Histórico indisponível')
    banco.historico.push({numero:valores[0],acao:valores[1],id:valores[2],responsavel:valores[3],motivo:valores[4],antes:JSON.parse(valores[5]),depois:JSON.parse(valores[6]),operacao_id:valores[7]});return {rows:[]}
  }
  throw new Error('Consulta não simulada: '+q)
}
const pool={query:consulta,async connect(){let snapshot;return {
  async query(sql,v){if(sql.startsWith('BEGIN'))snapshot=structuredClone(banco);if(sql==='ROLLBACK')banco=snapshot;return consulta(sql,v)},release(){liberar++}
}}}
const caminho=require.resolve('../dist/database-pg')
require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:pool}}
const {validarPadronizacao,planejarCorrespondencias}=require('../dist/services/padronizacao-nomes')
const app=express();app.use(express.json());app.use(require('../dist/routes/nomenclaturas.routes').default)
let servidor,url
before(async()=>{servidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});url=`http://127.0.0.1:${servidor.address().port}`})
after(()=>new Promise(resolve=>servidor.close(resolve)))
const destino={codigo_produto:6073,produto:'PI CORTE BLAZER',controle:'BRANCO'}
const regra=(modelo='CONJUNTO FEMINIA',cod=6073)=>({modelo,tecido:'OXFORD',cor:'BRANCO',destinos:[{...destino,codigo_produto:cod}],versao:2})
const pedido=(tipo='modelos')=>({tipo,origens:['CONJUNTO FEMINIA'],destino:' conjunto   feminino '})
beforeEach(()=>{
  consultas=[];liberar=0;falharAuditoria=false
  banco={cortes:[{numero:922,produto:'CONJUNTO FEMINIA',mesa:'MESA 1',itens_finalizados:1},{numero:923,produto:'CONJUNTO FEMININO',mesa:'MESA 2',itens_finalizados:0}],
    itens:[{id:1,numero_corte:922,modelo:'CONJUNTO FEMINIA',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:216,metragem_usada:481.68},{id:2,numero_corte:922,modelo:'CONJUNTO FEMINIA',cor:'AZUL',quantidade_pecas:150},{id:3,numero_corte:923,modelo:'CONJUNTO FEMININO',cor:'BRANCO',quantidade_pecas:100}],
    regras:[regra()],historico:[]}
})
async function post(rota,dados){const resposta=await fetch(url+rota,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});return {status:resposta.status,body:resposta.headers.get('content-type')?.includes('application/json')?await resposta.json():{erro:await resposta.text()}}}
const previa=(dados=pedido())=>post('/admin/nomenclaturas/previa',dados)
const aplicar=(token,dados=pedido())=>post('/admin/nomenclaturas/aplicar',{...dados,token,responsavel:'ANDY',motivo:'Padronizar grafias do mesmo produto'})

test('lista grafias com contagem de itens e cortes, mantendo nomes como dados',async()=>{
  const resposta=await fetch(url+'/admin/nomenclaturas?tipo=modelos&busca=FEMINIA')
  assert.equal(resposta.status,200)
  assert.deepEqual((await resposta.json()).nomes,[{nome:'CONJUNTO FEMINIA',registros:2,cortes:1}])
  assert.ok(consultas[0].valores[0].includes('FEMINIA'))
})
test('prévia não grava e identifica cada item, destino normalizado e correspondências a copiar',async()=>{
  const antes=structuredClone(banco)
  const p=await previa()
  assert.equal(p.status,200);assert.equal(p.body.total,2);assert.equal(p.body.cortes,1);assert.equal(p.body.correspondencias,1)
  assert.equal(p.body.destino,'CONJUNTO FEMININO')
  assert.deepEqual(p.body.registros.map(r=>r.id),[1,2])
  assert.match(p.body.token,/^[a-f0-9]{64}$/)
  assert.deepEqual(banco,antes)
  assert.ok(!consultas.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.q)))
})
test('aplica somente modelo, copia correspondência e audita cada item na mesma transação',async()=>{
  const antes=structuredClone(banco),p=await previa()
  const r=await aplicar(p.body.token)
  assert.equal(r.status,200);assert.equal(r.body.total,2)
  assert.equal(banco.itens[0].modelo,'CONJUNTO FEMININO')
  assert.equal(banco.itens[0].metragem_usada,481.68);assert.equal(banco.itens[0].quantidade_pecas,216)
  assert.deepEqual(banco.cortes,antes.cortes)
  assert.equal(banco.regras.length,2);assert.equal(banco.regras[0].modelo,'CONJUNTO FEMINIA')
  assert.equal(banco.regras[1].modelo,'CONJUNTO FEMININO')
  assert.equal(banco.historico.length,2);assert.equal(banco.historico[0].acao,'PADRONIZACAO_MODELO')
  assert.equal(banco.historico[0].antes.modelo,'CONJUNTO FEMINIA')
  assert.equal(banco.historico[0].depois.modelo,'CONJUNTO FEMININO')
  assert.equal(banco.historico[0].depois.correspondencias_sankhya.length,1)
  assert.match(banco.historico[0].operacao_id,/^[a-f0-9-]{36}$/)
  assert.equal(banco.historico[0].operacao_id,banco.historico[1].operacao_id)
  assert.ok(consultas.some(c=>c.q==='LOCK TABLE cortes, itens_corte, sankhya_correspondencias IN EXCLUSIVE MODE'))
  assert.equal(consultas.at(-1).q,'COMMIT');assert.equal(liberar,2)
})
test('padronizar nome do corte preserva modelos, mesa, finalização e correspondências',async()=>{
  const antes=structuredClone(banco),p=await previa(pedido('cortes'))
  assert.equal((await aplicar(p.body.token,pedido('cortes'))).status,200)
  assert.equal(banco.cortes[0].produto,'CONJUNTO FEMININO')
  assert.equal(banco.cortes[0].mesa,'MESA 1');assert.equal(banco.cortes[0].itens_finalizados,1)
  assert.deepEqual(banco.itens,antes.itens);assert.deepEqual(banco.regras,antes.regras)
  assert.equal(banco.historico[0].acao,'PADRONIZACAO_PRODUTO')
})
test('prévia fica inválida se mudar nome, seleção, destino, quantidade de registros ou versão de correspondência',async()=>{
  const original=structuredClone(banco)
  for(const mutar of [
    ()=>{banco.itens[0].modelo='OUTRO'},
    ()=>{banco.itens.push({...banco.itens[0],id:4})},
    ()=>{banco.regras[0].versao++}
  ]){
    banco=structuredClone(original);const p=await previa();mutar();const esperado=structuredClone(banco)
    assert.equal((await aplicar(p.body.token)).status,409)
    assert.deepEqual(banco,esperado)
  }
  banco=structuredClone(original);const p=await previa()
  assert.equal((await aplicar(p.body.token,{...pedido(),destino:'OUTRO NOME'})).status,409)
  assert.equal((await aplicar(p.body.token,{...pedido(),tipo:'cortes'})).status,409)
})
test('falha de auditoria desfaz nomes e cópia de correspondências',async()=>{
  const p=await previa(),antes=structuredClone(banco);falharAuditoria=true
  assert.equal((await aplicar(p.body.token)).status,500)
  assert.deepEqual(banco,antes);assert.equal(consultas.at(-1).q,'ROLLBACK')
})
test('conflito Sankhya bloqueia a união; destinos iguais em ordem diferente podem ser reutilizados',async()=>{
  banco.regras.push(regra('CONJUNTO FEMININO',6069))
  const antes=structuredClone(banco)
  assert.equal((await previa()).status,409);assert.deepEqual(banco,antes)
  const a={...regra(),destinos:[destino,{...destino,codigo_produto:6069}]}
  const b={...a,modelo:'CONJUNTO FEMININO',destinos:[...a.destinos].reverse()}
  assert.deepEqual(planejarCorrespondencias([a,b],['CONJUNTO FEMINIA'],'CONJUNTO FEMININO'),[])
  assert.equal(planejarCorrespondencias([a,{...a,modelo:'CONJUNTO FEMINIA 2'}],['CONJUNTO FEMINIA','CONJUNTO FEMINIA 2'],'CONJUNTO FEMININO').length,1)
})
test('recusa seleção vazia, nomes inválidos, tipo desconhecido, falta de prévia e justificativa',async()=>{
  for(const dado of [null,{...pedido(),tipo:'itens_corte; DROP TABLE cortes'},{...pedido(),origens:[]},{...pedido(),origens:[null]},
    {...pedido(),destino:' '},{...pedido(),destino:'X'.repeat(201)},{...pedido(),origens:Array(101).fill('A')},
    {...pedido(),origens:['CONJUNTO FEMININO']}]) assert.equal((await previa(dado)).status,400)
  assert.equal((await aplicar('inválido')).status,400)
  assert.equal((await post('/admin/nomenclaturas/aplicar',{...pedido(),token:'a'.repeat(64)})).status,400)
  assert.equal(consultas.length,0)
})
test('não aceita prévia sem registros, limita lote e não altera nomes fora da seleção exata',async()=>{
  assert.equal((await previa({...pedido(),origens:['INEXISTENTE']})).status,409)
  banco.itens.push({...banco.itens[0],id:8,modelo:'conjunto feminia'})
  const p=await previa();assert.equal((await aplicar(p.body.token)).status,200)
  assert.equal(banco.itens.find(i=>i.id===8).modelo,'conjunto feminia')
  banco.itens=Array.from({length:2001},(_,id)=>({id,numero_corte:922,modelo:'MUITOS'}))
  assert.equal((await previa({...pedido(),origens:['MUITOS']})).status,400)
})
test('validação conserva origem literal, remove duplicatas e exclui registros que já possuem o destino',()=>{
  assert.deepEqual(validarPadronizacao({tipo:'modelos',origens:[' conjunto feminia ',' conjunto feminia ','CONJUNTO FEMININO'],destino:'conjunto feminino'}),
    {tipo:'modelos',origens:[' conjunto feminia '],destino:'CONJUNTO FEMININO'})
})

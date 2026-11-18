const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let seq=0
async function load(post,confirm){
 globalThis.__duplicidade={apiPost:post,confirmarAcao:confirm}
 const source=fs.readFileSync('src/public/js/pages/index/duplicidade-producao.js','utf8').replace(/^import[^\n]*\n/gm,'')
 return import(`data:text/javascript;base64,${Buffer.from(`const {apiPost,confirmarAcao}=globalThis.__duplicidade;\n`+source).toString('base64')}#${++seq}`)
}
const dados={data:'2026-11-18',numero_corte:950,turno:'TURNO',operador:'OPERADOR',hora_inicio:'08:00',hora_fim:'09:00',folha_inicio:0,folha_parou:10,status:'EM PRODUCAO'}
const aviso=()=>Object.assign(new Error('similar'),{codigo:'PRODUCAO_SEMELHANTE',registros:[{...dados,id:1}],confirmacao:'token-fixture'})
test('canceling duplicate review preserves data and never sends another write',async()=>{
 const original=structuredClone(dados);let calls=0,shown=false
 const mod=await load(async()=>{calls++;throw aviso()},async(_,o)=>{assert.match(o.linhas[0],/Novo/);assert.equal(o.cancelar,'Voltar e conferir');return false})
 assert.equal(await mod.registrarProducaoConferida(dados,{aoEncontrar:()=>shown=true}),null)
 assert.equal(shown,true);assert.equal(calls,1);assert.deepEqual(dados,original)
})
test('confirmation retries once with the token and unchanged production data',async()=>{
 const calls=[];const mod=await load(async(u,b)=>{calls.push(b);if(calls.length===1)throw aviso();return {id:2}},async()=>true)
 assert.deepEqual(await mod.registrarProducaoConferida(dados),{id:2})
 assert.deepEqual(calls[1],{...dados,confirmacao_duplicidade:'token-fixture'})
})
test('changing the selected cut during review cancels the retry',async()=>{
 let current=true,calls=0
 const mod=await load(async()=>{calls++;throw aviso()},async()=>{current=false;return true})
 assert.equal(await mod.registrarProducaoConferida(dados,{aindaAtual:()=>current}),null);assert.equal(calls,1)
})
test('finalized cut and ordinary network errors retain their original handling',async()=>{
 const failure=Object.assign(Error('finalized'),{status:409});let reviews=0
 const mod=await load(async()=>{throw failure},async()=>reviews++)
 await assert.rejects(mod.registrarProducaoConferida(dados),e=>e===failure);assert.equal(reviews,0)
})

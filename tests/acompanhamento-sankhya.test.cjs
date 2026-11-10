const {test}=require('node:test')
const assert=require('node:assert/strict')
const caminho=require.resolve('../dist/database-pg')
let queries=[]
require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:{async connect(){return {query:async sql=>{queries.push(sql);return {rows:[]}},release(){}}}}}}
const {resumirAcompanhamento,prepararAcompanhamentoSankhya}=require('../dist/routes/sankhya-acompanhamento.routes')
const {assinaturaItem}=require('../dist/routes/sankhya-lancamentos.routes')
const linha=()=>({numero:940,produto:'CONJUNTO',status:'FINALIZADO',itens_finalizados:1,id:1,modelo:'CONJUNTO',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:100,metragem_usada:200,opcoes:[{codigos:[6073,6069]}]})
test('conta dois componentes e marca corte lançado somente quando todos os produtos foram marcados',()=>{
 const l=linha();l.assinatura=assinaturaItem(l);l.codigos=[6073,6069];l.lancados=[6073]
 let r=resumirAcompanhamento([l])[0]
 assert.equal(r.situacao,'PENDENTE');assert.equal(r.total,2);assert.equal(r.lancados,1)
 l.lancados.push(6069);assert.equal(resumirAcompanhamento([l])[0].situacao,'LANCADO')
 l.quantidade_pecas=200;assert.equal(resumirAcompanhamento([l])[0].lancados,0)
})
test('separa em andamento, sem vínculo e escolha pendente sem inventar produtos',()=>{
 const l=linha()
 assert.equal(resumirAcompanhamento([{...l,status:'EM PRODUÇÃO'}])[0].situacao,'EM_ANDAMENTO')
 assert.equal(resumirAcompanhamento([{...l,opcoes:[]}])[0].situacao,'SEM_VINCULO')
 assert.equal(resumirAcompanhamento([{...l,opcoes:[{codigos:[6073]},{codigos:[6069]}]}])[0].situacao,'ESCOLHER')
 assert.equal(resumirAcompanhamento([{...l,id:null,status:null,opcoes:[]}])[0].nome_sem_vinculo,true)
})
test('ativação única captura somente abertos e usa gatilho para incluir novos, sem reintroduzir antigos',async()=>{
 queries=[];await prepararAcompanhamentoSankhya()
 const s=queries.join('\n')
 assert.match(s,/NOT EXISTS\(SELECT 1 FROM sankhya_acompanhamento_inicio\)/)
 assert.match(s,/COALESCE\(p.status,''\)<>'FINALIZADO'/)
 assert.match(s,/AFTER INSERT ON cortes/)
 assert.match(s,/ON DELETE CASCADE/)
 assert.equal(queries.filter(q=>q.includes('ENABLE ROW LEVEL SECURITY')).length,2)
 assert.equal(queries.at(-1),'COMMIT')
})

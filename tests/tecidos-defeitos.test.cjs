const {test}=require('node:test')
const assert=require('node:assert/strict')
require.cache[require.resolve('../dist/database-pg')]={exports:{}}
const {validarTecido,filtroTecidos,validarSelecaoTecidos}=require('../dist/services/tecidos-defeitos')
const base={nf:'000316056/3',tecido:' cetim ',cor:' branco ',metros:'50,8',defeitos:['Manchado','Sujo','Sujo'],observacao:' lateral '}
test('tecido preserva NF e normaliza nomes, casas decimais e defeitos sem repetir',()=>{
  assert.deepEqual(validarTecido(base),{nf:'000316056/3',tecido:'CETIM',cor:'BRANCO',metros:50.8,defeitos:['Sujo','Manchado'],observacao:'lateral'})
  assert.equal(validarTecido({...base,metros:50.123}).metros,50.123)
  assert.equal(validarTecido({...base,cor:undefined,observacao:undefined}).cor,'')
})
for(const metros of ['0','-1','1.1234','NaN','Infinity','1e3','50m',null,Infinity,{},'1000000000']) {
  test(`tecido recusa metragem inválida: ${String(metros)}`,()=>assert.throws(()=>validarTecido({...base,metros}),e=>e.status===400))
}
test('Outro exige descrição e os defeitos precisam pertencer à lista permitida',()=>{
  for(const defeitos of [[],['Outro'],['<script>'],null]) assert.throws(()=>validarTecido({...base,defeitos,observacao:''}),e=>e.status===400)
  assert.equal(validarTecido({...base,defeitos:['Outro'],observacao:'Furo na borda'}).observacao,'Furo na borda')
})
test('cadastro recusa campos obrigatórios vazios, objetos e texto excessivo',()=>{
  for(const dados of [null,{...base,nf:''},{...base,tecido:{}},{...base,observacao:'a'.repeat(1001)},{...base,nf:316056}]) assert.throws(()=>validarTecido(dados),e=>e.status===400)
})
test('filtro aceita busca literal e rejeita objetos e situação desconhecida',()=>{
  assert.deepEqual(filtroTecidos('PENDENTE','  000%_  '),['PENDENTE','000%_'])
  assert.throws(()=>filtroTecidos('TODOS',''),e=>e.status===400)
  assert.throws(()=>filtroTecidos('PENDENTE',{}),e=>e.status===400)
})

test('seleção de atendimento aceita IDs do PostgreSQL e recusa vazios, duplicados, inválidos ou lote excessivo',()=>{
  assert.deepEqual(validarSelecaoTecidos({itens:[{id:'7',versao:2},{id:9,versao:0}],observacao:'  Peças devolvidas  '}),{itens:[{id:7,versao:2},{id:9,versao:0}],observacao:'Peças devolvidas'})
  for(const itens of [[],null,[{id:7,versao:0},{id:'7',versao:0}],[{id:'1e3',versao:0}],[{id:0,versao:0}],[{id:7,versao:-1}],[{id:7}],Array.from({length:201},(_,i)=>({id:i+1,versao:0}))]) assert.throws(()=>validarSelecaoTecidos({itens}),e=>e.status===400)
  assert.throws(()=>validarSelecaoTecidos({itens:[{id:7,versao:0}],observacao:'a'.repeat(1001)}),e=>e.status===400)
})

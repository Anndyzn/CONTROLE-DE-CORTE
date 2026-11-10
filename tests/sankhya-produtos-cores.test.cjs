const {test}=require('node:test')
const assert=require('node:assert/strict')
const {resolverProdutos,montarConferencia}=require('../dist/services/sankhya-preparacao')
const item={id:1,modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'BEGE',quantidade_pecas:22,metragem_usada:12}
const regra=(cor,codigos=[6073,6069])=>({...item,cor,versao:1,destinos:codigos.map(c=>({codigo_produto:c,produto:'ignorar',controle:cor}))})
test('products reuse across colors without copying controls or preparing an OP',()=>{
 const r=montarConferencia([item],[regra('BRANCO')])[0]
 assert.deepEqual(r.produtos_vinculados.map(p=>p.codigo_produto),[6069,6073])
 assert.ok(r.produtos_vinculados.every(p=>!('controle' in p)))
 assert.equal(r.cor,'BEGE');assert.equal(r.correspondencia,null);assert.deepEqual(r.ordens,[])
})
test('different model or fabric and ambiguous alternatives do not inherit',()=>{
 assert.equal(resolverProdutos(item,[{...regra('BRANCO'),tecido:'CETIM'}]),null)
 assert.equal(resolverProdutos(item,[{...regra('BRANCO'),modelo:'TERNO'}]),null)
 assert.equal(resolverProdutos(item,[regra('BRANCO'),regra('ROSA',[6073])]),null)
 assert.equal(resolverProdutos(item,[regra('BRANCO'),regra('ROSA',[6069,6073])]).length,2)
})
test('exact choice remains authoritative and invalid legacy duplicate is not inherited',()=>{
 assert.deepEqual(resolverProdutos(item,[regra('BRANCO'),regra('BEGE',[6073])]).map(p=>p.codigo_produto),[6073])
 assert.equal(resolverProdutos(item,[regra('BRANCO',[6073,6073])]),null)
})

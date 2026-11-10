const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,els,post,envios,seq=0
const ids=['modeloItem','corItem','corOutra','tecidoItem','tecidoOutro','metragemItem','sobraItem','perdaItem','metrosFaltantesItem','quantidadeItem']
beforeEach(async()=>{
 els={};envios=[]
 for(const id of [...ids,'numeroCorte','itemEditandoId','salvarItemCorte','salvarOutroItemCorte','finalizarItensCorte','formItensCorte','listaItensCorte'])els[id]={value:'',disabled:false,style:{},focus(){this.focado=true}}
 Object.entries({numeroCorte:'946',modeloItem:'EDREDON',corItem:'BRANCO',tecidoItem:'OUTRA',tecidoOutro:'CETIM',metragemItem:'200',sobraItem:'2',perdaItem:'1',metrosFaltantesItem:'0',quantidadeItem:'100'}).forEach(([id,v])=>els[id].value=v)
 globalThis.document={getElementById:id=>els[id]}
 post=async()=>({id:123})
 globalThis.__piDeps={apiGet:async u=>u.endsWith('finalizacao-itens')?{itens_finalizados:0}:[],apiPost:(u,b)=>{envios.push({u,b});return post()},apiPut(){},apiDelete(){},mostrarToast(){},validarValoresItem:()=>null,solicitarJustificativa:async()=>({}),confirmarAcao(){},atualizarVinculosPIs(){},definirBaseItemRascunho(){},limparRascunhoGrupo(){},versaoRascunho(){},maiusculo:v=>v,formatarNumero:v=>v,formatarQuantidade:v=>v,desabilitarItens(){},limparErroCampo(){},marcarErroCampo(){},validarObrigatoriosCampos(){},marcarErrosNumericos(){},limparCamposItens(){for(const id of ids)els[id].value='';els.corOutra.style.display='none';els.tecidoOutro.style.display='none'}}
 const codigo=fs.readFileSync('src/public/js/pages/index/itens.js','utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'')
 const nomes=Object.keys(globalThis.__piDeps).join(',')
 modulo=await import(`data:text/javascript;base64,${Buffer.from(`const {${nomes}}=globalThis.__piDeps;\n`+codigo).toString('base64')}#${++seq}`)
})
test('salva e prepara outro PI mantendo somente modelo e tecido, inclusive Outro',async()=>{
 await modulo.salvarItemCorte({continuar:true})
 assert.equal(envios.length,1);assert.equal(envios[0].b.cor,'BRANCO');assert.equal(envios[0].b.tecido,'CETIM')
 assert.equal(els.modeloItem.value,'EDREDON');assert.equal(els.tecidoItem.value,'OUTRA');assert.equal(els.tecidoOutro.value,'CETIM')
 for(const id of ['corItem','corOutra','metragemItem','sobraItem','perdaItem','metrosFaltantesItem','quantidadeItem'])assert.equal(els[id].value,'',id)
 assert.equal(els.corItem.focado,true);assert.equal(els.salvarOutroItemCorte.disabled,false)
})
test('clique duplo não duplica envio; falha mantém os valores para tentar novamente',async()=>{
 let rejeitar;post=()=>new Promise((_,r)=>rejeitar=r)
 const salvando=modulo.salvarItemCorte({continuar:true})
 await modulo.salvarItemCorte({continuar:true});assert.equal(envios.length,1);assert.equal(els.salvarOutroItemCorte.disabled,true)
 rejeitar(Error('Falha de teste'));await salvando
 assert.equal(els.corItem.value,'BRANCO');assert.equal(els.quantidadeItem.value,'100');assert.equal(els.salvarOutroItemCorte.disabled,false)
})
test('campos alterados durante envio e campos de outro corte não são limpos',async()=>{
 let resolver;post=()=>new Promise(r=>resolver=r)
 const salvando=modulo.salvarItemCorte({continuar:true})
 els.corItem.value='BEGE';resolver({id:123});await salvando
 assert.equal(els.corItem.value,'BEGE');assert.equal(els.quantidadeItem.value,'100')
})

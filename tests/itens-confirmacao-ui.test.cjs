const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let modulo, chamadas, confirma, bloqueado, sequencia=0
beforeEach(async()=>{
  chamadas=[];confirma=false;bloqueado=false
  const tabela={innerHTML:'',appendChild(){}}
  globalThis.document={getElementById:id=>id==='numeroCorte'?{value:'917'}:tabela,createElement:()=>({innerHTML:''})}
  globalThis.__itensDeps={
    apiGet:async url=>url.endsWith('finalizacao-itens')?{itens_finalizados:1}:[{id:1,modelo:'PI',cor:'BRANCO',tecido:'VOIL',metragem_usada:12.5,quantidade_pecas:5}],
    apiPost:async url=>chamadas.push(url),apiPut(){},apiDelete(){},mostrarToast(){},validarValoresItem(){},solicitarJustificativa(){},
    confirmarAcao:async()=>confirma,definirBaseItemRascunho(){},limparRascunhoGrupo(){},versaoRascunho(){},
    maiusculo:v=>v,formatarNumero:v=>v,formatarQuantidade:v=>v,limparCamposItens(){},desabilitarItens:()=>{bloqueado=true}
  }
  const codigo=fs.readFileSync('src/public/js/pages/index/itens.js','utf8').replace(/^import[\s\S]*?from "[^"]+"\r?\n/gm,'')
  const nomes=Object.keys(globalThis.__itensDeps).join(',')
  modulo=await import(`data:text/javascript;base64,${Buffer.from(`const {${nomes}}=globalThis.__itensDeps;\n`+codigo).toString('base64')}#${++sequencia}`)
})

test('a nova confirmação mantém os PIs abertos ao cancelar e só envia após aceitar',async()=>{
  await modulo.finalizarItensCorte()
  assert.equal(chamadas.length,0)
  assert.equal(bloqueado,false)
  confirma=true
  await modulo.finalizarItensCorte()
  assert.deepEqual(chamadas,['/cortes/917/finalizar-itens'])
  assert.equal(bloqueado,true)
})

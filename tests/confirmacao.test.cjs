const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, modulo, sequencia=0
beforeEach(async()=>{
  elementos=Object.fromEntries(['tituloConfirmacaoSistema','descricaoConfirmacaoSistema','aceitarConfirmacaoSistema','cancelarConfirmacaoSistema'].map(id=>[id,{textContent:'',focus(){this.focado=true}}]))
  elementos.confirmacaoSistema={open:false,showModal(){this.open=true},close(){this.open=false;this.onclose()}}
  globalThis.document={getElementById:id=>elementos[id],querySelector:()=>elementos.confirmacaoSistema.open ? elementos.confirmacaoSistema : null}
  const codigo=fs.readFileSync('src/public/js/core/confirmacao.js','utf8')
  modulo=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${++sequencia}`)
})

test('cancelar ou fechar a janela não autoriza a ação',async()=>{
  let resposta=modulo.confirmarAcao('Excluir este PI?',{titulo:'Excluir PI',perigosa:true})
  assert.equal(elementos.cancelarConfirmacaoSistema.focado,true)
  elementos.cancelarConfirmacaoSistema.onclick()
  assert.equal(await resposta,false)
  resposta=modulo.confirmarAcao('Excluir este PI?')
  elementos.confirmacaoSistema.close() // mesmo evento de fechamento usado por Escape
  assert.equal(await resposta,false)
})

test('somente o botão de confirmação autoriza a ação, sem interpretar HTML dos dados',async()=>{
  const resposta=modulo.confirmarAcao('Produto: <img src=x>\nCorte: 917',{titulo:'Excluir PI',confirmar:'Excluir PI',perigosa:true})
  assert.equal(elementos.descricaoConfirmacaoSistema.textContent,'Produto: <img src=x>\nCorte: 917')
  assert.equal(elementos.aceitarConfirmacaoSistema.textContent,'Excluir PI')
  assert.equal(elementos.aceitarConfirmacaoSistema.className,'confirmacao-perigosa')
  elementos.aceitarConfirmacaoSistema.onclick()
  assert.equal(await resposta,true)
})

test('uma janela já aberta impede autorizar uma segunda operação',async()=>{
  const primeira=modulo.confirmarAcao('Excluir?')
  assert.equal(await modulo.confirmarAcao('Reabrir?'),false)
  elementos.cancelarConfirmacaoSistema.onclick()
  assert.equal(await primeira,false)
  const seguinte=modulo.confirmarAcao('Confirmar PIs?')
  assert.equal(elementos.aceitarConfirmacaoSistema.className,'')
  elementos.aceitarConfirmacaoSistema.onclick()
  assert.equal(await seguinte,true)
})

test('o fechamento precisa terminar antes de reutilizar a janela',async()=>{
  elementos.confirmacaoSistema.close=function(){this.open=false}
  const resposta=modulo.confirmarAcao('Confirmar PIs?')
  elementos.aceitarConfirmacaoSistema.onclick()
  assert.equal(await modulo.confirmarAcao('Excluir PI?'),false)
  elementos.confirmacaoSistema.onclose()
  assert.equal(await resposta,true)
})

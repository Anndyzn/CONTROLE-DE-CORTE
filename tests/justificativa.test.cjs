const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, modulo, sequencia = 0
beforeEach(async () => {
  const campo = () => ({value:'', mensagem:'', disabled:false, setCustomValidity(v){this.mensagem=v}, focus(){}})
  elementos = Object.fromEntries(['responsavelAdmin','motivoAdmin','numeroConfirmacaoAdmin'].map(id => [id,campo()]))
  for (const id of ['tituloJustificativaAdmin','descricaoJustificativaAdmin','grupoNumeroConfirmacaoAdmin','cancelarJustificativaAdmin']) elementos[id] = {}
  elementos.justificativaAdmin = {open:false, showModal(){this.open=true}, close(){this.open=false;this.onclose()}}
  elementos.formJustificativaAdmin = {
    reset(){for (const id of ['responsavelAdmin','motivoAdmin','numeroConfirmacaoAdmin']) elementos[id].value=''},
    reportValidity(){return ['responsavelAdmin','motivoAdmin','numeroConfirmacaoAdmin'].every(id => elementos[id].disabled || !elementos[id].mensagem)}
  }
  globalThis.document = {getElementById:id => elementos[id]}
  globalThis.localStorage = {getItem:() => '',setItem(){}}
  const codigo = fs.readFileSync('src/public/js/admin/justificativa.js','utf8')
  modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${++sequencia}`)
})
const enviar = () => elementos.formJustificativaAdmin.onsubmit({preventDefault(){}})

test('cancelar a justificativa retorna null e não confirma a operação', async () => {
  const resultado = modulo.solicitarJustificativa({titulo:'Excluir PI',descricao:'Confirme o motivo'})
  elementos.cancelarJustificativaAdmin.onclick()
  assert.equal(await resultado, null)
})

test('responsável e motivo vazios ou curtos não confirmam a alteração', async () => {
  const resultado = modulo.solicitarJustificativa({titulo:'Reabrir',descricao:'Informe o motivo'})
  elementos.responsavelAdmin.value=' a '
  elementos.motivoAdmin.value='  '
  enviar()
  assert.equal(elementos.justificativaAdmin.open, true)
  elementos.responsavelAdmin.value='  ANDY '
  elementos.motivoAdmin.value='  Finalizado por engano  '
  enviar()
  assert.deepEqual(await resultado, {responsavel:'ANDY',motivo:'Finalizado por engano'})
})

test('exclusão completa exige o número correto, e cancelar não bloqueia operações seguintes', async () => {
  const resultado = modulo.solicitarJustificativa({titulo:'Excluir corte',descricao:'Excluir tudo',numeroConfirmacao:'843'})
  elementos.responsavelAdmin.value='ANDY'; elementos.motivoAdmin.value='Corte duplicado'
  elementos.numeroConfirmacaoAdmin.value='844'
  enviar()
  assert.equal(elementos.justificativaAdmin.open, true)
  elementos.cancelarJustificativaAdmin.onclick()
  assert.equal(await resultado, null)
  const seguinte = modulo.solicitarJustificativa({titulo:'Reabrir',descricao:'Reabrir PIs'})
  assert.equal(elementos.numeroConfirmacaoAdmin.disabled, true)
  assert.equal(elementos.numeroConfirmacaoAdmin.mensagem, '')
  elementos.responsavelAdmin.value='ANDY'; elementos.motivoAdmin.value='Ajustar os PIs'
  enviar()
  assert.equal((await seguinte).motivo, 'Ajustar os PIs')
})

const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, modulo, sequencia = 0
beforeEach(async () => {
  const campo = () => ({value:'', mensagem:'', disabled:false, setCustomValidity(v){this.mensagem=v}, focus(){}})
  elementos = Object.fromEntries(['responsavelAdmin','motivoAdmin','tipoMotivoAdmin','numeroConfirmacaoAdmin'].map(id => [id,campo()]))
  for (const id of ['tituloJustificativaAdmin','descricaoJustificativaAdmin','grupoNumeroConfirmacaoAdmin','grupoOutroMotivoAdmin','cancelarJustificativaAdmin']) elementos[id] = {}
  elementos.justificativaAdmin = {open:false, showModal(){this.open=true}, close(){this.open=false;this.onclose()}}
  elementos.formJustificativaAdmin = {
    reset(){for (const id of ['responsavelAdmin','motivoAdmin','tipoMotivoAdmin','numeroConfirmacaoAdmin']) elementos[id].value=''},
    reportValidity(){return ['responsavelAdmin','motivoAdmin','tipoMotivoAdmin','numeroConfirmacaoAdmin'].every(id => elementos[id].disabled || !elementos[id].mensagem)}
  }
  globalThis.document = {getElementById:id => elementos[id]}
  globalThis.localStorage = {getItem:() => '',setItem(){}}
  const codigo = fs.readFileSync('src/public/js/admin/justificativa.js','utf8')
  modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${++sequencia}`)
})
const enviar = () => elementos.formJustificativaAdmin.onsubmit({preventDefault(){}})
const outro = () => {elementos.tipoMotivoAdmin.value='OUTRO';elementos.tipoMotivoAdmin.onchange()}

test('cancelar a justificativa retorna null e não confirma a operação', async () => {
  const resultado = modulo.solicitarJustificativa({titulo:'Excluir PI',descricao:'Confirme o motivo'})
  elementos.cancelarJustificativaAdmin.onclick()
  assert.equal(await resultado, null)
})

test('responsável e motivo vazios ou curtos não confirmam a alteração', async () => {
  const resultado = modulo.solicitarJustificativa({titulo:'Reabrir',descricao:'Informe o motivo'})
  outro()
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
  outro()
  elementos.responsavelAdmin.value='ANDY'; elementos.motivoAdmin.value='Corte duplicado'
  elementos.numeroConfirmacaoAdmin.value='844'
  enviar()
  assert.equal(elementos.justificativaAdmin.open, true)
  elementos.cancelarJustificativaAdmin.onclick()
  assert.equal(await resultado, null)
  const seguinte = modulo.solicitarJustificativa({titulo:'Reabrir',descricao:'Reabrir PIs'})
  outro()
  assert.equal(elementos.numeroConfirmacaoAdmin.disabled, true)
  assert.equal(elementos.numeroConfirmacaoAdmin.mensagem, '')
  elementos.responsavelAdmin.value='ANDY'; elementos.motivoAdmin.value='Ajustar os PIs'
  enviar()
  assert.equal((await seguinte).motivo, 'Ajustar os PIs')
})

test('motivo pronto não exige descrição e é enviado como texto para o histórico',async()=>{
  const resultado=modulo.solicitarJustificativa({titulo:'Padronizar',descricao:'Nomes'})
  elementos.responsavelAdmin.value='ANDY';enviar()
  assert.equal(elementos.justificativaAdmin.open,true)
  elementos.tipoMotivoAdmin.value='Padronização de nomes';elementos.tipoMotivoAdmin.onchange()
  assert.equal(elementos.motivoAdmin.disabled,true)
  assert.equal(elementos.grupoOutroMotivoAdmin.hidden,true)
  enviar();assert.deepEqual(await resultado,{responsavel:'ANDY',motivo:'Padronização de nomes'})
})
test('trocar de Outro para motivo pronto limpa erro e não reaproveita descrição antiga na próxima ação',async()=>{
  const resultado=modulo.solicitarJustificativa({titulo:'Corrigir',descricao:'Correção'})
  elementos.responsavelAdmin.value='ANDY';outro();elementos.motivoAdmin.value='a';enviar()
  assert.equal(elementos.justificativaAdmin.open,true)
  elementos.tipoMotivoAdmin.value='Erro de digitação';elementos.tipoMotivoAdmin.onchange();enviar()
  assert.equal((await resultado).motivo,'Erro de digitação')
  const seguinte=modulo.solicitarJustificativa({titulo:'Corrigir',descricao:'Outra correção'})
  assert.equal(elementos.tipoMotivoAdmin.value,'');assert.equal(elementos.motivoAdmin.value,'');assert.equal(elementos.motivoAdmin.disabled,true)
  elementos.cancelarJustificativaAdmin.onclick();await seguinte
})

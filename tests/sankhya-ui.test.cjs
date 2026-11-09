const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let elementos, eventosJanela, chamadas, mensagens, obter, atualizar, confirmar, dados, sequencia=0
class Elemento {
  constructor(tag='div') {this.tagName=tag;this.children=[];this.dataset={};this.eventos={};this.value='';this.hidden=false;this.disabled=false;this.textContent=''}
  append(...filhos) {for(const filho of filhos){filho.parent=this;this.children.push(filho)}}
  replaceChildren(...filhos) {this.children=[];this.append(...filhos)}
  remove() {this.parent.children=this.parent.children.filter(c=>c!==this)}
  addEventListener(nome,fn) {this.eventos[nome]=fn}
  setAttribute(nome,valor) {this[nome]=valor}
  reportValidity() {return true}
  querySelectorAll(tag) {return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)])}
  get firstElementChild() {return this.children[0]}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
beforeEach(async()=>{
  elementos={};eventosJanela={};chamadas=[];mensagens=[]
  const ids=['exportarGuiaSankhya','camposBuscaSankhya','camposCorrespondenciaSankhya','conferenciaSankhya','editorSankhya','numeroSankhya','formBuscarSankhya','recentesSankhya','estadoSankhya','formCorrespondenciaSankhya','itemSankhya','destinosSankhya','adicionarDestinoSankhya','origemSankhya','tituloConferenciaSankhya','resumoConferenciaSankhya','linhasConferenciaSankhya']
  for(const id of ids) elementos[id]=new Elemento()
  elementos.numeroSankhya.value='922'
  dados={corte:{numero:922,produto:'CONJUNTO FEMININO'},total_ops:0,completa:false,envio_disponivel:false,itens:[
    {id:1,modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'BRANCO',quantidade_pecas:216,metragem_usada:481.68,correspondencia:null,ordens:[],pendencias:['Cadastre a correspondência.']},
    {id:2,modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'AZUL CLARO',quantidade_pecas:150,metragem_usada:359.95,correspondencia:null,ordens:[],pendencias:['Cadastre a correspondência.']}
  ]}
  obter=async url=>url==='/sankhya/cortes'?[dados.corte]:structuredClone(dados)
  atualizar=async()=>({versao:1})
  confirmar=async()=>true
  globalThis.document={getElementById:id=>elementos[id],createElement:tag=>new Elemento(tag)}
  globalThis.window={addEventListener:(nome,fn)=>{eventosJanela[nome]=fn}}
  globalThis.__sankhyaDeps={baixarGuiaSankhya:async numero=>chamadas.push({exportar:numero}),apiGet:url=>{chamadas.push({url});return obter(url)},apiPut:(url,body)=>{chamadas.push({url,body});return atualizar(url,body)},mostrarToast:(...args)=>mensagens.push(args),confirmarAcao:(...args)=>confirmar(...args),inicializarTabelasResponsivas(){}}
  const codigo=fs.readFileSync('src/public/js/pages/sankhya/main.js','utf8').replace(/^import .*$/gm,'')
  await import(`data:text/javascript;base64,${Buffer.from('const {baixarGuiaSankhya,apiGet,apiPut,mostrarToast,confirmarAcao,inicializarTabelasResponsivas}=globalThis.__sankhyaDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
  await tick()
})
const buscar=()=>elementos.formBuscarSankhya.eventos.submit({preventDefault(){}})
const salvar=()=>elementos.formCorrespondenciaSankhya.eventos.submit({preventDefault(){}})
function preencher(codigo=6073, produto='PI CORTE BLAZER',controle='BRANCO',indice=0){
  const inputs=elementos.destinosSankhya.children[indice].querySelectorAll('input')
  inputs[0].value=String(codigo);inputs[1].value=produto;inputs[2].value=controle
  elementos.formCorrespondenciaSankhya.eventos.input()
}

test('conferência separa itens, mostra pendências e trata conteúdo como texto',async()=>{
  dados.corte.produto='<img src=x onerror=alert(1)>'
  await buscar()
  assert.equal(elementos.tituloConferenciaSankhya.textContent,'Corte 922 — <img src=x onerror=alert(1)>')
  assert.equal(elementos.linhasConferenciaSankhya.children.length,2)
  assert.equal(elementos.editorSankhya.hidden,false)
  assert.match(elementos.origemSankhya.textContent,/481,68 m/)
  assert.equal(chamadas.filter(c=>c.body).length,0)
  assert.equal(elementos.camposBuscaSankhya.disabled,false)
})
test('salva vários destinos do item selecionado e pede nova conferência ao servidor',async()=>{
  await buscar();preencher()
  elementos.adicionarDestinoSankhya.eventos.click();preencher(6069,'PI CORTE VESTIDO','BRANCO',1)
  await salvar()
  const envio=chamadas.find(c=>c.body)
  assert.equal(envio.url,'/sankhya/correspondencias')
  assert.deepEqual(envio.body,{modelo:'CONJUNTO FEMININO',tecido:'OXFORD',cor:'BRANCO',versao:0,destinos:[
    {codigo_produto:6073,produto:'PI CORTE BLAZER',controle:'BRANCO'},
    {codigo_produto:6069,produto:'PI CORTE VESTIDO',controle:'BRANCO'}
  ]})
  assert.equal(chamadas.filter(c=>c.url.includes('/conferencia')).length,2)
  assert.ok(!chamadas.some(c=>/https:|apontamento|authenticate/.test(c.url)))
})

test('guia exige correspondências completas e salvas e usa o número do corte selecionado',async()=>{
  await buscar()
  assert.equal(elementos.exportarGuiaSankhya.disabled,true)
  await elementos.exportarGuiaSankhya.eventos.click()
  assert.equal(chamadas.filter(c=>c.exportar).length,0)
  dados.completa=true;await buscar()
  assert.equal(elementos.exportarGuiaSankhya.disabled,false)
  await elementos.exportarGuiaSankhya.eventos.click()
  assert.equal(chamadas.find(c=>c.exportar).exportar,922)
  preencher()
  assert.equal(elementos.exportarGuiaSankhya.disabled,true)
  await elementos.exportarGuiaSankhya.eventos.click()
  assert.equal(chamadas.filter(c=>c.exportar).length,1)
})
test('cancelar troca de item ou de corte conserva a edição; falha ao salvar também conserva campos',async()=>{
  await buscar();preencher()
  confirmar=async()=>false
  elementos.itemSankhya.value='1'
  await elementos.itemSankhya.eventos.change()
  assert.equal(elementos.itemSankhya.value,'0')
  const consultas=chamadas.length
  await buscar();assert.equal(chamadas.length,consultas)
  confirmar=async()=>true
  atualizar=async()=>{throw new Error('Correspondência alterada em outra tela')}
  await salvar()
  assert.equal(elementos.destinosSankhya.children[0].querySelectorAll('input')[0].value,'6073')
  assert.equal(elementos.editorSankhya.hidden,false)
  assert.match(mensagens.at(-1)[0],/outra tela/)
})
test('salvamento em andamento bloqueia duplo envio e navegação até a confirmação',async()=>{
  await buscar();preencher()
  let resolver
  atualizar=()=>new Promise(resolve=>{resolver=resolve})
  const pendente=salvar();await tick()
  assert.equal(elementos.camposBuscaSankhya.disabled,true)
  await salvar();await buscar()
  assert.equal(chamadas.filter(c=>c.body).length,1)
  resolver({versao:1});await pendente
  assert.equal(elementos.camposBuscaSankhya.disabled,false)
})
test('falha de conferência após gravação não apresenta a prévia antiga como atual',async()=>{
  await buscar();preencher()
  obter=async()=>{throw new Error('Corte reaberto')}
  await salvar()
  assert.equal(elementos.conferenciaSankhya.hidden,true)
  assert.equal(elementos.editorSankhya.hidden,true)
  assert.match(elementos.estadoSankhya.textContent,/Correspondência salva/)
  assert.match(elementos.estadoSankhya.textContent,/Consulte o corte novamente/)
})
test('não permite salvar sem destinos, limita a dez e avisa sobre edição ao sair',async()=>{
  await buscar()
  const remover=elementos.destinosSankhya.children[0].children.at(-1)
  remover.eventos.click();await salvar()
  assert.equal(chamadas.filter(c=>c.body).length,0)
  for(let i=0;i<11;i++)elementos.adicionarDestinoSankhya.eventos.click()
  assert.equal(elementos.destinosSankhya.children.length,10)
  assert.equal(elementos.adicionarDestinoSankhya.disabled,true)
  let preveniu=false
  const evento={preventDefault(){preveniu=true}}
  eventosJanela.beforeunload(evento)
  assert.equal(preveniu,true)
})

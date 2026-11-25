const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const {randomUUID}=require('node:crypto')
const tick=()=>new Promise(r=>setImmediate(r))
function ambiente(){
  const elementos={}
  class El {
    constructor(tag='div'){this.tag=tag;this.className='';this.children=[];this.listeners={};this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.attributes={};this.validity=''}
    append(e){this.children.push(e)}
    replaceChildren(...e){this.children=e}
    addEventListener(event,fn){this.listeners[event]=fn}
    setAttribute(k,v){this.attributes[k]=v}
    setCustomValidity(v){this.validity=v}
    focus(){}
    showModal(){this.open=true}
    close(){this.open=false}
  }
  const $=id=>elementos[id]??=(new El())
  const nomes=['nfTecido','nomeTecido','corTecido','metrosTecido','obsTecido']
  const defeitos=['Sujo','Manchado','Rasgado','Molhado','Outro'].map(value=>Object.assign(new El('input'),{value,checked:false}))
  const form=$('formTecido')
  form.querySelectorAll=()=>defeitos.filter(e=>e.checked)
  form.querySelector=()=>defeitos[0]
  form.reset=()=>{nomes.forEach(id=>$(id).value='');defeitos.forEach(e=>e.checked=false)}
  form.reportValidity=()=>!defeitos[0].validity
  class DadosForm { *[Symbol.iterator](){for(const [i,nome]of ['nf','tecido','cor','metros','observacao'].entries())yield [nome,$(nomes[i]).value]} }
  const chamadas=[],estado={lista:{itens:[],resumo:{quantidade:0,metros:'0'}},get:null,post:null,put:null,impresso:null}
  const contexto={document:{getElementById:$,createElement:tag=>new El(tag)},URLSearchParams,crypto:{randomUUID},FormData:DadosForm,console,
    apiGet:async url=>{chamadas.push({url});if(estado.get)return estado.get(url);return url.includes('sugestoes')?{tecidos:[]}:estado.lista},
    apiPost:async(url,body)=>{chamadas.push({url,body});if(estado.post)return estado.post(url,body);return {item:{id:1}}},
    apiPut:async(url,body)=>{chamadas.push({url,body});if(estado.put)return estado.put(url,body);return {item:{id:1}}},
    imprimirTecidos:(...args)=>{estado.impresso=args},iniciarAtualizacaoTecidos:config=>{estado.realtime=config;return {retomar(){}}}}
  const codigo=fs.readFileSync('src/public/js/pages/tecidos/main.js','utf8').replace(/^import[^\n]*\n/gm,'')
  vm.runInNewContext(codigo,contexto)
  return {$,defeitos,chamadas,estado,async evento(id,nome='click',value){return $(id).listeners[nome]({preventDefault(){},submitter:{value}})},preencher(){nomes.forEach((id,i)=>$(id).value=['000316056/3','CETIM','BRANCO','50,8','Mancha lateral'][i]);defeitos[1].checked=true}}
}
const item={id:7,nf:'0001/3',tecido:'<img src=x onerror=alert(1)>',cor:'BRANCO',metros:50,defeitos:['Sujo'],observacao:'<script>teste</script>',status:'PENDENTE',versao:2,criado_em:'2026-11-25T11:00:00Z'}
function textos(e){return [e.textContent??'',...e.children.flatMap(textos)].join(' ')}

test('lista exibe NF e observação como texto e abre confirmação com a peça correta',async()=>{
  const a=ambiente();await tick();a.estado.lista={itens:[item],resumo:{quantidade:1,metros:50}};await a.evento('atualizarTecidos')
  await tick();assert.match(textos(a.$('listaTecidos')),/0001\/3/);assert.match(textos(a.$('listaTecidos')),/<script>teste<\/script>/)
  const linha=a.$('listaTecidos').children[0];await linha.children.at(-1).children[0].listeners.click()
  assert.equal(a.$('dialogSituacaoTecido').open,true);assert.match(a.$('descricaoSituacaoTecido').textContent,/0001\/3/)
  a.$('obsSituacaoTecido').value='Fornecedor vai trocar';a.estado.put=async()=>{throw new Error('Conflito')}
  await a.evento('formSituacaoTecido','submit')
  assert.equal(a.$('dialogSituacaoTecido').open,true);assert.equal(a.$('obsSituacaoTecido').value,'Fornecedor vai trocar')
  const envio=a.chamadas.find(c=>c.body?.status)
  assert.equal(envio.body.versao,2);assert.equal(envio.body.status,'RESOLVIDO')
})
test('falha preserva campos e chave de reenvio; outra peça da mesma NF recebe nova chave',async()=>{
  const a=ambiente();await tick();a.preencher();a.estado.post=async()=>{throw new Error('Rede indisponível')}
  await a.evento('formTecido','submit','outro')
  const primeira=a.chamadas.find(c=>c.body?.chave_envio).body.chave_envio
  assert.equal(a.$('metrosTecido').value,'50,8');assert.equal(a.$('camposTecido').disabled,false)
  a.estado.post=null;await a.evento('formTecido','submit','outro')
  let envios=a.chamadas.filter(c=>c.body?.chave_envio)
  assert.equal(envios[1].body.chave_envio,primeira)
  assert.equal(a.$('nfTecido').value,'000316056/3');assert.equal(a.$('nomeTecido').value,'CETIM');assert.equal(a.$('metrosTecido').value,'');assert.ok(a.defeitos.every(c=>!c.checked))
  a.preencher();await a.evento('formTecido','submit','outro')
  envios=a.chamadas.filter(c=>c.body?.chave_envio);assert.notEqual(envios[2].body.chave_envio,primeira)
})
test('Outro exige observação; impressão consulta todas as páginas do filtro e não marca atendimento',async()=>{
  const a=ambiente();await tick();a.preencher();a.defeitos[4].checked=true;await a.evento('formTecido','input')
  assert.equal(a.$('obsTecido').required,true)
  a.estado.lista={itens:[item],resumo:{quantidade:1,metros:50}}
  a.$('buscaTecido').value='0001/3';await a.evento('buscarTecidos','submit');await a.evento('imprimirTecidos')
  assert.ok(a.chamadas.some(c=>c.url.includes('imprimir=1')&&c.url.includes('busca=0001%2F3')))
  assert.equal(a.estado.impresso[1],'PENDENTE');assert.equal(a.estado.impresso[2],'0001/3');assert.ok(a.chamadas.every(c=>!c.body))
})

test('a lista mantém cada peça e separa visualmente somente ao mudar de NF',async()=>{
  const a=ambiente();await tick()
  a.estado.lista={itens:[item,{...item,id:8},{...item,id:9,nf:'0002/3'}],resumo:{quantidade:3,metros:150}}
  await a.evento('atualizarTecidos');await tick()
  const linhas=a.$('listaTecidos').children
  assert.equal(linhas.length,3)
  assert.ok(!linhas[0].className.includes('tecidos-inicio-nf'))
  assert.ok(!linhas[1].className.includes('tecidos-inicio-nf'))
  assert.ok(linhas[2].className.includes('tecidos-inicio-nf'))
})

test('atualização automática mantém campos, filtro e a lista anterior enquanto consulta',async()=>{
  const a=ambiente();await tick();a.preencher()
  a.estado.lista={itens:[item],resumo:{quantidade:1,metros:50}}
  a.$('buscaTecido').value='0001';await a.evento('buscarTecidos','submit')
  const anterior=a.$('listaTecidos').children[0]
  let terminar;a.estado.get=()=>new Promise(r=>terminar=r)
  const carga=a.estado.realtime.atualizar()
  assert.equal(a.$('listaTecidos').children[0],anterior)
  assert.equal(a.$('nfTecido').value,'000316056/3');assert.equal(a.$('metrosTecido').value,'50,8')
  terminar(a.estado.lista);assert.equal(await carga,true)
  assert.equal(a.$('buscaTecido').value,'0001');assert.equal(a.$('obsTecido').value,'Mancha lateral')
  a.$('dialogSituacaoTecido').open=true;assert.ok(a.estado.realtime.ocupado())
})

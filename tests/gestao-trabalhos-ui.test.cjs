const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs')
let modulo,el,put,del,justificar,chamadas,seq=0
const inicio={id:12,numero_corte:929,mesa:'MESA 1',operador:'ANA',turno:'1º TURNO',data:'2026-11-17',hora_inicio:'08:00',versao:2}
beforeEach(async()=>{
 el={};chamadas=[]
 for(const id of ['dialogCorrigirInicio','formCorrigirInicio','operador','turno','corrigirOperador','corrigirTurno','corrigirOutro','corrigirData','corrigirHora','corrigirInicioContexto','corrigirResponsavel','corrigirMotivoTipo','corrigirMotivoOutroGrupo','corrigirMotivoOutro','salvarCorrigirInicio','fecharCorrigirInicio'])el[id]={value:'',hidden:false,disabled:false,options:[],focus(){},reset(){},reportValidity:()=>true,replaceChildren(...op){this.options=op}}
 for(const [id,valores] of [['operador',['ANA','OUTRO']],['turno',['1º TURNO','2º TURNO']]])el[id].options=valores.map(value=>({value,cloneNode(){return {value}}}))
 el.dialogCorrigirInicio.showModal=()=>{el.dialogCorrigirInicio.open=true}
 el.dialogCorrigirInicio.close=()=>{el.dialogCorrigirInicio.open=false;el.dialogCorrigirInicio.onclose()}
 globalThis.document={getElementById:id=>el[id],querySelector:()=>null}
 globalThis.localStorage={getItem:()=>'',setItem(){}}
 put=async(url,body)=>{chamadas.push({url,body});return {trabalho:{...inicio,versao:3}}}
 del=async(url,body)=>{chamadas.push({url,body});return {trabalho:{...inicio,status:'CANCELADO'}}}
 justificar=async()=>null
 globalThis.__gestao={apiPut:(...a)=>put(...a),apiDelete:(...a)=>del(...a),mostrarToast(){},solicitarJustificativa:(...a)=>justificar(...a)}
 const source=fs.readFileSync('src/public/js/pages/index/gestao-trabalhos.js','utf8').replace(/^import[^\n]*\n/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiPut,apiDelete,mostrarToast,solicitarJustificativa}=globalThis.__gestao;\n'+source).toString('base64')}#${++seq}`)
})
test('corrige operador, turno e início na mesma tela enviando responsável, motivo e versão',async()=>{
 const resultado=modulo.editarInicio(inicio)
 assert.equal(el.corrigirData.value,'2026-11-17');assert.equal(el.corrigirHora.value,'08:00')
 el.corrigirOperador.value='OUTRO';el.corrigirOperador.onchange();el.corrigirOutro.value='OPERADOR NOVO'
 el.corrigirResponsavel.value='ANDY';el.corrigirMotivoTipo.value='Operador incorreto'
 await el.formCorrigirInicio.onsubmit({preventDefault(){}})
 assert.equal((await resultado).trabalho.versao,3)
 assert.deepEqual(chamadas[0],{url:'/cortes/929/trabalhos/12',body:{operador:'OPERADOR NOVO',turno:'1º TURNO',data:'2026-11-17',hora_inicio:'08:00',versao:2,responsavel:'ANDY',motivo:'Operador incorreto'}})
})
test('erro mantém o editor e os campos para tentar novamente, sem fechar como sucesso',async()=>{
 const resultado=modulo.editarInicio(inicio);put=async()=>{throw new Error('Conflito de versão')}
 el.corrigirResponsavel.value='ANDY';el.corrigirMotivoTipo.value='Data ou horário incorreto'
 await el.formCorrigirInicio.onsubmit({preventDefault(){}})
 assert.equal(el.dialogCorrigirInicio.open,true);assert.equal(el.corrigirHora.value,'08:00')
 el.fecharCorrigirInicio.onclick();assert.equal(await resultado,false)
})
test('cancelamento pede justificativa e envia versão, desistência não faz gravação',async()=>{
 assert.equal(await modulo.cancelarInicio(inicio),false);assert.equal(chamadas.length,0)
 justificar=async()=>({responsavel:'ANDY',motivo:'Início duplicado'})
 await modulo.cancelarInicio(inicio)
 assert.deepEqual(chamadas[0],{url:'/cortes/929/trabalhos/12',body:{responsavel:'ANDY',motivo:'Início duplicado',versao:2}})
})

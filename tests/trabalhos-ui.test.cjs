const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,elementos,consulta,confirmacao,observador,seq=0
const t={id:1,numero_corte:929,mesa:'MESA 1',operador:'TESTE',turno:'1º TURNO',data:'2026-11-17',hora_inicio:'08:10',producao_base_id:8,folha_inicio:12}
function elemento(){
 const classes=new Set()
 return {value:'',textContent:'',hidden:false,disabled:false,children:[],options:[],classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),contains:c=>classes.has(c)},
 replaceChildren(...c){this.children=c},append(...c){this.children.push(...c)},focus(){this.focado=true},addEventListener(){},reportValidity(){return false}}
}
beforeEach(async()=>{
 elementos=Object.fromEntries(['numeroCorteSelecionado','data','turno','operador','operadorOutro','horaInicio','preencherHoraInicio','secaoProducao','trabalhoSelecionado','trabalhoSelecionadoResumo','horaFim','folhaInicio','folhaParouInput','statusProducao','painelTrabalhos','cancelarTrabalho','atualizarTrabalhos','trabalhoPendente','escolhaTrabalho','conferenciaInicio','trabalhoInicioResumo','trabalhoInicioHorario','inicioRealData','inicioRealHora','camposInicioReal','usarInicioTrabalho','corrigirInicioTrabalho','limparProducao','assumirInicioReal','assumirCamposReais','assumirDataReal','assumirHoraReal'].map(id=>[id,elemento()]))
 elementos.numeroCorteSelecionado.textContent='929'
 elementos.operador.options=[{value:'TESTE'},{value:'OUTRO'}]
 consulta=async()=>({trabalhos:[{...t}]});confirmacao=async()=>true
 globalThis.document={getElementById:id=>elementos[id],createElement:elemento}
 globalThis.window={addEventListener(){}}
 globalThis.MutationObserver=class{constructor(fn){observador=fn}observe(){}}
 globalThis.__trabalhosTeste={apiGet:(...a)=>consulta(...a),apiPost:()=>{},mostrarToast(){},confirmarAcao:(...a)=>confirmacao(...a),inicializarControleMesas(){}}
 const codigo=fs.readFileSync('src/public/js/pages/index/trabalhos.js','utf8').replace(/^import[^\n]*\n/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,apiPost,mostrarToast,confirmarAcao,inicializarControleMesas}=globalThis.__trabalhosTeste;\n'+codigo).toString('base64')}#${++seq}`)
 modulo.inicializarTrabalhos({buscarCorte:async()=>{},carregarCortesEmAndamento:async()=>{}})
})
test('concluir mantém o dia e o início originais, atualiza folha e pede o término real',async()=>{
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.painelTrabalhos.hidden,false)
 await elementos.usarInicioTrabalho.onclick()
 assert.equal(elementos.data.value,'2026-11-17');assert.equal(elementos.horaInicio.value,'08:10')
 assert.equal(elementos.folhaInicio.value,12);assert.equal(elementos.horaFim.value,'')
 assert.equal(elementos.operador.disabled,true);assert.equal(elementos.horaInicio.disabled,true)
 assert.deepEqual(modulo.dadosTrabalho(),{trabalho_id:1,producao_base_id:8})
 assert.match(elementos.trabalhoSelecionadoResumo.textContent,/TESTE.*MESA 1.*17\/11\/2026/)
})
test('cancelar a conferência preserva os campos sem selecionar trabalho',async()=>{
 elementos.horaFim.value='17:00';confirmacao=async()=>false
 await modulo.atualizarTrabalhos();await elementos.usarInicioTrabalho.onclick()
 assert.equal(elementos.horaFim.value,'17:00');assert.deepEqual(modulo.dadosTrabalho(),{})
})
test('trocar de corte durante a reconsulta não preenche dados do corte anterior',async()=>{
 await modulo.atualizarTrabalhos()
 consulta=async()=>{elementos.numeroCorteSelecionado.textContent='930';return {trabalhos:[t]}}
 await elementos.usarInicioTrabalho.onclick()
 assert.deepEqual(modulo.dadosTrabalho(),{});assert.equal(elementos.data.value,'')
})
test('atualização do mesmo corte mantém o início selecionado e troca de corte desfaz seleção',async()=>{
 await observador();await modulo.atualizarTrabalhos()
 await elementos.usarInicioTrabalho.onclick()
 observador();assert.equal(modulo.dadosTrabalho().trabalho_id,1)
 elementos.numeroCorteSelecionado.textContent='930';observador()
 assert.deepEqual(modulo.dadosTrabalho(),{});assert.equal(elementos.data.disabled,false)
})

test('início real só aparece quando solicitado e segue junto com a produção',async()=>{
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.camposInicioReal.hidden,true)
 assert.equal(elementos.secaoProducao.classList.contains('aguardando-inicio'),true)
 elementos.corrigirInicioTrabalho.onclick()
 assert.equal(elementos.camposInicioReal.hidden,false)
 elementos.inicioRealData.value='2026-11-16';elementos.inicioRealHora.value='07:30'
 await elementos.usarInicioTrabalho.onclick()
 assert.equal(elementos.data.value,'2026-11-16');assert.equal(elementos.horaInicio.value,'07:30')
 assert.equal(modulo.dadosTrabalho().corrigir_inicio,true)
 assert.equal(elementos.conferenciaInicio.hidden,true)
 assert.equal(elementos.secaoProducao.classList.contains('aguardando-inicio'),false)
})

test('atualizar após confirmar mantém os campos finais em preenchimento',async()=>{
 await modulo.atualizarTrabalhos();await elementos.usarInicioTrabalho.onclick()
 elementos.horaFim.value='17:30';elementos.folhaParouInput.value='40'
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.horaFim.value,'17:30');assert.equal(elementos.folhaParouInput.value,'40')
 assert.equal(elementos.conferenciaInicio.hidden,true)
})

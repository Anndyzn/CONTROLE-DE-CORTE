const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,elementos,consulta,confirmacao,observador,resumo,postar,editar,cancelar,configRascunho,seq=0
const t={id:1,numero_corte:929,mesa:'MESA 1',operador:'TESTE',turno:'1º TURNO',data:'2026-11-17',hora_inicio:'08:10',producao_base_id:8,folha_inicio:12}
function elemento(){
 const classes=new Set()
 return {value:'',textContent:'',hidden:false,disabled:false,children:[],options:[],style:{},classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),contains:c=>classes.has(c)},
 replaceChildren(...c){this.children=c;this.options=c},append(...c){this.children.push(...c)},focus(){this.focado=true},addEventListener(){},reportValidity(){return false}}
}
beforeEach(async()=>{
 const memoria=new Map()
 globalThis.localStorage={getItem:k=>memoria.get(k)??null,setItem:(k,v)=>memoria.set(k,v)}
 elementos=Object.fromEntries(['numeroCorteSelecionado','data','turno','operador','operadorOutro','horaInicio','preencherHoraInicio','secaoProducao','trabalhoSelecionado','trabalhoSelecionadoResumo','horaFim','folhaInicio','folhaParouInput','statusProducao','painelTrabalhos','cancelarTrabalho','atualizarTrabalhos','trabalhoPendente','escolhaTrabalho','conferenciaInicio','trabalhoInicioResumo','trabalhoInicioHorario','inicioRealData','inicioRealHora','camposInicioReal','usarInicioTrabalho','corrigirInicioTrabalho','limparProducao','assumirInicioReal','assumirCamposReais','assumirDataReal','assumirHoraReal'].map(id=>[id,elemento()]))
 elementos.numeroCorteSelecionado.textContent='929'
 for(const id of ['painelAssumirCorte','estadoInicioTrabalho','assumirCorteSelecionado','recarregarInicioTrabalho','dialogAssumir','assumirOperador','assumirTurno','assumirTitulo','assumirOutro','cancelarInicioPendente','corrigirInicioConfirmado','cancelarInicioConfirmado'])elementos[id]=elemento()
 elementos.operador.options=[{value:'TESTE'},{value:'OUTRO'}]
 elementos.turno.options=[{value:'1º TURNO'}]
 for(const option of [...elementos.operador.options,...elementos.turno.options])option.cloneNode=()=>({...option})
 resumo={corte:{numero:929,mesa:'MESA 1',itens_finalizados:0},ultima_producao:null}
 postar=async()=>({novo:true,trabalho:t})
 consulta=async()=>({trabalhos:[{...t}]});confirmacao=async()=>true
 editar=async()=>false;cancelar=async()=>false
 globalThis.document={getElementById:id=>elementos[id],createElement:elemento,querySelector:()=>null}
 globalThis.window={addEventListener(){}}
 globalThis.MutationObserver=class{constructor(fn){observador=fn}observe(){}}
 globalThis.__trabalhosTeste={apiGet:(url)=>url.endsWith('/resumo')?Promise.resolve(resumo):consulta(url),apiPost:(...a)=>postar(...a),mostrarToast(){},confirmarAcao:(...a)=>confirmacao(...a),inicializarControleMesas(){},configurarRascunhoTrabalho:c=>{configRascunho=c},salvarRascunhoGrupo(){},versaoRascunho:()=>null,limparRascunhoGrupo(){},editarInicio:(...a)=>editar(...a),cancelarInicio:(...a)=>cancelar(...a)}
 const codigo=fs.readFileSync('src/public/js/pages/index/trabalhos.js','utf8').replace(/^import[^\n]*\n/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,apiPost,mostrarToast,confirmarAcao,inicializarControleMesas,configurarRascunhoTrabalho,salvarRascunhoGrupo,versaoRascunho,limparRascunhoGrupo,editarInicio,cancelarInicio}=globalThis.__trabalhosTeste;\n'+codigo).toString('base64')}#${++seq}`)
 modulo.inicializarTrabalhos({buscarCorte:async()=>{},carregarCortesEmAndamento:async()=>{}})
})
test('concluir mantém o dia e o início originais, atualiza folha e pede o término real',async()=>{
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.painelTrabalhos.hidden,false)
 await elementos.usarInicioTrabalho.onclick()
 assert.equal(elementos.data.value,'2026-11-17');assert.equal(elementos.horaInicio.value,'08:10')
 assert.equal(elementos.folhaInicio.value,12);assert.equal(elementos.horaFim.value,'')
 assert.equal(elementos.operador.disabled,true);assert.equal(elementos.horaInicio.disabled,true)
 assert.deepEqual(modulo.dadosTrabalho(),{trabalho_id:1,trabalho_versao:0,producao_base_id:8})
 assert.match(elementos.trabalhoSelecionadoResumo.textContent,/TESTE.*MESA 1.*17\/11\/2026/)
})

test('assumir sugere o ultimo operador e turno sem reaproveitar horarios reais',async()=>{
 localStorage.setItem('controle-corte.ultimo-inicio',JSON.stringify({operador:'TESTE',turno:t.turno}))
 consulta=async()=>({trabalhos:[]});await modulo.atualizarTrabalhos()
 let chamadas=0;postar=async()=>{chamadas++;return {novo:true}}
 elementos.dialogAssumir.showModal=()=>{
   assert.equal(elementos.assumirOperador.value,'TESTE');assert.equal(elementos.assumirTurno.value,t.turno)
   assert.equal(elementos.assumirInicioReal.checked,false);assert.equal(elementos.assumirHoraReal.value,'')
   elementos.dialogAssumir.returnValue='cancelar';elementos.dialogAssumir.onclose()
 }
 await elementos.assumirCorteSelecionado.onclick();assert.equal(chamadas,0)
})

test('outro operador e lembrado somente apos assumir com sucesso',async()=>{
 consulta=async()=>({trabalhos:[]});await modulo.atualizarTrabalhos()
 elementos.dialogAssumir.showModal=()=>{
   elementos.assumirOperador.value='OUTRO';elementos.assumirOutro.value='NOVA PESSOA';elementos.assumirTurno.value=t.turno
   elementos.dialogAssumir.returnValue='assumir';elementos.dialogAssumir.onclose()
 }
 postar=async()=>{throw Error('Falha de rede')}
 await elementos.assumirCorteSelecionado.onclick();assert.equal(localStorage.getItem('controle-corte.ultimo-inicio'),null)
 postar=async()=>({novo:true,trabalho:t})
 await elementos.assumirCorteSelecionado.onclick()
 assert.equal(JSON.parse(localStorage.getItem('controle-corte.ultimo-inicio')).operador,'NOVA PESSOA')
 elementos.dialogAssumir.showModal=()=>{
   assert.equal(elementos.assumirOperador.value,'OUTRO');assert.equal(elementos.assumirOutro.value,'NOVA PESSOA')
   assert.equal(elementos.assumirOutro.hidden,false);assert.equal(elementos.assumirOutro.required,true)
   elementos.dialogAssumir.returnValue='cancelar';elementos.dialogAssumir.onclose()
 }
 await elementos.assumirCorteSelecionado.onclick()
})

test('armazenamento bloqueado nao impede assumir e nao preenche dados por engano',async()=>{
 globalThis.localStorage={getItem(){throw Error('Bloqueado')},setItem(){throw Error('Bloqueado')}}
 consulta=async()=>({trabalhos:[]});await modulo.atualizarTrabalhos()
 let enviou=false;postar=async()=>{enviou=true;return {novo:true,trabalho:t}}
 elementos.dialogAssumir.showModal=()=>{
   assert.equal(elementos.assumirOperador.value,'');assert.equal(elementos.assumirTurno.value,'')
   elementos.assumirOperador.value='TESTE';elementos.assumirTurno.value=t.turno
   elementos.dialogAssumir.returnValue='assumir';elementos.dialogAssumir.onclose()
 }
 await elementos.assumirCorteSelecionado.onclick();assert.equal(enviou,true)
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

test('corrigir início preserva os campos finais e passa a usar a nova versão',async()=>{
 await modulo.atualizarTrabalhos()
 await elementos.usarInicioTrabalho.onclick()
 elementos.horaFim.value='17:00';elementos.folhaParouInput.value='50'
 const corrigido={...t,versao:1,data:'2026-11-16',hora_inicio:'07:30',operador:'ANA'}
 editar=async inicio=>{assert.equal(inicio.id,1);consulta=async()=>({trabalhos:[corrigido]});return {trabalho:corrigido}}
 await elementos.corrigirInicioConfirmado.onclick()
 assert.equal(elementos.data.value,'2026-11-16');assert.equal(elementos.horaInicio.value,'07:30')
 assert.equal(modulo.dadosTrabalho().trabalho_versao,1)
 assert.equal(elementos.horaFim.value,'17:00');assert.equal(elementos.folhaParouInput.value,'50')
 assert.equal(elementos.conferenciaInicio.hidden,true)
 assert.equal(elementos.secaoProducao.classList.contains('aguardando-inicio'),false)
})

test('restaura somente finais do mesmo trabalho e versão usando o início validado pelo servidor',async()=>{
 const draft={base:{id:'8',folha:12,trabalho:{id:'1',versao:0}},campos:{horaFim:'17:30',folhaParouInput:'60',statusProducao:'EM PRODUÇÃO',operador:'NOME ADULTERADO'}}
 assert.equal(await modulo.restaurarRascunhoTrabalho('929',draft),true)
 assert.equal(elementos.operador.value,'TESTE');assert.equal(elementos.horaFim.value,'17:30')
 assert.equal(elementos.folhaParouInput.value,'60');assert.equal(configRascunho.obterContexto().id,'1')
})

test('rascunho antigo não sobrescreve trabalho corrigido nem uma folha inicial alterada',async()=>{
 const draft={base:{id:'8',folha:12,trabalho:{id:'1',versao:0}},campos:{horaFim:'17:30'}}
 consulta=async()=>({trabalhos:[{...t,versao:1}]})
 assert.equal(await modulo.restaurarRascunhoTrabalho('929',draft),false)
 consulta=async()=>({trabalhos:[{...t,folha_inicio:20}]})
 assert.equal(await modulo.restaurarRascunhoTrabalho('929',draft),false)
 consulta=async()=>({trabalhos:[]})
 assert.equal(await modulo.restaurarRascunhoTrabalho('929',draft),false)
 assert.equal(elementos.horaFim.value,'')
})

test('cancelar um início libera assumir novamente e limpa somente o lançamento cancelado',async()=>{
 await modulo.atualizarTrabalhos();await elementos.usarInicioTrabalho.onclick()
 elementos.horaFim.value='17:00'
 cancelar=async()=>{consulta=async()=>({trabalhos:[]});return {trabalho:{...t,status:'CANCELADO'}}}
 await elementos.cancelarInicioConfirmado.onclick()
 assert.equal(elementos.horaFim.value,'');assert.deepEqual(modulo.dadosTrabalho(),{})
 assert.equal(elementos.assumirCorteSelecionado.disabled,false)
})

test('atualizar após confirmar mantém os campos finais em preenchimento',async()=>{
 await modulo.atualizarTrabalhos();await elementos.usarInicioTrabalho.onclick()
 elementos.horaFim.value='17:30';elementos.folhaParouInput.value='40'
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.horaFim.value,'17:30');assert.equal(elementos.folhaParouInput.value,'40')
 assert.equal(elementos.conferenciaInicio.hidden,true)
})

test('sem início oferece somente assumir e registra o início antes de liberar a conclusão',async()=>{
 consulta=async()=>({trabalhos:[]})
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.painelAssumirCorte.hidden,false)
 assert.equal(elementos.assumirCorteSelecionado.disabled,false)
 assert.equal(elementos.painelTrabalhos.hidden,true)
 assert.deepEqual(modulo.dadosTrabalho(),{})
 elementos.dialogAssumir.showModal=()=>{
  elementos.assumirOperador.value='TESTE';elementos.assumirTurno.value='1º TURNO'
  elementos.dialogAssumir.returnValue='assumir';elementos.dialogAssumir.onclose()
 }
 postar=async(url,body)=>{
  assert.equal(url,'/cortes/929/trabalhos');assert.deepEqual(body,{operador:'TESTE',turno:'1º TURNO'})
  consulta=async()=>({trabalhos:[t]});return {novo:true,trabalho:t}
 }
 await elementos.assumirCorteSelecionado.onclick()
 assert.equal(elementos.painelAssumirCorte.hidden,true)
 assert.equal(elementos.conferenciaInicio.hidden,false)
 assert.deepEqual(modulo.dadosTrabalho(),{})
 await elementos.usarInicioTrabalho.onclick()
 assert.equal(modulo.dadosTrabalho().trabalho_id,1)
})

test('produção finalizada não oferece assumir nem permite retomar um início antigo',async()=>{
 resumo.ultima_producao={status:'FINALIZADO'}
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.assumirCorteSelecionado.hidden,true)
 assert.equal(elementos.painelTrabalhos.hidden,true)
 assert.match(elementos.estadoInicioTrabalho.textContent,/finalizada/)
 assert.deepEqual(modulo.dadosTrabalho(),{})
})

test('falha na consulta bloqueia assumir e permite tentar novamente',async()=>{
 consulta=async()=>{throw new Error('Falha de rede')}
 await modulo.atualizarTrabalhos()
 assert.equal(elementos.assumirCorteSelecionado.disabled,true)
 assert.equal(elementos.recarregarInicioTrabalho.hidden,false)
 assert.deepEqual(modulo.dadosTrabalho(),{})
})

test('alterar início exige nova confirmação para salvar',async()=>{
 await modulo.atualizarTrabalhos();await elementos.usarInicioTrabalho.onclick()
 elementos.cancelarTrabalho.onclick()
 assert.deepEqual(modulo.dadosTrabalho(),{})
 await elementos.usarInicioTrabalho.onclick()
 assert.equal(modulo.dadosTrabalho().trabalho_id,1)
})

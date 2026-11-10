const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,botao,estado,abrir,get,ocupado,seq=0
beforeEach(async()=>{
 botao={eventos:{},addEventListener(n,f){this.eventos[n]=f}};estado={};abrir=[];ocupado=false
 globalThis.document={getElementById:id=>id==='proximoPendenteSankhya'?botao:estado,querySelector:()=>ocupado?{}:null}
 get=async()=>({cortes:[{numero:950,situacao:'EM_ANDAMENTO'},{numero:949,situacao:'PENDENTE'},{numero:948,situacao:'LANCADO'},{numero:947,situacao:'SEM_VINCULO'}]})
 globalThis.__proximoGet=()=>get()
 const fonte=fs.readFileSync('src/public/js/pages/sankhya/proximo.js','utf8').replace(/^import .*$/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const apiGet=()=>globalThis.__proximoGet();\n'+fonte).toString('base64')}#${++seq}`)
 modulo.inicializarProximoPendente(()=>949,n=>abrir.push(n))
})
test('pula corte atual, lançados e cortes em andamento; abre o mais antigo elegível sem marcar nada',async()=>{
 await botao.eventos.click();assert.deepEqual(abrir,[947]);assert.equal(botao.disabled,false)
})
test('aguarda gravação em andamento e informa quando não há outro pendente',async()=>{
 ocupado=true;await botao.eventos.click();assert.deepEqual(abrir,[]);assert.match(estado.textContent,/Aguarde/)
 ocupado=false;get=async()=>({cortes:[{numero:949,situacao:'PENDENTE'}]})
 await botao.eventos.click();assert.match(estado.textContent,/Não há outro/);assert.deepEqual(abrir,[])
})
test('falha de consulta não navega e libera nova tentativa',async()=>{
 get=async()=>{throw Error('Sem conexão')}
 await botao.eventos.click();assert.match(estado.textContent,/Sem conexão/);assert.equal(botao.disabled,false);assert.deepEqual(abrir,[])
})

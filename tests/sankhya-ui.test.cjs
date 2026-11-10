const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let els,obter,chamadas,mostrados,copiar,moduloSeq=0
class E {
 constructor(){this.value='';this.children=[];this.eventos={}}
 append(...itens){this.children.push(...itens)}
 replaceChildren(...itens){this.children=itens}
 addEventListener(n,f){this.eventos[n]=f}
 reportValidity(){return true}
 focus(){}
 select(){this.selecionado=true}
}
beforeEach(async()=>{
 els={};chamadas=[];mostrados=[]
 for(const id of ['estadoSankhya','copiaManualSankhya','textoCopiaSankhya'])els[id]=new E()
 globalThis.document={getElementById:id=>els[id],createElement:()=>new E()}
 globalThis.window={location:{search:''}}
 obter=async u=>u==='/sankhya/cortes'?[{numero:932,produto:'EDREDON'}]:u==='/sankhya/catalogo'?{produtos:[]}:{corte:{numero:932,produto:'EDREDON'},itens:[]}
 globalThis.__simples={apiGet:u=>{chamadas.push(u);return obter(u)},mostrarToast(){},inicializarNomenclaturasSankhya(){},mostrarCodigosCorte:async(d,c,fn)=>{mostrados.push(d);copiar=fn},limparCodigosCorte(){}}
 await importarTela()
})
async function importarTela(){
 const codigo=fs.readFileSync('src/public/js/pages/sankhya/main.js','utf8').replace(/^import .*$/gm,'')
 await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,mostrarToast,inicializarNomenclaturasSankhya,mostrarCodigosCorte,limparCodigosCorte}=globalThis.__simples;const inicializarAcompanhamentoSankhya=()=>{};const inicializarProximoPendente=()=>{};\n'+codigo).toString('base64')}#${++moduloSeq}`)
 await new Promise(r=>setImmediate(r))
}
const buscar=()=>{window.location.search='?corte=932';return importarTela()}
test('consulta e exibe produtos sem exigir editor, confirmação ou Excel',async()=>{
 await buscar()
 assert.equal(mostrados[0].corte.numero,932)
 assert.match(els.estadoSankhya.textContent,/Corte 932/)
 assert.ok(chamadas.every(u=>!u.includes('/excel')))
})
test('copia apenas código e oferece seleção manual se clipboard falhar',async()=>{
 await buscar();const valores=[]
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async t=>valores.push(t)}}})
 await copiar('6086');assert.deepEqual(valores,['6086'])
 navigator.clipboard.writeText=async()=>{throw Error('Bloqueado')}
 await copiar('6086');assert.equal(els.textoCopiaSankhya.value,'6086');assert.equal(els.textoCopiaSankhya.selecionado,true)
})
test('falha limpa resultado e permite nova consulta, sem gravações',async()=>{
 obter=async()=>{throw Error('Corte não encontrado')}
 await buscar();assert.match(els.estadoSankhya.textContent,/não encontrado/)
 assert.equal(mostrados.length,0)
})
test('tela sem corte não consulta lista antiga nem depende de formulário de busca',()=>{
 assert.deepEqual(chamadas,[])
 assert.equal(mostrados.length,0)
})

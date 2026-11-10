const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
class E{constructor(){this.children=[];this.eventos={}}append(...e){this.children.push(...e)}replaceChildren(...e){this.children=e}addEventListener(n,f){this.eventos[n]=f}setAttribute(k,v){this[k]=v}}
test('filtros mantêm histórico fora da fila e atalho leva ao vínculo certo',async()=>{
 const els={}
 for(const id of ['listaAcompanhamentoSankhya','estadoAcompanhamentoSankhya','nomesSemVinculoSankhya','atualizarAcompanhamentoSankhya','pendentesSankhya','lancadosSankhya','todosSankhya'])els[id]=new E()
 globalThis.document={getElementById:id=>els[id],createElement:()=>new E()};globalThis.window={addEventListener(){}}
 globalThis.__acompGet=async()=>({cortes:[{numero:940,produto:'EDREDON',situacao:'PENDENTE',total:2,lancados:1},{numero:941,produto:'CONJUNTO',situacao:'LANCADO',total:2,lancados:2}],faltantes:[{nome:'EDREDON LISO',cortes:[940]}]})
 const codigo=fs.readFileSync('src/public/js/core/acompanhamento-sankhya.js','utf8').replace(/^import .*$/gm,'')
 const m=await import(`data:text/javascript;base64,${Buffer.from('const apiGet=u=>globalThis.__acompGet(u);\n'+codigo).toString('base64')}`)
 m.inicializarAcompanhamentoSankhya();await new Promise(r=>setImmediate(r))
 assert.equal(els.listaAcompanhamentoSankhya.children.length,1)
 assert.equal(els.listaAcompanhamentoSankhya.children[0].href,'sankhya.html?corte=940')
 assert.match(els.listaAcompanhamentoSankhya.children[0].children[1].textContent,/1\/2/)
 els.lancadosSankhya.eventos.click();assert.equal(els.listaAcompanhamentoSankhya.children[0].href,'sankhya.html?corte=941')
 els.todosSankhya.eventos.click();assert.equal(els.listaAcompanhamentoSankhya.children.length,2)
 assert.equal(els.nomesSemVinculoSankhya.children[0].href,'sankhya.html?vincular=EDREDON%20LISO')
})

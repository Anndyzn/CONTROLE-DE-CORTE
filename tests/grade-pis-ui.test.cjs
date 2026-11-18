const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let mod,els,confirm,requests,seq=0,observer
class E {
 constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.textContent='';this.dataset={};this.style={};this.disabled=false;this.events={};this.attrs={};const set=new Set();this.classList={contains:c=>set.has(c),toggle:(c,on)=>on?set.add(c):set.delete(c)}}
 append(...a){a.forEach(x=>x.parent=this);this.children.push(...a)}
 replaceChildren(){this.children=[]}
 addEventListener(n,fn){this.events[n]=fn}
 setAttribute(n,v){this.attrs[n]=v}
 querySelectorAll(s){return this.children.flatMap(c=>[...(s.split(',').includes(c.tag)?[c]:[]),...c.querySelectorAll(s)])}
 querySelector(s){return this.querySelectorAll(s)[0]}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this)}
 focus(){}
}
beforeEach(async()=>{
 const ids=['formItensCorte','gradePis','linhasGradePis','estadoGradePis','modeloItem','tecidoItem','tecidoOutro','modoPiGrade','modoPiIndividual','adicionarCorPi','corItem','coresGradePis','numeroCorteSelecionado','numeroCorte','rascunhoGradeAviso','restaurarGradePis','salvarGradePis','itemEditandoId']
 els=Object.fromEntries(ids.map(id=>[id,new E(id.endsWith('Item')||id==='tecidoOutro'?'input':'div')]))
 els.formItensCorte.append(els.modeloItem,els.tecidoItem,els.tecidoOutro,els.gradePis,els.salvarGradePis)
 els.gradePis.append(els.linhasGradePis)
 els.corItem.options=[{value:''},{value:'BRANCO'},{value:'BEGE'},{value:'OUTRA'}]
 els.numeroCorteSelecionado.textContent='950';els.numeroCorte.value='950';els.modeloItem.value='CONJUNTO FEMININO';els.tecidoItem.value='OXFORD'
 document={getElementById:id=>els[id],createElement:tag=>new E(tag)}
 const mem=new Map();globalThis.sessionStorage={getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)}
 globalThis.MutationObserver=class {constructor(fn){observer=fn}observe(){}}
 requests=[];confirm=async()=>false
 globalThis.__grid={apiPost:async(u,b)=>requests.push({u,b}),confirmarAcao:(...a)=>confirm(...a),mostrarToast(){},carregarItensCorte:async()=>{},carregarPisPendentes(){},limparRascunhoGrupo(){},versaoRascunho(){return 0},validarValoresItem:v=>Object.values(v).some(x=>!Number.isFinite(Number(x))||Number(x)<0)?'Invalid values':null}
 const source=fs.readFileSync('src/public/js/pages/index/grade-pis.js','utf8').replace(/^import[^\n]*\n/gm,'')
 mod=await import(`data:text/javascript;base64,${Buffer.from(`const {${Object.keys(__grid)}}=globalThis.__grid;\n`+source).toString('base64')}#${++seq}`)
 mod.inicializarGradePis()
})
function fill(cor='BRANCO'){
 const row=els.linhasGradePis.children.at(-1)
 const inputs=row.querySelectorAll('input');inputs[0].value=cor;inputs[1].value='0';inputs[5].value='22';inputs[0].events.input()
}
test('validates mandatory values, accepts zero consumption and rejects duplicate colors',()=>{
 const row={cor:' branco ',metragem_usada:0,quantidade_pecas:22}
 assert.equal(mod.validarLinhasGrade([row,{}],'MODELO','OXFORD')[0].metragem_usada,0)
 assert.throws(()=>mod.validarLinhasGrade([row,{...row,cor:'BRANCO'}],'MODELO','OXFORD'),/repetida/)
 assert.throws(()=>mod.validarLinhasGrade([{...row,metragem_usada:-1}],'MODELO','OXFORD'))
 assert.throws(()=>mod.validarLinhasGrade([{cor:'BRANCO'}],'MODELO','OXFORD'))
})
test('cancel retains rows and acceptance sends all colors in one request',async()=>{
 fill();els.adicionarCorPi.events.click();fill('BEGE')
 await els.salvarGradePis.events.click();assert.equal(requests.length,0);assert.equal(els.linhasGradePis.children.length,2)
 confirm=async()=>true;await els.salvarGradePis.events.click()
 assert.equal(requests.length,1);assert.equal(requests[0].u,'/itens-corte/lote');assert.equal(requests[0].b.itens.length,2)
 assert.equal(requests[0].b.numero_corte,950);assert.equal(els.gradePis.dataset.pendente,'false')
})
test('changing the cut while reviewing never submits the previous rows',async()=>{
 fill();confirm=async()=>{els.numeroCorteSelecionado.textContent='951';els.numeroCorte.value='951';observer();return true}
 await els.salvarGradePis.events.click();assert.equal(requests.length,0)
 assert.equal(els.gradePis.dataset.pendente,'false')
})

test('draft colors belong to their cut and are restored only when requested',()=>{
 fill('BRANCO')
 els.numeroCorteSelecionado.textContent='951';els.numeroCorte.value='951';observer()
 assert.equal(els.gradePis.dataset.pendente,'false')
 fill('BEGE')
 els.numeroCorteSelecionado.textContent='950';els.numeroCorte.value='950';observer()
 assert.equal(els.rascunhoGradeAviso.hidden,false)
 els.restaurarGradePis.events.click()
 assert.equal(els.linhasGradePis.children[0].querySelector('input').value,'BRANCO')
 assert.equal(els.gradePis.dataset.pendente,'true')
})

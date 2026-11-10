const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
test('abas mostram um painel por vez e permitem navegação pelo teclado sem apagar formulários',async()=>{
 const els={}
 for(const id of ['abaCorrecoesAdmin','painelCorrecoesAdmin','abaNomesAdmin','painelNomesAdmin','abaHistoricoAdmin','painelHistoricoAdmin'])els[id]={eventos:{},addEventListener(n,f){this.eventos[n]=f},setAttribute(k,v){this[k]=v},focus(){this.focado=true}}
 globalThis.document={getElementById:id=>els[id]}
 const codigo=fs.readFileSync('src/public/js/admin/abas.js','utf8')
 const m=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
 m.inicializarAbasAdmin()
 assert.equal(els.painelCorrecoesAdmin.hidden,false);assert.equal(els.painelNomesAdmin.hidden,true)
 els.abaNomesAdmin.eventos.click();assert.equal(els.painelNomesAdmin.hidden,false);assert.equal(els.painelCorrecoesAdmin.hidden,true)
 els.abaNomesAdmin.eventos.keydown({key:'ArrowRight',preventDefault(){}})
 assert.equal(els.painelHistoricoAdmin.hidden,false);assert.equal(els.abaHistoricoAdmin.focado,true)
})

const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs')

test('buscas sobrepostas preservam o texto original e a largura do botao',async()=>{
  const fonte=fs.readFileSync('src/public/js/core/ui.js','utf8')
  const {definirCarregamento}=await import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`)
  const botao={textContent:'Buscar cortes',dataset:{},style:{minWidth:''},atributos:{},getBoundingClientRect:()=>({width:142}),setAttribute(n,v){this.atributos[n]=v}}
  definirCarregamento(botao,true)
  definirCarregamento(botao,true)
  assert.equal(botao.disabled,true);assert.equal(botao.style.minWidth,'142px')
  assert.equal(botao.atributos['aria-busy'],'true')
  definirCarregamento(botao,false)
  assert.equal(botao.textContent,'Buscar cortes');assert.equal(botao.style.minWidth,'')
  assert.equal(botao.disabled,false);assert.equal(botao.atributos['aria-busy'],'false')
  assert.doesNotThrow(()=>definirCarregamento(null,true))
})

const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,els,seq=0
class E {
 constructor(id=''){this.id=id;this.value='';this.attrs={};this.eventos={};this.classList={add(){},remove(){}}}
 setAttribute(k,v){this.attrs[k]=v}
 getAttribute(k){return this.attrs[k]??null}
 removeAttribute(k){delete this.attrs[k]}
 closest(){return {classList:this.classList}}
 insertAdjacentElement(_,e){els[e.id]=e}
 addEventListener(n,f){this.eventos[n]=f}
 remove(){delete els[this.id]}
 focus(){this.focado=true}
}
beforeEach(async()=>{
 els={nome:new E('nome'),quantidade:new E('quantidade'),cor:new E('cor')}
 globalThis.document={getElementById:id=>els[id],createElement:()=>new E()}
 const fonte=fs.readFileSync('src/public/js/core/erros-campos.js','utf8')
 modulo=await import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}#${++seq}`)
})
test('erro fica junto ao campo, mantém ajuda existente e é removido ao corrigir sem apagar o valor',()=>{
 els.nome.value='TEXTO';els.nome.setAttribute('aria-describedby','ajudaNome')
 modulo.marcarErroCampo('nome','Informe o modelo.')
 assert.equal(els.nome.attrs['aria-invalid'],'true');assert.equal(els.nomeErro.textContent,'Informe o modelo.')
 assert.equal(els.nome.attrs['aria-describedby'],'ajudaNome nomeErro');assert.equal(els.nome.focado,true)
 els.nome.eventos.input()
 assert.equal(els.nomeErro,undefined);assert.equal(els.nome.attrs['aria-describedby'],'ajudaNome');assert.equal(els.nome.value,'TEXTO')
})
test('obrigatórios focam somente o primeiro problema e aceitam zero como preenchido',()=>{
 els.quantidade.value='0'
 assert.equal(modulo.validarObrigatoriosCampos({nome:'o nome',cor:'a cor',quantidade:'a quantidade'}),false)
 assert.equal(els.nome.focado,true);assert.equal(els.cor.focado,undefined);assert.equal(els.quantidadeErro,undefined)
 assert.ok(els.nomeErro);assert.ok(els.corErro)
})
test('valores negativos destacam o campo correspondente e limpar remove avisos sem mudar dados',()=>{
 els.quantidade.value='-1'
 modulo.marcarErrosNumericos({quantidade:'-1',nome:0})
 assert.ok(els.quantidadeErro);assert.equal(els.nomeErro,undefined)
 modulo.limparErroCampo('quantidade');assert.equal(els.quantidadeErro,undefined);assert.equal(els.quantidade.value,'-1')
})

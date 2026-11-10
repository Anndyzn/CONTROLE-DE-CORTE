const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let modulo,resumo,obter,chamadas,sequencia=0
class Elemento{
  constructor(tag='div'){this.tag=tag;this.children=[];this.textContent=''}
  append(...filhos){for(const filho of filhos){filho.parent=this;this.children.push(filho)}}
  remove(){this.parent.children=this.parent.children.filter(c=>c!==this)}
  querySelector(seletor){return this.children.find(c=>c.className===seletor.slice(1))}
  setAttribute(nome,valor){this[nome]=valor}
}
const item=(id=1)=>({id,modelo:'CONJUNTO FEMININO',cor:'BRANCO',tecido:'OXFORD'})
const destinos=[{codigo_produto:6073,produto:'PI BLAZER',controle:'BRANCO'},{codigo_produto:6069,produto:'PI VESTIDO',controle:'BRANCO'}]
const linhas=()=>[{cells:[new Elemento('td')]},{cells:[new Elemento('td')]}]
const bloco=(linhas,indice=0)=>linhas[indice].cells[0].children[0]
beforeEach(async()=>{
  resumo=new Elemento();chamadas=[]
  obter=async()=>({itens:[{...item(),correspondencia:{destinos}},{...item(2),correspondencia:null}]})
  globalThis.document={getElementById:id=>id==='resumoVinculosPIs'?resumo:null,createElement:tag=>new Elemento(tag)}
  globalThis.__vinculosDeps={apiGet:url=>{chamadas.push(url);return obter(url)}}
  const codigo=fs.readFileSync('src/public/js/pages/index/vinculos.js','utf8').replace(/^import .*$/gm,'')
  modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet}=globalThis.__vinculosDeps;\n'+codigo).toString('base64')}#${++sequencia}`)
})
test('mostra vários destinos e link direto ao PI, sem indicar que foi lançado no ERP',async()=>{
  const l=linhas();await modulo.atualizarVinculosPIs(922,[item(),item(2)],l)
  assert.match(bloco(l).children[0].textContent,/2 produto/)
  assert.match(resumo.textContent,/1 de 2/)
  assert.match(resumo.textContent,/não informa se a OP já foi lançada/)
  const link=bloco(l).children[2]
  assert.equal(link.href,'sankhya.html?corte=922&item=1');assert.equal(link.target,'_blank')
  assert.equal(link.rel,'noopener noreferrer')
  assert.equal(bloco(l).children[1].children[0].children[1].children.length,2)
  assert.equal(bloco(l,1).children[0].textContent,'Falta vincular ao Sankhya')
})
test('falha da consulta é diferente de ausência de correspondência e conserva o atalho',async()=>{
  obter=async()=>{throw new Error('Indisponível')}
  const l=linhas();await modulo.atualizarVinculosPIs(922,[item()],l)
  assert.match(bloco(l).children[0].textContent,/indisponível/)
  assert.match(resumo.textContent,/PIs foram carregados/)
  assert.ok(bloco(l).children[2].href)
})
test('resposta antiga ou contexto cancelado não altera resumo nem novos vínculos',async()=>{
  let resolver
  obter=()=>new Promise(resolve=>{resolver=resolve})
  const primeira=modulo.atualizarVinculosPIs(921,[item()],linhas())
  obter=async()=>({itens:[{...item(2),correspondencia:null}]})
  await modulo.atualizarVinculosPIs(922,[item(2)],linhas())
  const atual=resumo.textContent
  resolver({itens:[{...item(),correspondencia:{destinos}}]});await primeira
  assert.equal(resumo.textContent,atual)
  const l=linhas();await modulo.atualizarVinculosPIs(923,[item()],l,{aindaAtual:()=>false})
  assert.equal(bloco(l).children[0].textContent,'Consultando vínculo…')
})
test('item corrigido entre consultas exige atualização, sem exibir associação de outro modelo',async()=>{
  obter=async()=>({itens:[{...item(),modelo:'OUTRO MODELO',correspondencia:{destinos}}]})
  const l=linhas();await modulo.atualizarVinculosPIs(922,[item()],l)
  assert.match(bloco(l).children[0].textContent,/Item alterado/)
  assert.equal(bloco(l).children[1].children.length,0)
})
test('PI vazio não consulta e nomes de produtos são exibidos como texto',async()=>{
  await modulo.atualizarVinculosPIs(922,[],[])
  assert.equal(chamadas.length,0)
  obter=async()=>({itens:[{...item(),correspondencia:{destinos:[{codigo_produto:1,produto:'<script>nome</script>',controle:'BRANCO'}]}}]})
  const l=linhas();await modulo.atualizarVinculosPIs(922,[item()],l)
  assert.equal(bloco(l).children[1].children[0].children[1].children[0].textContent,'1 — <script>nome</script> · BRANCO')
})

test('ao voltar da aba de vínculo atualiza o item sem duplicar blocos nem consultar corte oculto',async()=>{
  let foco
  const painel={style:{display:'block'}}
  document.getElementById=id=>id==='resumoVinculosPIs'?resumo:id==='blocoItensCorte'?painel:null
  globalThis.window={addEventListener:(_,fn)=>{foco=fn}}
  modulo.inicializarVinculosPIs()
  const l=linhas();await modulo.atualizarVinculosPIs(922,[item()],l)
  assert.equal(l[0].cells[0].children.length,1)
  obter=async()=>({itens:[{...item(),correspondencia:null}]})
  await foco()
  assert.equal(l[0].cells[0].children.length,1)
  assert.match(bloco(l).children[0].textContent,/Falta vincular/)
  const total=chamadas.length;painel.style.display='none';await foco()
  assert.equal(chamadas.length,total)
})

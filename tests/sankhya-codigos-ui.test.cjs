const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let els,obter,gravar,modulo,copias,envios,mensagens,seq=0,estado
class E {
 constructor(){this.children=[];this.eventos={};this.value=''}
 append(...itens){this.children.push(...itens)}
 replaceChildren(...itens){this.children=itens}
 addEventListener(n,f){this.eventos[n]=f}
}
const catalogo={produtos:[{codigo_produto:6086,produto:'EDREDON'},{codigo_produto:6073,produto:'BLAZER'},{codigo_produto:6069,produto:'VESTIDO'}]}
const dados=()=>({corte:{numero:932,produto:'CONJUNTO'},itens:[{id:1,modelo:'CONJUNTO',cor:'BRANCO',tecido:'OXFORD',quantidade_pecas:100,metragem_usada:200}]})
beforeEach(async()=>{
 els={codigosCorteSankhya:new E(),listaCodigosCorteSankhya:new E()};copias=[];envios=[];mensagens=[]
 estado={id:1,origem:['CONJUNTO','BRANCO','OXFORD','100','200'],assinatura:'a'.repeat(64),versao:0,codigos:null,lancados:[]}
 globalThis.document={getElementById:id=>els[id],createElement:()=>new E()}
 obter=async u=>u.includes('/lancamentos')?{itens:[structuredClone(estado)]}:{nomes:[{opcoes:[{codigos:[6073],rotulo:'BLAZER'},{codigos:[6069],rotulo:'VESTIDO'}]}]}
 gravar=async b=>{estado={...estado,...b,versao:b.versao+1};return {versao:estado.versao}}
 globalThis.__codigosDeps={apiGet:u=>obter(u),apiPut:(u,b)=>{envios.push({u,b});return gravar(b)},mostrarToast:m=>mensagens.push(m)}
 const fonte=fs.readFileSync('src/public/js/pages/sankhya/codigos.js','utf8').replace(/^import .*$/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const {apiGet,apiPut,mostrarToast}=globalThis.__codigosDeps;\n'+fonte).toString('base64')}#${++seq}`)
})
const mostrar=()=>modulo.mostrarCodigosCorte(dados(),catalogo,t=>copias.push(t))
const card=()=>els.listaCodigosCorteSankhya.children[0]
const campo=()=>card().children.find(e=>e.className==='sankhya-selecao-produtos')
const linhas=()=>card().children.filter(e=>e.className==='sankhya-possibilidade')
async function marcarProduto(i,valor=true){const c=campo().children[i+1].children[0];c.checked=valor;await c.eventos.change()}
test('seleciona dois produtos na mesma cor e preserva a seleção ao reabrir',async()=>{
 await mostrar();await marcarProduto(0);await marcarProduto(1)
 assert.deepEqual(estado.codigos,[6073,6069]);assert.equal(linhas().length,2)
 linhas()[0].children[1].eventos.click();assert.deepEqual(copias,['6073'])
 await mostrar();assert.equal(linhas().length,2)
 assert.equal(campo().children[1].children[0].checked,true);assert.equal(campo().children[2].children[0].checked,true)
})
test('lançado é por produto e persiste; copiar não marca; é possível desmarcar',async()=>{
 estado.codigos=[6073,6069];await mostrar()
 linhas()[0].children[1].eventos.click();assert.equal(envios.length,0)
 let c=linhas()[0].children[2].children[0];c.checked=true;await c.eventos.change()
 assert.deepEqual(estado.lancados,[6073]);assert.deepEqual(envios[0].b.codigos,[6073,6069])
 await mostrar();assert.equal(linhas()[0].children[2].children[0].checked,true);assert.equal(linhas()[1].children[2].children[0].checked,false)
 await marcarProduto(0,false);assert.match(mensagens.at(-1),/Desmarque/);assert.equal(linhas().length,2)
 c=linhas()[0].children[2].children[0];c.checked=false;await c.eventos.change();assert.deepEqual(estado.lancados,[])
})
test('falha de gravação reverte a seleção e falha de leitura não apresenta confirmação falsa',async()=>{
 await mostrar();gravar=async()=>{throw Error('Conflito: recarregue')}
 await marcarProduto(0);assert.equal(linhas().length,0);assert.match(mensagens.at(-1),/Conflito/)
 obter=async u=>{if(u.includes('/lancamentos'))throw Error('Falha');return {nomes:[{opcoes:[{codigos:[6086],rotulo:'EDREDON'}]}]}}
 await mostrar();assert.equal(linhas()[0].children[2].children[0].disabled,true)
})
test('mudança no PI exige consulta atualizada; resposta antiga não reaparece depois de limpar',async()=>{
 estado.origem[3]='101';await mostrar();assert.match(card().children[1].textContent,/foi alterado/)
 const resolver=[];obter=()=>new Promise(r=>resolver.push(r))
 const pendente=mostrar();modulo.limparCodigosCorte()
 resolver.forEach(r=>r({nomes:[],itens:[]}));await pendente
 assert.equal(els.codigosCorteSankhya.hidden,true)
 assert.equal(els.listaCodigosCorteSankhya.children.length,0)
})

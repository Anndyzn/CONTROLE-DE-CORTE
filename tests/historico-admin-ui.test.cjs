const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
let els,modulo,obter,chamadas,seq=0
class E {
 constructor(){this.children=[];this.value='';this.eventos={}}
 append(...itens){this.children.push(...itens)}
 replaceChildren(...itens){this.children=itens}
 addEventListener(n,f){this.eventos[n]=f}
}
const conteudo=e=>[e.textContent??'',...e.children.map(conteudo)].join(' ')
const registro=(id=1)=>({id,acao:'PADRONIZACAO_PRODUTO',numero_corte:932,registro_id:932,criado_em:'2026-11-10T12:00:00Z',responsavel:'ANDY',motivo:'Corrigir grafia',antes:{produto:'EDREDON INFRIOR',mesa:'MESA 1'},depois:{produto:'EDREDON INFERIOR',mesa:'MESA 1'}})
beforeEach(async()=>{
 els={};chamadas=[]
 for(const id of ['formFiltroHistoricoAdmin','listaHistoricoAdmin','estadoHistoricoAdmin','maisHistoricoAdmin','filtroHistoricoAdmin','buscaHistoricoAdmin','tipoHistoricoAdmin','inicioHistoricoAdmin','fimHistoricoAdmin','limparHistoricoAdmin'])els[id]=new E()
 globalThis.document={createElement:()=>new E(),getElementById:id=>els[id],addEventListener(){}}
 obter=async()=>({registros:[registro()],tem_mais:false})
 globalThis.__historicoGet=u=>{chamadas.push(u);return obter(u)}
 const fonte=fs.readFileSync('src/public/js/admin/historico-admin.js','utf8').replace(/^import .*$/gm,'')
 modulo=await import(`data:text/javascript;base64,${Buffer.from('const apiGet=u=>globalThis.__historicoGet(u);\n'+fonte).toString('base64')}#${++seq}`)
})
test('nomes anteriores e novos ficam visíveis sem abrir detalhes; conteúdo é tratado como texto',()=>{
 const r=registro();r.antes.produto='<img src=x onerror=alert(1)>'
 const card=modulo.renderizarRegistroAdmin(r)
 const comparacao=card.children.find(c=>c.className==='historico-admin-dados')
 assert.match(conteudo(comparacao),/<img src=x onerror=alert\(1\)>/)
 assert.match(conteudo(comparacao),/EDREDON INFERIOR/)
 assert.match(conteudo(comparacao),/Antes.*Depois/)
 assert.equal(comparacao.children.length,1)
 assert.match(conteudo(card),/ANDY/);assert.match(conteudo(card),/Corrigir grafia/)
})
test('campos novos e dados excluídos não são omitidos; instantâneos completos permanecem consultáveis',()=>{
 const diff=modulo.dadosRegistro({novo_campo:'A',outro:{valor:1}},{novo_campo:'B',outro:{valor:2}})
 assert.equal(diff.children.length,2);assert.match(conteudo(diff),/novo campo/);assert.match(conteudo(diff),/"valor": 2/)
 const r={...registro(),acao:'EXCLUSAO_CORTE',antes:{corte:{produto:'ANTIGO'},producao:[{operador:'MARIA'}],itens:[{modelo:'VESTIDO',quantidade_pecas:200}]},depois:null}
 const card=modulo.renderizarRegistroAdmin(r)
 assert.match(conteudo(card),/ANTIGO/);assert.match(conteudo(card),/MARIA/);assert.match(conteudo(card),/200/)
})
test('paginação mantém os filtros aplicados e indica quando todo o histórico foi exibido',async()=>{
 els.buscaHistoricoAdmin.value='EDREDON';els.tipoHistoricoAdmin.value='NOMENCLATURAS';els.inicioHistoricoAdmin.value='2026-11-01'
 obter=async()=>({registros:[registro(55)],tem_mais:true})
 await modulo.carregarHistoricoAlteracoes()
 els.buscaHistoricoAdmin.value='outro texto não aplicado'
 obter=async()=>({registros:[registro(20)],tem_mais:false})
 await modulo.carregarHistoricoAlteracoes({mais:true})
 const p=new URL(chamadas[1],'http://teste').searchParams
 assert.equal(p.get('busca'),'EDREDON');assert.equal(p.get('acao'),'NOMENCLATURAS');assert.equal(p.get('antes'),'55')
 assert.equal(els.listaHistoricoAdmin.children.length,1)
 assert.match(els.estadoHistoricoAdmin.textContent,/2 alteração\(ões\) em 1 operação/)
 assert.match(els.estadoHistoricoAdmin.textContent,/Todo o histórico/)
})
test('agrupa por operação, preserva lotes antigos e não mistura operações independentes',()=>{
 const a={...registro(1),operacao_id:'lote-A'},b={...registro(2),operacao_id:'lote-A'},c={...registro(3),operacao_id:'lote-B'}
 assert.deepEqual(modulo.agruparRegistrosAdmin([a,b,c]).map(g=>g.length),[2,1])
 const antigo={...registro(4),instante_operacao:'2026-11-10 12:00:00.123456+00'}
 assert.deepEqual(modulo.agruparRegistrosAdmin([antigo,{...antigo,id:5},{...antigo,id:6,instante_operacao:'2026-11-10 12:00:00.123457+00'}]).map(g=>g.length),[2,1])
 assert.equal(modulo.agruparRegistrosAdmin([{...registro(7),acao:'EDICAO_PI'},{...registro(8),acao:'EDICAO_PI'}]).length,2)
})
test('grupo destaca nomenclaturas anteriores e nome recomendado, com registros preservados nos detalhes',()=>{
 const a=registro(1),b={...registro(2),numero_corte:933,antes:{produto:'EDREDOM INFERIOR'},depois:{produto:'EDREDON INFERIOR'}}
 const card=modulo.renderizarGrupoAdmin([a,b]),aviso=card.children.find(c=>c.className==='historico-admin-nomenclaturas')
 assert.match(conteudo(aviso),/EDREDON INFRIOR/);assert.match(conteudo(aviso),/EDREDOM INFERIOR/)
 assert.match(conteudo(aviso),/→.*EDREDON INFERIOR/)
 assert.match(conteudo(card),/2 corte\(s\) · 2 registro/)
 const detalhes=card.children.at(-1)
 assert.equal(detalhes.children.at(-1).children.length,2)
 assert.match(conteudo(detalhes),/Responsável informado: ANDY/)
 assert.ok(!card.children.slice(0,-1).some(e=>conteudo(e).includes('ANDY')))
})
test('resposta atrasada não troca lista atual; erro de novo filtro não deixa resultados antigos parecendo atuais',async()=>{
 let resolver;obter=()=>new Promise(r=>resolver=r)
 const antiga=modulo.carregarHistoricoAlteracoes()
 obter=async()=>({registros:[registro(99)],tem_mais:false})
 await modulo.carregarHistoricoAlteracoes()
 resolver({registros:[registro(1)],tem_mais:false});await antiga
 assert.equal(els.listaHistoricoAdmin.children.length,1)
 obter=async()=>{throw Error('Sem conexão')}
 await modulo.carregarHistoricoAlteracoes()
 assert.equal(els.listaHistoricoAdmin.children.length,0);assert.match(els.estadoHistoricoAdmin.textContent,/Sem conexão/)
 assert.equal(els.maisHistoricoAdmin.hidden,true)
})

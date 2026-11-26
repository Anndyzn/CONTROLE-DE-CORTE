const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')

function ambiente({home=false,salvo=null,bloquearStorage=false,estreito=false,preferencias={},reduzirMovimento=false}={}) {
  const frames=[],rolagens=[],observadores=[],storage=new Map(salvo===null?[]:[['controle-corte.menu-recolhido',salvo]])
  for(const [k,v] of Object.entries(preferencias))storage.set(k,v)
  class El {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.parentNode=null;this.className='';this.attrs=new Map();this.listeners={};this.hidden=false;this.value='';this._texto='';this.style={};this.open=false}
    get classList(){return {contains:n=>this.className.split(' ').includes(n),add:(...nomes)=>{for(const n of nomes)if(!this.classList.contains(n))this.className=(this.className+' '+n).trim()},toggle:(n,forcar)=>{const ativo=forcar??!this.classList.contains(n);this.className=this.className.split(' ').filter(x=>x&&x!==n).concat(ativo?[n]:[]).join(' ');return ativo}}}
    get attributes(){return [...this.attrs].map(([name,value])=>({name,value}))}
    setAttribute(n,v){this.attrs.set(n,String(v));if(n==='class')this.className=String(v)}
    getAttribute(n){return this.attrs.get(n)}
    get textContent(){return this._texto+this.children.map(e=>e.textContent).join('')}
    set textContent(v){this._texto=String(v);this.children.forEach(e=>e.parentNode=null);this.children=[]}
    detach(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null}}
    append(...nodes){for(const e of nodes){e.detach();e.parentNode=this;this.children.push(e)}}
    prepend(...nodes){for(const e of [...nodes].reverse()){e.detach();e.parentNode=this;this.children.unshift(e)}}
    replaceChildren(...nodes){this._texto='';this.children.forEach(e=>e.parentNode=null);this.children=[];this.append(...nodes)}
    before(...nodes){const pai=this.parentNode;for(const e of nodes){e.detach();e.parentNode=pai;pai.children.splice(pai.children.indexOf(this),0,e)}}
    replaceWith(e){const pai=this.parentNode;const i=pai.children.indexOf(this);e.detach();pai.children[i]=e;e.parentNode=pai;this.parentNode=null}
    get firstChild(){return this.children[0]??null}
    addEventListener(n,f){this.listeners[n]=f}
    scrollIntoView(opcoes){this.rolou=true;this.opcoesRolagem=opcoes}
    focus(){this.focou=true}
    querySelectorAll(seletor){const todos=this.children.flatMap(e=>[e,...e.querySelectorAll('*')]);return todos.filter(e=>seletor==='*'||(seletor[0]==='.'?e.classList.contains(seletor.slice(1)):e.tagName===seletor))}
    querySelector(s){return this.querySelectorAll(s)[0]??null}
  }
  const criar=(tag,classe,texto)=>{const e=new El(tag);e.className=classe||'';if(texto)e.textContent=texto;return e}
  const body=criar('body',home?'page-index':'page-admin'),container=criar('main','container'),nav=criar('nav','system-nav')
  body.append(container);container.append(nav)
  const links=['Início','Consultar','Sankhya','Tecidos com defeito','Admin'].map((nome,i)=>{const a=criar('a','',nome);a.href=['index.html','consultar.html','sankhya.html','tecidos.html','admin.html'][i];if(i===(home?0:4))a.setAttribute('aria-current','page');nav.append(a);return a})
  const ids={}
  if(home){
    for(const [id,classe]of [['mesas','mesas-painel'],['busca','busca-corte-card'],['corteSelecionado','corte-selecionado-card'],['numeroCorteSelecionado',''],['produto',''],['formulario','']]){ids[id]=criar('section',classe);ids[id].id=id}
    container.append(ids.mesas,ids.busca,ids.corteSelecionado,ids.formulario)
    for(const id of ['secaoProducao','blocoItensCorte','secaoHistorico','painelPisPendentes']){ids[id]=criar(id==='painelPisPendentes'?'details':'section');ids[id].id=id;container.append(ids[id])}
    ids.blocoItensCorte.style.display='none'
    const andamento=criar('details','lista-andamento');container.append(andamento)
    ids.corteSelecionado.append(ids.numeroCorteSelecionado,ids.produto);ids.corteSelecionado.hidden=true
    ids.numeroCorteSelecionado.textContent='970';ids.produto.textContent='CETIM';ids.formulario.value='18:35'
    const finalizados=criar('section','section-card finalizados-recentes-card'),cabecalho=criar('div','finalizados-cabecalho'),controle=criar('button','','Hoje')
    controle.id='periodoTeste';finalizados.append(cabecalho,controle);container.append(finalizados);ids.periodoTeste=controle
  }
  const document={body,createElement:tag=>new El(tag),querySelector:s=>s==='body > .container'?container:body.querySelector(s),getElementById:id=>body.querySelectorAll('*').find(e=>e.id===id)}
  const contexto={document,window:{scrollY:0,scrollTo:o=>rolagens.push(o),requestAnimationFrame:f=>frames.push(f),matchMedia:q=>({matches:q.includes('prefers-reduced-motion')?reduzirMovimento:estreito})},localStorage:{getItem:k=>{if(bloquearStorage)throw Error('Bloqueado');return storage.get(k)??null},setItem:(k,v)=>{if(bloquearStorage)throw Error('Bloqueado');storage.set(k,v)}},
    MutationObserver:class{constructor(fn){observadores.push(fn)}observe(){}},inicializarVisaoInicio(){},inicializarLembreteTurno(){}}
  vm.createContext(contexto)
  if(home)vm.runInContext(fs.readFileSync('src/public/js/pages/index/layout-inicio.js','utf8').replace('export function','function'),contexto)
  vm.runInContext(fs.readFileSync('src/public/js/core/layout.js','utf8').replace(/^import[^\n]*\n/gm,'').replace('export function','function'),contexto)
  return {body,container,nav,links,storage,ids,contexto,document,rolagens,quadro:()=>{while(frames.length)frames.shift()()},observar:()=>observadores.forEach(f=>f())}
}

test('menu lateral mantém links e tela ativa, recolhe/expande e lembra a preferência',()=>{
  const a=ambiente({salvo:'1'}),toggle=a.body.querySelector('.sidebar-toggle')
  assert.ok(a.body.classList.contains('menu-recolhido'));assert.equal(toggle.getAttribute('aria-expanded'),'false')
  assert.equal(a.nav.children.length,5);assert.equal(a.links[4].getAttribute('aria-current'),'page');assert.equal(a.links[3].getAttribute('aria-label'),'Tecidos com defeito')
  toggle.listeners.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(a.storage.get('controle-corte.menu-recolhido'),'0')
  a.contexto.inicializarLayout();assert.equal(a.body.querySelectorAll('.app-sidebar').length,1)
})
test('menu funciona com armazenamento bloqueado e mantém nomes acessíveis quando recolhido',()=>{
  const a=ambiente({bloquearStorage:true,estreito:true})
  assert.ok(a.body.classList.contains('menu-recolhido'));assert.equal(a.links[0].title,'Início')
  assert.doesNotThrow(()=>a.body.querySelector('.sidebar-toggle').listeners.click())
})
test('voltar às mesas e retomar preserva o preenchimento e não muda de visão em atualização silenciosa',()=>{
  const a=ambiente({home:true})
  assert.ok(a.container.children.indexOf(a.ids.busca)<a.container.children.indexOf(a.ids.mesas))
  a.ids.corteSelecionado.hidden=false;a.observar();assert.ok(a.body.classList.contains('home-em-corte'))
  a.body.querySelector('.home-voltar').listeners.click();assert.ok(!a.body.classList.contains('home-em-corte'));assert.equal(a.ids.formulario.value,'18:35')
  a.ids.produto.textContent='NOME ATUALIZADO';a.observar();assert.ok(!a.body.classList.contains('home-em-corte'))
  const retomar=a.body.querySelector('.home-retomar');assert.equal(retomar.hidden,false);assert.match(retomar.textContent,/970/)
  retomar.querySelector('button').listeners.click();assert.ok(a.body.classList.contains('home-em-corte'));assert.equal(a.ids.formulario.value,'18:35')
  a.ids.corteSelecionado.hidden=true;a.observar();assert.ok(!a.body.classList.contains('home-em-corte'));assert.equal(retomar.hidden,true)
})
test('painel recolhível de finalizados preserva os controles existentes',()=>{
  const a=ambiente({home:true}),painel=a.body.querySelector('.home-finalizados-painel')
  assert.equal(painel.tagName,'details');assert.equal(a.document.getElementById('periodoTeste'),a.ids.periodoTeste)
  assert.ok(painel.querySelector('.finalizados-cabecalho'))
})


test('retomar recupera a rolagem de cada tela e ignora restauros superados',()=>{
 const a=ambiente({home:true}),w=a.contexto.window
 w.scrollY=240;a.ids.corteSelecionado.hidden=false;a.observar()
 w.scrollY=950;a.body.querySelector('.home-voltar').listeners.click();a.quadro()
 assert.equal(a.rolagens.at(-1).top,240)
 w.scrollY=310;a.body.querySelector('.home-retomar').querySelector('button').listeners.click();a.quadro()
 assert.equal(a.rolagens.at(-1).top,950)
 w.scrollY=800;a.body.querySelector('.home-voltar').listeners.click()
 a.body.querySelector('.home-retomar').querySelector('button').listeners.click()
 const antes=a.rolagens.length;a.quadro();assert.equal(a.rolagens.length,antes+1);assert.equal(a.rolagens.at(-1).top,800)
})

test('atalhos acompanham a disponibilidade dos PIs e levam foco ao painel sem alterar campos',()=>{
 const a=ambiente({home:true,reduzirMovimento:true}),links=a.body.querySelector('.home-atalhos-corte').children
 assert.equal(links[1].hidden,true)
 a.ids.corteSelecionado.hidden=false;a.ids.blocoItensCorte.style.display='block';a.observar()
 assert.equal(links[1].hidden,false)
 let preveniu=false;links[1].listeners.click({preventDefault(){preveniu=true}})
 assert.ok(preveniu);assert.ok(a.ids.blocoItensCorte.focou);assert.equal(a.ids.blocoItensCorte.opcoesRolagem.behavior,'instant');assert.equal(a.ids.formulario.value,'18:35')
 a.ids.secaoProducao.hidden=true;a.observar();assert.equal(links[0].hidden,true)
})

test('paineis lembram a preferencia e funcionam sem armazenamento',()=>{
 const a=ambiente({home:true,preferencias:{'controle-corte.painel-finalizados':'1','controle-corte.painel-andamento':'0'}})
 const painel=a.body.querySelector('.home-finalizados-painel');assert.equal(painel.open,true)
 painel.open=false;painel.listeners.toggle();assert.equal(a.storage.get('controle-corte.painel-finalizados'),'0')
 const b=ambiente({home:true,bloquearStorage:true});assert.doesNotThrow(()=>b.ids.painelPisPendentes.listeners.toggle())
})

test('proximo passo acompanha inicio, producao, PIs e acesso ao Sankhya',()=>{
 const a=ambiente({home:true}),criar=(id)=>{const e=a.document.createElement('section');e.id=id;a.container.append(e);return e}
 const status=criar('status'),painel=criar('painelTrabalhos'),confirmados=criar('proximaEtapaPis'),sankhya=criar('abrirSankhyaPis')
 a.ids.corteSelecionado.append(status);painel.hidden=true;confirmados.hidden=true
 a.ids.corteSelecionado.hidden=false;a.observar()
 const link=a.body.querySelector('.corte-proxima-link')
 assert.match(link.textContent,/Registrar/)
 painel.hidden=false;a.ids.secaoProducao.classList.add('aguardando-inicio');a.observar();assert.match(link.textContent,/Concluir/)
 let preveniu=false;link.listeners.click({preventDefault(){preveniu=true}});assert.ok(preveniu);assert.ok(a.ids.secaoProducao.focou)
 status.textContent='FINALIZADO';a.ids.blocoItensCorte.style.display='block';a.observar();assert.match(link.textContent,/PIs/)
 sankhya.href='sankhya.html?corte=970';confirmados.hidden=false;a.observar();assert.match(link.textContent,/Sankhya/);assert.equal(link.href,sankhya.href)
 preveniu=false;link.listeners.click({preventDefault(){preveniu=true}});assert.equal(preveniu,false)
 assert.equal(a.ids.formulario.value,'18:35')
})

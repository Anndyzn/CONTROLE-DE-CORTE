const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')

function ambiente({agora='2026-11-27T08:59:59Z',bloqueado=false,oculto=false,simulacao=false,turno='0600'}={}){
  let atual=agora,intervalo
  const eventos={},eventosJanela={},memoria=new Map()
  class E{
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.className=''}
    append(...filhos){for(const filho of filhos){filho.pai=this;this.children.push(filho)}}
    setAttribute(n,v){this.attrs[n]=v}
    addEventListener(n,f){this.events[n]=f}
    remove(){this.pai.children=this.pai.children.filter(e=>e!==this)}
  }
  const body=new E('body');body.classList={contains:()=>false}
  const document={body,visibilityState:oculto?'hidden':'visible',createElement:t=>new E(t),getElementById:()=>null,addEventListener:(n,f)=>eventos[n]=f}
  const contexto={Intl,URLSearchParams,Date:class extends Date{constructor(...args){super(...(args.length?args:[atual]))}},document,
    localStorage:{getItem:k=>{if(bloqueado)throw Error('Bloqueado');return memoria.get(k)??null},setItem:(k,v)=>{if(bloqueado)throw Error('Bloqueado');memoria.set(k,v)}},
    window:{location:{search:simulacao?`?simularLembrete=1&turno=${turno}`:''},addEventListener:(n,f)=>eventosJanela[n]=f},requestAnimationFrame:f=>f(),setInterval:f=>{intervalo=f}}
  vm.createContext(contexto)
  vm.runInContext(fs.readFileSync('src/public/js/core/lembrete-turno.js','utf8').replace(/export function/g,'function'),contexto)
  return {body,document,contexto,eventos,eventosJanela,memoria,mudar:v=>atual=v,tick:()=>intervalo()}
}

test('lembretes usam Brasilia e as duas janelas somente de segunda a sexta',()=>{
  const a=ambiente(),horario=a.contexto.horarioLembrete
  for(const [data,esperado] of [
    ['2026-11-27T08:59:59Z',false],['2026-11-27T09:00:00Z',true],
    ['2026-11-27T09:59:59Z',true],['2026-11-27T10:00:00Z',false],
    ['2026-11-27T10:29:59Z',false],['2026-11-27T10:30:00Z',true],
    ['2026-11-27T11:29:59Z',true],['2026-11-27T11:30:00Z',false],
    ['2026-11-28T10:30:00Z',false],['2026-11-29T10:30:00Z',false],
    ['2026-11-28T09:00:00Z',false],['2026-11-29T09:00:00Z',false],['2026-11-30T09:00:00Z',true]
  ])assert.equal(horario(new Date(data)).ativo,esperado,data)
  assert.equal(horario(new Date('2026-11-27T01:00:00Z')).dia,'2026-11-26')
})

test('fechar o aviso das 06h nao impede o das 07h30, mesmo sem armazenamento',()=>{
  for(const bloqueado of [false,true]){
    const a=ambiente({agora:'2026-11-27T09:00:00Z',bloqueado})
    a.contexto.inicializarLembreteTurno()
    a.body.children[0].children.at(-1).children[1].events.click();a.tick()
    assert.equal(a.body.children.length,0)
    a.mudar('2026-11-27T10:30:00Z');a.tick()
    assert.match(a.body.children[0].children[0].textContent,/07:30/)
    a.body.children[0].children.at(-1).children[1].events.click();a.tick()
    assert.equal(a.body.children.length,0)
    if(!bloqueado){
      assert.equal(a.memoria.get('controle-corte.lembrete-turno-dispensado'),'2026-11-27')
      assert.equal(a.memoria.get('controle-corte.lembrete-turno-dispensado.0730'),'2026-11-27')
    }
  }
})

test('ao retomar as 07h30 troca o aviso antigo e a simulacao identifica o segundo turno',()=>{
  const a=ambiente({agora:'2026-11-27T09:00:00Z'});a.contexto.inicializarLembreteTurno()
  a.mudar('2026-11-27T10:30:00Z');a.eventosJanela.focus()
  assert.equal(a.body.children.length,1);assert.match(a.body.children[0].children[0].textContent,/07:30/)
  const b=ambiente({simulacao:true,turno:'0730'});b.contexto.inicializarLembreteTurno()
  assert.match(b.body.children[0].children[0].textContent,/07:30/)
})

test('mostra sem duplicar, dispensa por dia e volta no proximo dia util',()=>{
  const a=ambiente();a.contexto.inicializarLembreteTurno();assert.equal(a.body.children.length,0)
  a.mudar('2026-11-27T09:00:00Z');a.tick();assert.equal(a.body.children.length,1)
  const aviso=a.body.children[0];assert.equal(aviso.attrs.role,'status')
  a.tick();a.contexto.inicializarLembreteTurno();assert.equal(a.body.children[0],aviso)
  aviso.children[2].children[1].events.click();a.tick();assert.equal(a.body.children.length,0)
  a.mudar('2026-11-30T09:00:00Z');a.tick();assert.equal(a.body.children.length,1)
  assert.equal(a.body.children[0].children[2].children[0].href,'index.html#painelMesas')
})

test('retorno a aba mostra o lembrete e fechar em outra aba o dispensa aqui',()=>{
  const a=ambiente({agora:'2026-11-27T09:10:00Z',oculto:true});a.contexto.inicializarLembreteTurno()
  assert.equal(a.body.children.length,0)
  a.document.visibilityState='visible';a.eventos.visibilitychange();assert.equal(a.body.children.length,1)
  a.memoria.set('controle-corte.lembrete-turno-dispensado','2026-11-27')
  a.eventosJanela.storage({key:'controle-corte.lembrete-turno-dispensado'});assert.equal(a.body.children.length,0)
})

test('sem armazenamento fecha em memoria e o aviso expira ao terminar a janela',()=>{
  const a=ambiente({agora:'2026-11-27T09:10:00Z',bloqueado:true});a.contexto.inicializarLembreteTurno()
  a.body.children[0].children[2].children[1].events.click();a.tick();assert.equal(a.body.children.length,0)
  a.mudar('2026-11-30T09:00:00Z');a.tick();assert.equal(a.body.children.length,1)
  a.mudar('2026-11-30T10:00:00Z');a.tick();assert.equal(a.body.children.length,0)
})

test('simulacao aparece fora do horario e fechar nao dispensa o lembrete real',()=>{
  const a=ambiente({agora:'2026-11-28T15:00:00Z',simulacao:true})
  a.memoria.set('controle-corte.lembrete-turno-dispensado','2026-11-27')
  a.contexto.inicializarLembreteTurno();assert.equal(a.body.children.length,1)
  assert.match(a.body.children[0].children[0].textContent,/SIMULA/)
  a.body.children[0].children.at(-1).children[1].events.click();a.tick()
  assert.equal(a.body.children.length,0)
  assert.equal(a.memoria.get('controle-corte.lembrete-turno-dispensado'),'2026-11-27')
})

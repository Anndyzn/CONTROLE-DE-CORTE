const {test}=require('node:test')
const assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {Pool}=require('pg')
const express=require('express')
const {executar}=require('../scripts/backup-lib.cjs')

test('tecidos: PostgreSQL isolado valida cadastro, reenvio, impressão, atendimento e reabertura sem perder histórico',{timeout:120000},async()=>{
  const nome='corte-tecidos-fixture-'+crypto.randomBytes(8).toString('hex'),senha=crypto.randomBytes(32).toString('hex')
  let criado=false,pool,servidor
  const streams=[]
  try {
    await executar('docker',['run','--detach','--rm','--name',nome,'--label','controle-corte.tecidos-test=true','--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=268435456','--env','POSTGRES_PASSWORD','--env','POSTGRES_USER=tecidos_fixture','--env','POSTGRES_DB=tecidos_fixture','postgres:17'],{env:{POSTGRES_PASSWORD:senha}})
    criado=true
    for(let i=0;;i++) {try{await executar('docker',['exec',nome,'pg_isready','-h','127.0.0.1','-U','tecidos_fixture','-d','tecidos_fixture']);break}catch(e){if(i>=30)throw e;await new Promise(r=>setTimeout(r,500))}}
    const porta=Number((await executar('docker',['port',nome,'5432/tcp'])).split(':').at(-1))
    pool=new Pool({host:'127.0.0.1',port:porta,user:'tecidos_fixture',password:senha,database:'tecidos_fixture',ssl:false})
    const caminho=require.resolve('../dist/database-pg')
    require.cache[caminho]={exports:{__esModule:true,default:pool}}
    const {prepararTecidosDefeitos}=require('../dist/services/tecidos-defeitos')
    await pool.query("CREATE TABLE itens_corte(tecido TEXT);INSERT INTO itens_corte VALUES('CETIM'),('OXFORD'),('CETIM')")
    await prepararTecidosDefeitos();await prepararTecidosDefeitos()
    const app=express();app.use(express.json());app.use(require('../dist/routes/tecidos-defeitos.routes').default)
    servidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    const url=`http://127.0.0.1:${servidor.address().port}`
    const req=async(path,method='GET',body)=>{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
    async function abrirStream(){
      const controller=new AbortController();streams.push(controller)
      const r=await fetch(url+'/tecidos-defeitos/atualizacoes',{signal:controller.signal})
      assert.match(r.headers.get('content-type'),/text\/event-stream/)
      const reader=r.body.getReader();let buffer=''
      const esperar=async evento=>{
        const limite=setTimeout(()=>controller.abort(),5000)
        try{while(!buffer.includes(`event: ${evento}\n`)){const {value,done}=await reader.read();if(done)throw new Error('Canal fechado antes do evento');buffer+=Buffer.from(value).toString('utf8')}
          assert.ok(!buffer.includes('observacao'));assert.ok(!buffer.includes('nf"'));buffer=''
        }finally{clearTimeout(limite)}
      }
      await esperar('conectado');return {esperar,fechar:()=>controller.abort()}
    }
    const novo=()=>({chave_envio:crypto.randomUUID(),nf:'000316056/3',tecido:'CETIM',cor:'BRANCO',metros:'50,8',defeitos:['Manchado'],observacao:'<script>texto literal</script>'})
    const base=novo()
    const [telaA,telaB]=await Promise.all([abrirStream(),abrirStream()])
    const [a,b]=await Promise.all([req('/tecidos-defeitos','POST',base),req('/tecidos-defeitos','POST',base)])
    assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.data.item.id,b.data.item.id)
    await Promise.all([telaA.esperar('alteracao'),telaB.esperar('alteracao')]);telaA.fechar();telaB.fechar()
    assert.equal(a.data.item.nf,'000316056/3')
    assert.equal((await req('/tecidos-defeitos','POST',{...base,metros:1})).status,409)
    assert.equal((await req('/tecidos-defeitos','POST',novo())).status,201) // Mesma NF, outra peça.
    for(const dados of [{...novo(),metros:-1},{...novo(),defeitos:['Outro'],observacao:''},{...novo(),chave_envio:'invalida'}])assert.equal((await req('/tecidos-defeitos','POST',dados)).status,400)
    let lista=(await req('/tecidos-defeitos')).data
    assert.equal(lista.resumo.quantidade,2);assert.equal(Number(lista.resumo.metros),101.6)
    const id=a.data.item.id,caminhoSituacao=`/tecidos-defeitos/${id}/situacao`
    const resolver={versao:0,status:'RESOLVIDO',observacao:'Peça substituída'}
    const telaAtendimento=await abrirStream()
    const disputas=await Promise.all([req(caminhoSituacao,'PUT',resolver),req(caminhoSituacao,'PUT',resolver)])
    assert.deepEqual(disputas.map(r=>r.status).sort(),[200,412])
    await telaAtendimento.esperar('alteracao');telaAtendimento.fechar()
    lista=(await req('/tecidos-defeitos?status=RESOLVIDO')).data
    assert.equal(lista.itens[0].resolucao,'Peça substituída');assert.ok(lista.itens[0].resolvido_em)
    assert.equal((await req(caminhoSituacao,'PUT',{versao:0,status:'PENDENTE'})).status,412)
    // Se o histórico falhar, a mudança de situação também deve ser desfeita.
    await pool.query("CREATE FUNCTION recusar_evento_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.observacao='FALHA' THEN RAISE EXCEPTION 'Falha simulada'; END IF; RETURN NEW; END $$; CREATE TRIGGER recusar_evento_fixture BEFORE INSERT ON tecidos_defeitos_eventos FOR EACH ROW EXECUTE FUNCTION recusar_evento_fixture()")
    assert.equal((await req(caminhoSituacao,'PUT',{versao:1,status:'PENDENTE',observacao:'FALHA'})).status,500)
    assert.equal((await pool.query('SELECT status FROM tecidos_defeitos WHERE id=$1',[id])).rows[0].status,'RESOLVIDO')
    assert.equal((await req(caminhoSituacao,'PUT',{versao:1,status:'PENDENTE',observacao:'Ainda não atendida'})).status,200)
    const eventos=(await pool.query('SELECT status,observacao FROM tecidos_defeitos_eventos WHERE tecido_defeito_id=$1 ORDER BY id',[id])).rows
    assert.deepEqual(eventos.map(e=>e.status),['RESOLVIDO','PENDENTE']);assert.equal(eventos[0].observacao,'Peça substituída')
    await pool.query("INSERT INTO tecidos_defeitos(chave_envio,nf,tecido,metros,defeitos) SELECT gen_random_uuid(),'NF EXTRA','OXFORD',10,ARRAY['Sujo'] FROM generate_series(1,51)")
    lista=(await req('/tecidos-defeitos')).data
    assert.equal(lista.itens.length,50);assert.equal(lista.resumo.quantidade,53)
    assert.equal((await req('/tecidos-defeitos?pagina=2')).data.itens.length,3)
    assert.equal((await req('/tecidos-defeitos?imprimir=1')).data.itens.length,53)
    assert.equal((await req('/tecidos-defeitos?busca=000316056%2F3')).data.resumo.quantidade,2)
    assert.equal((await req('/tecidos-defeitos?busca=%25')).data.resumo.quantidade,0)
    assert.equal((await req('/tecidos-defeitos?pagina=-1')).status,400)
    assert.equal((await req('/tecidos-defeitos?status=TODOS')).status,400)
    assert.deepEqual((await req('/tecidos-defeitos/sugestoes')).data.tecidos,['CETIM','OXFORD'])
    // Uma peça acrescentada depois de outras NFs deve voltar ao grupo da própria NF.
    assert.equal((await req('/tecidos-defeitos','POST',novo())).status,201)
    const impressaoAgrupada=(await req('/tecidos-defeitos?imprimir=1')).data.itens
    const sequenciaNFs=impressaoAgrupada.map(i=>i.nf).filter((nf,i,todas)=>i===0||nf!==todas[i-1])
    assert.deepEqual(sequenciaNFs,['000316056/3','NF EXTRA'])
    assert.equal(impressaoAgrupada.filter(i=>i.nf==='000316056/3').length,3)
    const primeiraPagina=(await req('/tecidos-defeitos')).data.itens
    assert.deepEqual(primeiraPagina.slice(0,3).map(i=>i.nf),['000316056/3','000316056/3','000316056/3'])
    const telaExclusao=await abrirStream()
    assert.equal((await req(`/tecidos-defeitos/${id}`,'DELETE',{})).status,400)
    assert.equal((await req(`/tecidos-defeitos/${id}`,'DELETE',{versao:0})).status,412)
    const exclusoes=await Promise.all([req(`/tecidos-defeitos/${id}`,'DELETE',{versao:2}),req(`/tecidos-defeitos/${id}`,'DELETE',{versao:2})])
    assert.deepEqual(exclusoes.map(r=>r.status).sort(),[200,412])
    await telaExclusao.esperar('alteracao');telaExclusao.fechar()
    const aposExcluir=(await req('/tecidos-defeitos?imprimir=1')).data
    assert.equal(aposExcluir.resumo.quantidade,53)
    assert.ok(aposExcluir.itens.every(i=>i.id!==id))
    assert.equal(aposExcluir.itens.filter(i=>i.nf==='000316056/3').length,2)
    assert.equal((await req(caminhoSituacao,'PUT',{versao:3,status:'RESOLVIDO'})).status,412)
    assert.equal((await req('/tecidos-defeitos','POST',base)).status,409)
    const registroExcluido=(await pool.query('SELECT excluido_em FROM tecidos_defeitos WHERE id=$1',[id])).rows[0]
    assert.ok(registroExcluido.excluido_em)
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS total FROM tecidos_defeitos_eventos WHERE tecido_defeito_id=$1',[id])).rows[0].total,2)
    const pecaA=(await req('/tecidos-defeitos','POST',{...novo(),nf:'LOTE A'})).data.item
    const pecaB=(await req('/tecidos-defeitos','POST',{...novo(),nf:'LOTE B'})).data.item
    const selecionadas=[pecaA,pecaB].map(p=>({id:p.id,versao:0}))
    const resolverLote=dados=>req('/tecidos-defeitos/resolver-lote','POST',dados)
    assert.equal((await resolverLote({itens:[]})).status,400)
    assert.equal((await resolverLote({itens:[selecionadas[0],selecionadas[0]]})).status,400)
    assert.equal((await resolverLote({itens:[selecionadas[0],{...selecionadas[1],versao:99}]})).status,412)
    assert.equal((await resolverLote({itens:[selecionadas[0],{id,versao:3}]})).status,412)
    assert.equal((await resolverLote({itens:selecionadas,observacao:'FALHA'})).status,500)
    const consultarLote=()=>pool.query('SELECT id,status,versao,resolucao,resolvido_em FROM tecidos_defeitos WHERE id=ANY($1::bigint[]) ORDER BY id',[selecionadas.map(i=>i.id)])
    assert.ok((await consultarLote()).rows.every(i=>i.status==='PENDENTE'&&i.versao===0))
    const telaLote=await abrirStream()
    const resultadoLote=await resolverLote({itens:selecionadas,observacao:'Devolvidas ao fornecedor'})
    assert.equal(resultadoLote.status,200);assert.equal(resultadoLote.data.quantidade,2)
    await telaLote.esperar('alteracao');telaLote.fechar()
    assert.ok((await consultarLote()).rows.every(i=>i.status==='RESOLVIDO'&&i.versao===1&&i.resolucao==='Devolvidas ao fornecedor'&&i.resolvido_em))
    const eventosLote=(await pool.query('SELECT observacao FROM tecidos_defeitos_eventos WHERE tecido_defeito_id=ANY($1::bigint[])',[selecionadas.map(i=>i.id)])).rows
    assert.equal(eventosLote.length,2);assert.ok(eventosLote.every(i=>i.observacao==='Devolvidas ao fornecedor'))
    assert.equal((await resolverLote({itens:selecionadas})).status,412)
    assert.equal((await req(`/tecidos-defeitos/${pecaA.id}/situacao`,'PUT',{status:'PENDENTE',versao:1})).status,200)
    assert.equal((await resolverLote({itens:[{id:pecaA.id,versao:2},{id:pecaB.id,versao:1}]})).status,412)
    assert.equal((await consultarLote()).rows[0].status,'PENDENTE')
    const protegidas=(await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('tecidos_defeitos','tecidos_defeitos_eventos')")).rows
    assert.equal(protegidas.length,2);assert.ok(protegidas.every(r=>r.relrowsecurity))
  } finally {
    streams.forEach(c=>c.abort())
    if(servidor)await new Promise(r=>servidor.close(r))
    if(pool)await pool.end()
    if(criado)await executar('docker',['rm','--force',nome])
  }
})

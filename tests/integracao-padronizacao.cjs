const {test}=require('node:test')
const assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {Pool}=require('pg')
const {executar}=require('../scripts/backup-lib.cjs')

test('padronização real no PostgreSQL preserva dados, recusa prévia antiga e desfaz tudo se a auditoria falhar',{timeout:120000},async()=>{
  const nome='corte-nomes-fixture-'+crypto.randomBytes(8).toString('hex')
  const senha=crypto.randomBytes(32).toString('hex')
  let criado=false,pool
  try{
    await executar('docker',['run','--detach','--rm','--name',nome,'--label','controle-corte.nomes-test=true',
      '--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=268435456',
      '--env','POSTGRES_PASSWORD','--env','POSTGRES_USER=nomes_fixture','--env','POSTGRES_DB=nomes_fixture','postgres:17'],{env:{POSTGRES_PASSWORD:senha}})
    criado=true
    for(let tentativa=0;;tentativa++){
      try{await executar('docker',['exec',nome,'pg_isready','-h','127.0.0.1','-U','nomes_fixture','-d','nomes_fixture']);break}
      catch{if(tentativa>=30)throw new Error('PostgreSQL de teste indisponível.');await new Promise(resolve=>setTimeout(resolve,500))}
    }
    const porta=Number((await executar('docker',['port',nome,'5432/tcp'])).split(':').at(-1))
    pool=new Pool({host:'127.0.0.1',port:porta,user:'nomes_fixture',password:senha,database:'nomes_fixture',ssl:false})
    // Substituir antes de importar os serviços impede carregar credenciais da empresa.
    const caminho=require.resolve('../dist/database-pg')
    require.cache[caminho]={id:caminho,filename:caminho,loaded:true,exports:{__esModule:true,default:pool}}
    const {prepararHistoricoAdmin}=require('../dist/services/historico-admin')
    const {prepararCorrespondenciasSankhya}=require('../dist/services/sankhya-preparacao')
    const {previaPadronizacao,aplicarPadronizacao}=require('../dist/services/padronizacao-nomes')
    await pool.query(`CREATE TABLE cortes (numero INTEGER PRIMARY KEY, produto TEXT, mesa TEXT, itens_finalizados INTEGER);
      CREATE TABLE itens_corte (id BIGSERIAL PRIMARY KEY, numero_corte INTEGER REFERENCES cortes(numero), modelo TEXT, cor TEXT, tecido TEXT, quantidade_pecas INTEGER, metragem_usada NUMERIC);
      INSERT INTO cortes VALUES (922,'CONJUNTO FEMINIA','MESA 1',1);
      INSERT INTO itens_corte (numero_corte,modelo,cor,tecido,quantidade_pecas,metragem_usada) VALUES
        (922,'CONJUNTO FEMINIA','BRANCO','OXFORD',216,481.68),(922,'CONJUNTO FEMINIA','AZUL','OXFORD',150,359.95);`)
    await prepararHistoricoAdmin();await prepararCorrespondenciasSankhya()
    await pool.query(`INSERT INTO sankhya_correspondencias (modelo,tecido,cor,destinos) VALUES ($1,'OXFORD','BRANCO',$2::jsonb)`,
      ['CONJUNTO FEMINIA',JSON.stringify([{codigo_produto:6073,produto:'PI CORTE BLAZER',controle:'BRANCO'},{codigo_produto:6069,produto:'PI CORTE VESTIDO',controle:'BRANCO'}])])
    const pedido={tipo:'modelos',origens:['CONJUNTO FEMINIA'],destino:'CONJUNTO FEMININO'}
    const justificar={responsavel:'TESTE ISOLADO',motivo:'Conferência da padronização em banco descartável'}
    const antes=(await pool.query('SELECT * FROM itens_corte ORDER BY id')).rows
    const previa=await previaPadronizacao(pedido)
    assert.equal(previa.total,2);assert.equal(previa.correspondencias,1)
    assert.deepEqual((await pool.query('SELECT * FROM itens_corte ORDER BY id')).rows,antes)
    await pool.query("UPDATE itens_corte SET modelo='OUTRO' WHERE id=1")
    await assert.rejects(aplicarPadronizacao({...pedido,...justificar,token:previa.token}),e=>e.status===409)
    await pool.query("UPDATE itens_corte SET modelo='CONJUNTO FEMINIA' WHERE id=1")
    const atual=await previaPadronizacao(pedido)
    await pool.query(`CREATE FUNCTION recusar_historico_teste() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.responsavel = 'FALHA TESTE' THEN RAISE EXCEPTION 'Falha simulada no histórico'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER falha_historico BEFORE INSERT ON historico_admin FOR EACH ROW EXECUTE FUNCTION recusar_historico_teste();`)
    await assert.rejects(aplicarPadronizacao({...pedido,...justificar,responsavel:'FALHA TESTE',token:atual.token}),/Falha simulada/)
    assert.deepEqual((await pool.query('SELECT * FROM itens_corte ORDER BY id')).rows,antes)
    assert.equal((await pool.query('SELECT * FROM sankhya_correspondencias')).rows.length,1)
    assert.equal((await pool.query('SELECT * FROM historico_admin')).rows.length,0)
    const resultado=await aplicarPadronizacao({...pedido,...justificar,token:atual.token})
    assert.equal(resultado.total,2)
    const depois=(await pool.query('SELECT * FROM itens_corte ORDER BY id')).rows
    assert.deepEqual(depois,antes.map(item=>({...item,modelo:'CONJUNTO FEMININO'})))
    assert.equal((await pool.query('SELECT * FROM sankhya_correspondencias')).rows.length,2)
    const historico=(await pool.query('SELECT * FROM historico_admin ORDER BY id')).rows
    assert.equal(historico.length,2);assert.equal(historico[0].antes.modelo,'CONJUNTO FEMINIA')
    assert.equal(historico[0].depois.modelo,'CONJUNTO FEMININO')
    assert.equal(historico[0].depois.correspondencias_sankhya.length,1)
    const correcaoCorte=await previaPadronizacao({...pedido,tipo:'cortes'})
    await aplicarPadronizacao({...pedido,tipo:'cortes',...justificar,token:correcaoCorte.token})
    assert.deepEqual((await pool.query('SELECT * FROM cortes')).rows,[{numero:922,produto:'CONJUNTO FEMININO',mesa:'MESA 1',itens_finalizados:1}])
    const {default:rota}=require('../dist/routes/nomenclaturas.routes')
    const express=require('express'),app=express();app.use(rota)
    const servidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    try{
      await pool.query("UPDATE itens_corte SET modelo='VÉU GOTA' WHERE id=1")
      const dados=await(await fetch(`http://127.0.0.1:${servidor.address().port}/admin/nomenclaturas?tipo=modelos&busca=veu`)).json()
      assert.deepEqual(dados.nomes,[{nome:'VÉU GOTA',registros:1,cortes:1}])
    }finally{await new Promise(resolve=>servidor.close(resolve))}
    // Conferência do marco inicial em banco descartável, sem usar dados da empresa.
    await pool.query(`CREATE TABLE producao(id SERIAL PRIMARY KEY,numero_corte INTEGER,status TEXT,data DATE DEFAULT CURRENT_DATE);
      INSERT INTO cortes VALUES(923,'ANTIGO FINALIZADO','MESA 2',1),(924,'ABERTO AGORA','MESA 3',0);
      INSERT INTO producao(numero_corte,status) VALUES(923,'FINALIZADO'),(924,'EM PRODUÇÃO')`)
    const {prepararNomesSankhya}=require('../dist/services/sankhya-nomes')
    const {prepararLancamentosSankhya}=require('../dist/routes/sankhya-lancamentos.routes')
    const {prepararAcompanhamentoSankhya,default:acompanhamento}=require('../dist/routes/sankhya-acompanhamento.routes')
    await prepararNomesSankhya();await prepararLancamentosSankhya();await prepararAcompanhamentoSankhya()
    const acompanhados=async()=>(await pool.query('SELECT numero FROM sankhya_acompanhamento ORDER BY numero')).rows.map(r=>r.numero)
    assert.deepEqual(await acompanhados(),[922,924])
    await pool.query("INSERT INTO producao(numero_corte,status) VALUES(922,'FINALIZADO')")
    await prepararAcompanhamentoSankhya();assert.deepEqual(await acompanhados(),[922,924])
    await pool.query("INSERT INTO cortes VALUES(925,'NOVO','MESA 2',0)");assert.deepEqual(await acompanhados(),[922,924,925])
    await pool.query('DELETE FROM cortes WHERE numero=925');assert.deepEqual(await acompanhados(),[922,924])
    await pool.query("INSERT INTO cortes VALUES(925,'NOVO REUTILIZADO','MESA 2',0)");assert.deepEqual(await acompanhados(),[922,924,925])
    app.use(acompanhamento)
    const novoServidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    try{
      const resposta=await fetch(`http://127.0.0.1:${novoServidor.address().port}/sankhya/acompanhamento`)
      assert.equal(resposta.status,200)
      const dados=await resposta.json();assert.deepEqual(dados.cortes.map(c=>c.numero).sort(),[922,924,925])
      assert.ok(!dados.cortes.some(c=>c.numero===923))
    }finally{await new Promise(resolve=>novoServidor.close(resolve))}
    // Replicar muda somente escolhas de produto, nunca cor, quantidade ou lançado.
    const novoPi=(await pool.query(`INSERT INTO itens_corte(numero_corte,modelo,cor,tecido,quantidade_pecas,metragem_usada) VALUES(922,'CONJUNTO FEMININO','BEGE','OXFORD',50,100) RETURNING *`)).rows[0]
    const fonte=(await pool.query('SELECT * FROM itens_corte WHERE id=2')).rows[0]
    const {default:lancamentos,assinaturaItem}=require('../dist/routes/sankhya-lancamentos.routes')
    app.use(express.json());app.use(lancamentos);app.use(require('../dist/routes/consultas.routes').default)
    await pool.query(`INSERT INTO cortes VALUES(926,'PENDENTE ANTIGO','MESA 1',0),(927,'SEM PI','MESA 2',0),(928,'REABERTO','MESA 3',0);
      INSERT INTO producao(numero_corte,status,data) VALUES(926,'FINALIZADO',CURRENT_DATE-10),(927,'FINALIZADO',CURRENT_DATE),(928,'FINALIZADO',CURRENT_DATE),(928,'EM PRODUÇÃO',CURRENT_DATE);
      INSERT INTO itens_corte(numero_corte,modelo,cor,tecido,quantidade_pecas,metragem_usada) VALUES(926,'PI','BRANCO','OXFORD',1,1)`)
    const conferir=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    try{
      const base=`http://127.0.0.1:${conferir.address().port}`
      const replicar=await fetch(base+'/sankhya/itens/2/replicar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigos:[6073,6069],versao:0,assinatura:assinaturaItem(fonte)})})
      assert.equal(replicar.status,200);assert.equal((await replicar.json()).aplicados,1)
      const estado=(await pool.query('SELECT * FROM sankhya_lancamentos WHERE item_id=$1',[novoPi.id])).rows[0]
      assert.deepEqual(estado.codigos,[6073,6069]);assert.deepEqual(estado.lancados,[])
      assert.deepEqual((await pool.query('SELECT * FROM itens_corte WHERE id=$1',[novoPi.id])).rows[0],novoPi)
      const pendentes=await (await fetch(base+'/cortes-pis-pendentes')).json()
      assert.deepEqual(pendentes.cortes.map(c=>c.numero).sort(),[926,927]);assert.equal(pendentes.cortes.find(c=>c.numero===926).quantidade_pis,1)
    }finally{await new Promise(resolve=>conferir.close(resolve))}
  }finally{
    if(pool)await pool.end()
    if(criado)await executar('docker',['rm','--force',nome])
  }
})

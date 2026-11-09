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
  }finally{
    if(pool)await pool.end()
    if(criado)await executar('docker',['rm','--force',nome])
  }
})

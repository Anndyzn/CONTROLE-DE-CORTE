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
      CREATE TABLE itens_corte (id BIGSERIAL PRIMARY KEY, numero_corte INTEGER REFERENCES cortes(numero), modelo TEXT, cor TEXT, tecido TEXT, quantidade_pecas INTEGER, metragem_usada NUMERIC, sobra_metros NUMERIC DEFAULT 0, perda_metros NUMERIC DEFAULT 0, metros_faltantes NUMERIC DEFAULT 0);
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
    await pool.query(`CREATE TABLE producao(id SERIAL PRIMARY KEY,numero_corte INTEGER,status TEXT,data DATE DEFAULT CURRENT_DATE,turno TEXT,operador TEXT,folha_inicio INTEGER,folha_parou INTEGER,hora_inicio TEXT,hora_fim TEXT);
      INSERT INTO cortes VALUES(923,'ANTIGO FINALIZADO','MESA 2',0),(924,'ABERTO AGORA','MESA 3',0);
      INSERT INTO producao(numero_corte,status) VALUES(923,'FINALIZADO'),(924,'EM PRODUÇÃO')`)
    const {prepararNomesSankhya}=require('../dist/services/sankhya-nomes')
    const {prepararLancamentosSankhya}=require('../dist/routes/sankhya-lancamentos.routes')
    const {prepararAcompanhamentoSankhya,default:acompanhamento}=require('../dist/routes/sankhya-acompanhamento.routes')
    await prepararNomesSankhya();await prepararLancamentosSankhya();await prepararAcompanhamentoSankhya()
    await require('../dist/services/trabalho-corte').prepararTrabalhosCorte()
    // Simula o banco da versão anterior e confere a migração sem apagar dados.
    await pool.query(`ALTER TABLE trabalhos_corte ADD CONSTRAINT trabalhos_corte_numero_corte_data_trabalho_turno_operador_key UNIQUE(numero_corte,data_trabalho,turno,operador);
      INSERT INTO trabalhos_corte(numero_corte,mesa,operador,turno,status) VALUES(924,'MESA 3','MIGRACAO FIXTURE','1º TURNO','LANCADO')`)
    await require('../dist/services/trabalho-corte').prepararTrabalhosCorte()
    await require('../dist/services/trabalho-corte').prepararTrabalhosCorte()
    assert.equal(Number((await pool.query("SELECT COUNT(*) FROM trabalhos_corte WHERE operador='MIGRACAO FIXTURE'")).rows[0].count),1)
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
    app.use(express.json());app.use(lancamentos);app.use(require('../dist/routes/consultas.routes').default);app.use(require('../dist/routes/itens.routes').default);app.use(require('../dist/routes/producao.routes').default)
    await pool.query(`INSERT INTO cortes VALUES(926,'PENDENTE ANTIGO','MESA 1',0),(927,'SEM PI','MESA 2',0),(928,'REABERTO','MESA 3',0);
      INSERT INTO producao(numero_corte,status,data) VALUES(926,'FINALIZADO',CURRENT_DATE-10),(927,'FINALIZADO',CURRENT_DATE),(928,'FINALIZADO',CURRENT_DATE),(928,'EM PRODUÇÃO',CURRENT_DATE);
      INSERT INTO itens_corte(numero_corte,modelo,cor,tecido,quantidade_pecas,metragem_usada) VALUES(926,'PI','BRANCO','OXFORD',1,1)`)
    const conferir=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    app.use(require('../dist/routes/trabalhos.routes').default)
    app.use(require('../dist/routes/cortes.routes').default)
    try{
      const base=`http://127.0.0.1:${conferir.address().port}`
      const replicar=await fetch(base+'/sankhya/itens/2/replicar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigos:[6073,6069],versao:0,assinatura:assinaturaItem(fonte)})})
      assert.equal(replicar.status,200);assert.equal((await replicar.json()).aplicados,1)
      const estado=(await pool.query('SELECT * FROM sankhya_lancamentos WHERE item_id=$1',[novoPi.id])).rows[0]
      assert.deepEqual(estado.codigos,[6073,6069]);assert.deepEqual(estado.lancados,[])
      assert.deepEqual((await pool.query('SELECT * FROM itens_corte WHERE id=$1',[novoPi.id])).rows[0],novoPi)
      const pendentes=await (await fetch(base+'/cortes-pis-pendentes')).json()
      assert.deepEqual(pendentes.cortes.map(c=>c.numero).sort(),[927]);assert.equal(pendentes.cortes[0].quantidade_pis,0)
      assert.ok(!pendentes.cortes.some(c=>c.numero===923), 'Old unconfirmed cuts outside tracking stay out of the Home alert')
      assert.equal((await pool.query('SELECT itens_finalizados FROM cortes WHERE numero=923')).rows[0].itens_finalizados,0)
      const lote=async itens=>fetch(base+'/itens-corte/lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numero_corte:927,itens})})
      const pi=cor=>({modelo:'EDREDON',tecido:'OXFORD',cor,metragem_usada:12,quantidade_pecas:22})
      assert.equal((await lote([pi('BRANCO'),pi('BEGE')])).status,201)
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM itens_corte WHERE numero_corte=927')).rows[0].count),2)
      const producao={data:'2026-11-18',numero_corte:925,turno:'1º TURNO',operador:'TESTE',folha_inicio:0,folha_parou:10,status:'EM PRODUÇÃO',hora_inicio:'08:00',hora_fim:'09:00'}
      const produzir=body=>fetch(base+'/producao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      assert.equal((await produzir(producao)).status,201)
      const repetido=await produzir(producao);assert.equal(repetido.status,409)
      const aviso=await repetido.json();assert.equal(aviso.codigo,'PRODUCAO_SEMELHANTE')
      assert.equal((await produzir({...producao,confirmacao_duplicidade:aviso.confirmacao})).status,201)
      // Início separado, idempotente, e conclusão lançada no dia seguinte.
      await pool.query("INSERT INTO cortes VALUES(929,'TRABALHO FIXTURE','MESA 1',0)")
      const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      assert.equal((await post('/cortes/929/trabalhos',{operador:'',turno:'1º TURNO'})).status,400)
      const inicio=await post('/cortes/929/trabalhos',{operador:'teste trabalho',turno:'1º TURNO',data:'2000-01-01',hora_inicio:'00:00'})
      assert.equal(inicio.status,201)
      const t=(await inicio.json()).trabalho
      const hoje=(await pool.query("SELECT TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS dia")).rows[0].dia
      assert.equal(t.data,hoje);assert.equal(t.mesa,'MESA 1');assert.equal(t.operador,'TESTE TRABALHO')
      const mesas=await(await fetch(base+'/cortes-em-andamento')).json()
      const mesaTrabalho=mesas.find(c=>c.numero===929)
      assert.equal(mesaTrabalho.trabalho_hoje.length,1);assert.equal(mesaTrabalho.ultima_producao,null)
      const repeticao=await post('/cortes/929/trabalhos',{operador:' TESTE  TRABALHO ',turno:'1º TURNO'})
      assert.equal(repeticao.status,200);assert.equal((await repeticao.json()).trabalho.id,t.id)
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM producao WHERE numero_corte=929')).rows[0].count),0)
      await pool.query("UPDATE trabalhos_corte SET data_trabalho=data_trabalho-1,iniciado_em=((data_trabalho-1)+time '08:10') AT TIME ZONE 'America/Sao_Paulo' WHERE id=$1",[t.id])
      const carregar=async()=>(await(await fetch(base+'/cortes/929/trabalhos')).json()).trabalhos
      const ontem=(await carregar())[0]
      assert.notEqual(ontem.data,hoje);assert.equal(ontem.hora_inicio,'08:10')
      assert.equal((await(await fetch(base+'/cortes-em-andamento')).json()).find(c=>c.numero===929).trabalho_hoje.length,0)
      const conclusao={...producao,numero_corte:929,data:ontem.data,operador:ontem.operador,turno:ontem.turno,hora_inicio:ontem.hora_inicio,hora_fim:'17:20',trabalho_id:t.id,producao_base_id:'',folha_inicio:0,folha_parou:20}
      assert.equal((await produzir({...conclusao,data:hoje})).status,400)
      assert.equal((await produzir({...conclusao,numero_corte:925})).status,404)
      assert.equal((await produzir({...conclusao,producao_base_id:999})).status,412)
      const outroInicio=await post('/cortes/929/trabalhos',{operador:'OUTRO TESTE',turno:'2º TURNO'})
      assert.equal(outroInicio.status,200);assert.equal((await outroInicio.json()).trabalho.id,t.id)
      const outroId=(await pool.query("INSERT INTO trabalhos_corte(numero_corte,mesa,operador,turno) VALUES(929,'MESA 1','LEGADO','2º TURNO') RETURNING id")).rows[0].id
      assert.equal((await produzir({...conclusao,status:'FINALIZADO'})).status,412)
      await pool.query('DELETE FROM trabalhos_corte WHERE id=$1',[outroId])
      assert.equal((await carregar()).length,1)
      // Falhar ao gravar a conclusão deve preservar o início pendente.
      await pool.query(`CREATE FUNCTION falha_trabalho_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.numero_corte=929 THEN RAISE EXCEPTION 'Work fixture failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER falha_trabalho_fixture BEFORE INSERT ON producao FOR EACH ROW EXECUTE FUNCTION falha_trabalho_fixture()`)
      assert.equal((await produzir(conclusao)).status,500);assert.equal((await carregar()).length,1)
      await pool.query('DROP TRIGGER falha_trabalho_fixture ON producao')
      assert.equal((await produzir({...conclusao,corrigir_inicio:true,data:'2026-02-30'})).status,400)
      assert.equal((await produzir({...conclusao,corrigir_inicio:true,data:'2099-01-01'})).status,400)
      const inicioOriginal=(await pool.query('SELECT iniciado_em FROM trabalhos_corte WHERE id=$1',[t.id])).rows[0].iniciado_em
      const corrigida={...conclusao,corrigir_inicio:true,hora_inicio:'07:30'}
      assert.equal((await produzir(corrigida)).status,201);assert.equal((await carregar()).length,0)
      assert.equal((await produzir(conclusao)).status,412)
      const registrada=(await pool.query("SELECT TO_CHAR(data,'YYYY-MM-DD') AS dia,hora_inicio,hora_fim FROM producao WHERE numero_corte=929")).rows[0]
      assert.deepEqual(registrada,{dia:ontem.data,hora_inicio:'07:30',hora_fim:'17:20'})
      const trabalho=(await pool.query('SELECT * FROM trabalhos_corte WHERE id=$1',[t.id])).rows[0]
      assert.equal(trabalho.status,'LANCADO');assert.ok(trabalho.producao_id)
      assert.deepEqual(trabalho.iniciado_em,inicioOriginal);assert.ok(trabalho.inicio_real_em)
      // Dois operadores clicando ao mesmo tempo recebem o mesmo início.
      await pool.query("INSERT INTO cortes VALUES(930,'INICIO REAL FIXTURE','MESA 2',0)")
      const simultaneos=await Promise.all(['ANA','SOFIA'].map(operador=>post('/cortes/930/trabalhos',{operador,turno:'1º TURNO',inicio_real:{data:ontem.data,hora_inicio:'07:15'}})))
      assert.deepEqual(simultaneos.map(r=>r.status).sort(),[200,201])
      const inicios=await Promise.all(simultaneos.map(r=>r.json()))
      assert.equal(inicios[0].trabalho.id,inicios[1].trabalho.id)
      assert.equal(inicios[0].trabalho.data,ontem.data);assert.equal(inicios[0].trabalho.hora_inicio,'07:15')
      // Concluir um lançamento libera novo início no mesmo corte, dia, turno e operador.
      await pool.query("INSERT INTO cortes VALUES(931,'REASSUMIR FIXTURE','MESA 3',0)")
      const assumirMesmo=()=>post('/cortes/931/trabalhos',{operador:'CICERA',turno:'1º TURNO'})
      const primeiro=await assumirMesmo();assert.equal(primeiro.status,201)
      const primeiroTrabalho=(await primeiro.json()).trabalho
      const primeiraProducao=await produzir({...producao,numero_corte:931,data:primeiroTrabalho.data,
        operador:primeiroTrabalho.operador,turno:primeiroTrabalho.turno,hora_inicio:primeiroTrabalho.hora_inicio,
        hora_fim:primeiroTrabalho.hora_inicio,trabalho_id:primeiroTrabalho.id,producao_base_id:''})
      assert.equal(primeiraProducao.status,201)
      const novamente=await assumirMesmo();assert.equal(novamente.status,201)
      const novoTrabalho=(await novamente.json()).trabalho
      assert.notEqual(novoTrabalho.id,primeiroTrabalho.id);assert.equal(novoTrabalho.status,'EM_TRABALHO')
      assert.equal(novoTrabalho.data,primeiroTrabalho.data)
      const lancados=(await pool.query('SELECT id,status,producao_id FROM trabalhos_corte WHERE numero_corte=931 ORDER BY id')).rows
      assert.equal(lancados.length,2);assert.equal(lancados[0].status,'LANCADO');assert.ok(lancados[0].producao_id)
      const cliques=await Promise.all([assumirMesmo(),assumirMesmo()])
      assert.ok(cliques.every(r=>r.status===200))
      for(const clique of cliques)assert.equal((await clique.json()).trabalho.id,novoTrabalho.id)
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM trabalhos_corte WHERE numero_corte=931')).rows[0].count),2)
      assert.equal((await post('/cortes/923/trabalhos',{operador:'TESTE',turno:'1º TURNO'})).status,409)
      await pool.query(`CREATE FUNCTION recusar_cor_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.cor='FALHA' THEN RAISE EXCEPTION 'Batch fixture failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER recusar_cor_fixture BEFORE INSERT ON itens_corte FOR EACH ROW EXECUTE FUNCTION recusar_cor_fixture()`)
      assert.equal((await lote([pi('ROSA'),pi('FALHA')])).status,500)
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM itens_corte WHERE numero_corte=927')).rows[0].count),2)
    }finally{await new Promise(resolve=>conferir.close(resolve))}
  }finally{
    if(pool)await pool.end()
    if(criado)await executar('docker',['rm','--force',nome])
  }
})

const {test} = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {executar,cliente,conexao,criarBackup,verificarBackup,ferramentaPg,validarBackup} = require('../scripts/backup-lib.cjs')

test('backup e recuperação reais conservam dados, chaves estrangeiras, sequência e RLS em ambiente descartável', {timeout:600000}, async () => {
  const nome = 'corte-fixture-'+crypto.randomBytes(8).toString('hex')
  const senha = crypto.randomBytes(32).toString('hex')
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(),'corte-integracao-'))
  let criado = false, backup
  try {
    await executar('docker',['run','--detach','--rm','--name',nome,'--label','controle-corte.backup-test=true',
      '--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=536870912',
      '--env','POSTGRES_PASSWORD','--env','POSTGRES_USER=backup_fixture','--env','POSTGRES_DB=backup_fixture','postgres:17'],
      {env:{POSTGRES_PASSWORD:senha}})
    criado = true
    for (let tentativa=0;;tentativa++) {
      try { await executar('docker',['exec',nome,'pg_isready','-h','127.0.0.1','-U','backup_fixture','-d','backup_fixture']); break }
      catch { if (tentativa>=30) throw new Error('Banco de teste indisponível.'); await new Promise(r=>setTimeout(r,1000)) }
    }
    const porta = (await executar('docker',['port',nome,'5432/tcp'])).split(':').at(-1)
    const url = `postgresql://backup_fixture:${senha}@127.0.0.1:${porta}/backup_fixture`
    const c = await cliente(conexao(url))
    try {
      await c.query(`
        CREATE ROLE anon NOLOGIN;
        CREATE TABLE cortes (id BIGSERIAL PRIMARY KEY, numero INTEGER UNIQUE, produto TEXT, mesa TEXT);
        CREATE TABLE producao (id BIGSERIAL PRIMARY KEY, numero_corte INTEGER REFERENCES cortes(numero), status TEXT);
        CREATE TABLE itens_corte (id BIGSERIAL PRIMARY KEY, numero_corte INTEGER REFERENCES cortes(numero), modelo TEXT, metragem NUMERIC);
        CREATE TABLE historico_admin (id BIGSERIAL PRIMARY KEY, numero_corte INTEGER, motivo TEXT, antes JSONB);
        ALTER TABLE historico_admin ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "anon pode ler cortes" ON cortes FOR SELECT TO anon USING (true);
        INSERT INTO cortes (numero,produto,mesa) VALUES (843,'VESTIDO RENDA','MESA 1');
        INSERT INTO producao (numero_corte,status) VALUES (843,'FINALIZADO');
        INSERT INTO itens_corte (numero_corte,modelo,metragem) VALUES (843,'PI AZUL',12.5);
        INSERT INTO historico_admin (numero_corte,motivo,antes) VALUES (843,'Correção de teste','{"status":"FINALIZADO"}');
      `)
    } finally { await c.end() }
    backup = await criarBackup({url,diretorio:pasta,container:nome})
    assert.equal(backup.manifesto.tabelas.cortes,'1')
    assert.equal(backup.manifesto.verificadoEm,null)
    assert.deepEqual(backup.manifesto.papeis,['anon'])
    await verificarBackup(backup.arquivo,{conferir:async (config,container) => {
      const sql = `SELECT json_build_object(
        'produto',(SELECT produto FROM cortes WHERE numero=843),
        'metragem',(SELECT metragem FROM itens_corte WHERE numero_corte=843),
        'motivo',(SELECT motivo FROM historico_admin WHERE numero_corte=843),
        'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='historico_admin'::regclass),
        'proximo',nextval('cortes_id_seq'),
        'fks',(SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace),
        'loginAnon',(SELECT rolcanlogin FROM pg_roles WHERE rolname='anon'),
        'politicas',(SELECT COUNT(*) FROM pg_policy WHERE polrelid='cortes'::regclass)
      )`
      const resultado = JSON.parse(await ferramentaPg('psql',['-X','-A','-t','--set=ON_ERROR_STOP=1','--command',sql],config,{container}))
      assert.equal(resultado.produto,'VESTIDO RENDA')
      assert.equal(Number(resultado.metragem),12.5)
      assert.equal(resultado.motivo,'Correção de teste')
      assert.equal(resultado.rls,true)
      assert.equal(resultado.proximo,2)
      assert.equal(resultado.fks,2)
      assert.equal(resultado.loginAnon,false)
      assert.equal(resultado.politicas,1)
    }})
    assert.ok((await validarBackup(backup.arquivo)).manifesto.verificadoEm)
  } finally {
    if (criado) await executar('docker',['rm','--force',nome])
    for (const arquivo of fs.readdirSync(pasta)) fs.unlinkSync(path.join(pasta,arquivo))
    fs.rmdirSync(pasta)
  }
})

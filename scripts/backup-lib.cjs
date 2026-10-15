const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const {spawn} = require('node:child_process')
const {Client} = require('pg')

const ROOT = path.resolve(__dirname, '..')
const BACKUP_DIR = path.join(ROOT, 'backup')

function conexao(valor) {
  if (!valor) throw new Error('Configure DATABASE_URL ou BACKUP_DATABASE_URL no .env.')
  const url = new URL(valor)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A conexão deve ser PostgreSQL.')
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  const local = ['localhost','127.0.0.1','::1'].includes(host)
  const user = decodeURIComponent(url.username)
  const database = decodeURIComponent(url.pathname.slice(1))
  const port = Number(url.port || 5432)
  if (!user || !database || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Conexão PostgreSQL incompleta.')
  if (host.endsWith('.pooler.supabase.com') && port === 6543) {
    throw new Error('Use a conexão direta ou Session Pooler (porta 5432) em BACKUP_DATABASE_URL; a porta 6543 não é usada para backup.')
  }
  const projeto = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1]
    || (host.endsWith('.pooler.supabase.com') ? user.match(/\.([a-z0-9]+)$/)?.[1] : null)
  const identidade = projeto ? `supabase:${projeto}` : `${local ? 'loopback' : host}:${port}/${database}`
  return {host, port, user, database, password:decodeURIComponent(url.password), local,
    fingerprint:crypto.createHash('sha256').update(identidade).digest('hex')}
}

function esconder(mensagem, config) {
  let texto = String(mensagem)
  if (config?.password) for (const segredo of [config.password, encodeURIComponent(config.password)]) texto = texto.split(segredo).join('[oculto]')
  return texto.replace(/postgres(?:ql)?:\/\/\S+/gi, '[conexão oculta]').slice(0, 4000)
}

function executar(programa, args, {env = {}, arquivoSaida, arquivoEntrada, config, tempoLimiteMs = 600000} = {}) {
  return new Promise((resolve, reject) => {
    const fd = arquivoSaida ? fs.openSync(arquivoSaida, 'wx', 0o600) : null
    const entrada = arquivoEntrada ? fs.openSync(arquivoEntrada, 'r') : null
    const filho = spawn(programa, args, {cwd:ROOT, env:{...process.env,...env}, windowsHide:true,
      stdio:[entrada ?? 'ignore', fd ?? 'pipe', 'pipe']})
    const limite = setTimeout(()=>{
      filho.kill()
      reject(new Error(`${programa} excedeu o tempo limite. Confira o Docker e a conexão antes de tentar novamente.`))
    },tempoLimiteMs)
    if (fd !== null) fs.closeSync(fd)
    if (entrada !== null) fs.closeSync(entrada)
    let saida = '', erro = ''
    filho.stdout?.on('data', parte => { saida = (saida + parte.toString()).slice(-128000) })
    filho.stderr?.on('data', parte => { erro = (erro + parte.toString()).slice(-16000) })
    filho.once('error', e => { clearTimeout(limite); reject(new Error(esconder(e.code === 'ENOENT' ? `Ferramenta não encontrada: ${programa}` : e.message, config))) })
    filho.once('close', codigo => { clearTimeout(limite); codigo === 0 ? resolve(saida.trim()) : reject(new Error(esconder(erro || `${programa} terminou com código ${codigo}.`, config))) })
  })
}

async function cliente(config) {
  const c = new Client({host:config.host, port:config.port, user:config.user, database:config.database,
    password:config.password, ssl:config.local ? false : {rejectUnauthorized:false}, connectionTimeoutMillis:15000})
  try { await c.connect(); return c } catch(e) { await c.end().catch(()=>{}); throw new Error(esconder(e.message,config)) }
}

function ambientePg(config) {
  return {PGHOST:config.host, PGPORT:String(config.port), PGUSER:config.user, PGDATABASE:config.database,
    PGPASSWORD:config.password, PGSSLMODE:config.local ? 'disable' : 'require', PGCONNECT_TIMEOUT:'15'}
}

async function ferramentaPg(programa, args, config, {major = 17, arquivoSaida, arquivoEntrada, container} = {}) {
  const env = ambientePg(config)
  if (container) return executar('docker', ['exec', ...(arquivoEntrada ? ['--interactive'] : []), ...Object.keys(env).flatMap(chave=>['--env',chave]), container, programa,...args], {env,arquivoSaida,arquivoEntrada,config})
  const nativo = process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, programa + (process.platform === 'win32' ? '.exe' : '')) : programa
  try {
    const versao = await executar(nativo,['--version'])
    if (Number(versao.match(/(\d+)\./)?.[1]) !== major) throw new Error(`Use ferramentas PostgreSQL ${major} para este backup, ou remova PG_BIN_DIR/PATH incompatível e use Docker.`)
    return await executar(nativo,args,{env,arquivoSaida,arquivoEntrada,config})
  }
  catch(e) {
    // Não repetir um dump que falhou: o fallback só se aplica à ausência do executável.
    if (!e.message.startsWith('Ferramenta não encontrada:')) throw e
  }
  if (config.local) throw new Error('Para uma conexão local, configure PG_BIN_DIR com as ferramentas PostgreSQL, ou use backup:verify para a recuperação isolada via Docker.')
  await executar('docker',['version','--format','{{.Server.Version}}'])
  return executar('docker',['run','--rm',...(arquivoEntrada ? ['--interactive'] : []),...Object.keys(env).flatMap(chave=>['--env',chave]),`postgres:${major}`,programa,...args],{env,arquivoSaida,arquivoEntrada,config})
}

function identificador(valor) { return '"' + String(valor).replaceAll('"','""') + '"' }
function literal(valor) { return "'" + String(valor).replaceAll("'","''") + "'" }

function prepararPapeisSql(papeis = []) {
  if (!papeis.length) return null
  const comandos = papeis.map(papel => `IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=${literal(papel)}) THEN EXECUTE ${literal(`CREATE ROLE ${identificador(papel)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`)}; END IF;`).join('\n')
  let delimitador
  do { delimitador = '$corte_'+crypto.randomBytes(8).toString('hex')+'$' } while (comandos.includes(delimitador))
  return `DO ${delimitador} BEGIN ${comandos} END; ${delimitador};`
}

async function hashArquivo(arquivo) {
  const hash = crypto.createHash('sha256')
  for await (const parte of fs.createReadStream(arquivo)) hash.update(parte)
  return hash.digest('hex')
}

function gravarJson(arquivo, dados) {
  const parcial = arquivo + '.partial'
  fs.writeFileSync(parcial, JSON.stringify(dados,null,2)+'\n',{mode:0o600,flag:'wx'})
  fs.renameSync(parcial, arquivo)
}

async function criarBackup({url, diretorio = BACKUP_DIR, container} = {}) {
  const config = conexao(url)
  fs.mkdirSync(diretorio,{recursive:true,mode:0o700})
  const nome = `controle-corte-${new Date().toISOString().replaceAll(':','-')}-${crypto.randomBytes(3).toString('hex')}.dump`
  const arquivo = path.join(diretorio,nome), parcial = arquivo+'.partial'
  const c = await cliente(config)
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const major = Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num)/10000)
    const snapshot = (await c.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot
    const tabelas = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows
    const papeis = (await c.query("SELECT DISTINCT r.rolname FROM pg_policy p JOIN pg_class t ON t.oid=p.polrelid JOIN pg_roles r ON r.oid=ANY(p.polroles) WHERE t.relnamespace='public'::regnamespace ORDER BY r.rolname")).rows.map(r=>r.rolname)
    const contagens = {}
    for (const {tablename} of tabelas) contagens[tablename] = (await c.query(`SELECT COUNT(*)::text AS total FROM public.${identificador(tablename)}`)).rows[0].total
    for (const tabela of ['cortes','producao','itens_corte','historico_admin']) {
      if (!(tabela in contagens)) throw new Error(`Tabela esperada não encontrada: ${tabela}.`)
    }
    const configFerramenta = container ? {...config,host:'127.0.0.1',port:5432} : config
    await ferramentaPg('pg_dump',['--format=custom','--schema=public','--no-owner','--no-acl','--lock-wait-timeout=30s',`--snapshot=${snapshot}`],configFerramenta,{major,arquivoSaida:parcial,container})
    const cabecalho = Buffer.alloc(5), fd = fs.openSync(parcial,'r')
    try { fs.readSync(fd,cabecalho,0,5,0) } finally { fs.closeSync(fd) }
    if (cabecalho.toString() !== 'PGDMP') throw new Error('O arquivo gerado não é um backup PostgreSQL válido.')
    await c.query('COMMIT')
    fs.renameSync(parcial,arquivo)
    const manifesto = {versao:1, criadoEm:new Date().toISOString(), escopo:'public', postgresMajor:major,
      origem:config.fingerprint, arquivo:nome, sha256:await hashArquivo(arquivo), tabelas:contagens, papeis, verificadoEm:null}
    gravarJson(arquivo+'.json',manifesto)
    return {arquivo,manifesto}
  } catch(e) {
    await c.query('ROLLBACK').catch(()=>{})
    if (fs.existsSync(parcial)) fs.unlinkSync(parcial)
    throw new Error(esconder(e.message,config))
  } finally { await c.end() }
}

async function validarBackup(arquivo) {
  arquivo = path.resolve(arquivo)
  const manifesto = JSON.parse(fs.readFileSync(arquivo+'.json','utf8'))
  if (manifesto.versao !== 1 || manifesto.escopo !== 'public' || manifesto.arquivo !== path.basename(arquivo)
    || !Number.isInteger(manifesto.postgresMajor) || manifesto.postgresMajor < 12 || manifesto.postgresMajor > 30
    || !manifesto.tabelas || typeof manifesto.tabelas !== 'object' || Array.isArray(manifesto.tabelas)
    || (manifesto.papeis !== undefined && (!Array.isArray(manifesto.papeis) || !manifesto.papeis.every(p=>typeof p === 'string' && p.length > 0 && Buffer.byteLength(p,'utf8') <= 63 && !p.includes('\0'))))
    || !Object.entries(manifesto.tabelas).every(([nome,total])=>nome && typeof total === 'string' && /^\d+$/.test(total))) {
    throw new Error('Manifesto de backup inválido.')
  }
  if (await hashArquivo(arquivo) !== manifesto.sha256) throw new Error('A integridade do backup falhou: SHA-256 diferente. O arquivo não será restaurado.')
  return {arquivo,manifesto}
}

async function verificarBackup(arquivo, {conferir} = {}) {
  const backup = await validarBackup(arquivo)
  const nome = 'corte-recuperacao-'+crypto.randomBytes(8).toString('hex')
  const env = {POSTGRES_PASSWORD:crypto.randomBytes(32).toString('hex')}
  const config = {host:'127.0.0.1',port:5432,user:'backup_check',database:'backup_check',password:env.POSTGRES_PASSWORD,local:true}
  let criado = false
  try {
    await executar('docker',['run','--detach','--rm','--name',nome,'--label','controle-corte.backup-check=true','--network','none',
      '--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=536870912',
      '--env','POSTGRES_PASSWORD','--env','POSTGRES_USER=backup_check','--env','POSTGRES_DB=backup_check',
      '--volume',`${path.dirname(backup.arquivo)}:/backup:ro`,`postgres:${backup.manifesto.postgresMajor}`],{env,config})
    criado = true
    for (let tentativa=0;;tentativa++) {
      try { await executar('docker',['exec',nome,'pg_isready','-h','127.0.0.1','-U','backup_check','-d','backup_check']); break }
      catch { if (tentativa >= 30) throw new Error('O PostgreSQL de recuperação não ficou pronto.'); await new Promise(r=>setTimeout(r,1000)) }
    }
    const papeisSql = prepararPapeisSql(backup.manifesto.papeis)
    if (papeisSql) await ferramentaPg('psql',['-X','--set=ON_ERROR_STOP=1','--command',papeisSql],config,{container:nome})
    await ferramentaPg('pg_restore',['--exit-on-error','--single-transaction','--schema=public','--no-owner','--no-acl',
      '--dbname=backup_check','/backup/'+path.basename(backup.arquivo)],config,{container:nome})
    const consultas = Object.keys(backup.manifesto.tabelas).map(tabela=>`SELECT ${literal(tabela)} AS nome, COUNT(*)::text AS total FROM public.${identificador(tabela)}`)
    const contagensSql = `SELECT json_object_agg(nome,total)::text FROM (${consultas.join(' UNION ALL ')}) contagens`
    const contagens = JSON.parse(await ferramentaPg('psql',['-X','-A','-t','--set=ON_ERROR_STOP=1','--command',contagensSql],config,{container:nome}))
    for (const [tabela,total] of Object.entries(backup.manifesto.tabelas)) {
      if (contagens[tabela] !== total) throw new Error(`Recuperação divergente na tabela ${tabela}.`)
    }
    if (conferir) await conferir(config,nome)
    backup.manifesto.verificadoEm = new Date().toISOString()
    gravarJson(backup.arquivo+'.json',backup.manifesto)
    return backup
  } finally {
    if (criado) await executar('docker',['rm','--force',nome])
  }
}

function garantirDestinoSeguro(destino, manifesto, urlEmUso) {
  if (destino.fingerprint === manifesto.origem || (urlEmUso && destino.fingerprint === conexao(urlEmUso).fingerprint)) {
    throw new Error('A recuperação no banco de origem ou no banco em uso está bloqueada. Configure RESTORE_DATABASE_URL com um banco separado e vazio.')
  }
}

async function restaurarBackup({arquivo,urlDestino,urlEmUso,confirmacao} = {}) {
  const backup = await validarBackup(arquivo)
  if (!urlDestino) throw new Error('Configure RESTORE_DATABASE_URL com um banco separado e vazio.')
  const config = conexao(urlDestino)
  garantirDestinoSeguro(config,backup.manifesto,urlEmUso)
  if (confirmacao !== 'RESTAURAR-BANCO-VAZIO') throw new Error('Revise o destino e use --confirm RESTAURAR-BANCO-VAZIO. Nenhum dado foi restaurado.')
  const c = await cliente(config)
  try {
    const objetos = await c.query(`SELECT (
      (SELECT COUNT(*) FROM pg_class WHERE relnamespace='public'::regnamespace) +
      (SELECT COUNT(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) +
      (SELECT COUNT(*) FROM pg_type WHERE typnamespace='public'::regnamespace)
    )::int AS total`)
    if (objetos.rows[0].total !== 0) throw new Error('O schema public do destino contém objetos. A recuperação foi bloqueada; escolha um banco vazio.')
    const major = Math.floor(Number((await c.query('SHOW server_version_num')).rows[0].server_version_num)/10000)
    if (major < backup.manifesto.postgresMajor) throw new Error('O destino precisa usar PostgreSQL da mesma versão principal ou mais recente que o backup.')
    const papeisSql = prepararPapeisSql(backup.manifesto.papeis)
    if (papeisSql) await c.query(papeisSql)
  } finally { await c.end() }
  // Evita concorrência com a aplicação: o destino é novo e só deve ser usado após a conferência.
  await ferramentaPg('pg_restore',['--exit-on-error','--single-transaction','--schema=public','--no-owner','--no-acl',
    `--dbname=${config.database}`],config,{major:backup.manifesto.postgresMajor,arquivoEntrada:backup.arquivo})
  const conferido = await cliente(config)
  try {
    for (const [tabela,total] of Object.entries(backup.manifesto.tabelas)) {
      const atual = (await conferido.query(`SELECT COUNT(*)::text AS total FROM public.${identificador(tabela)}`)).rows[0].total
      if (atual !== total) throw new Error(`Recuperação divergente na tabela ${tabela}; não use esse destino antes de revisar os dados.`)
    }
  } finally { await conferido.end() }
  return backup
}

module.exports = {ROOT,BACKUP_DIR,conexao,esconder,executar,cliente,ambientePg,ferramentaPg,hashArquivo,
  criarBackup,validarBackup,verificarBackup,garantirDestinoSeguro,restaurarBackup}

const fs = require('node:fs')
const path = require('node:path')
const {ROOT,BACKUP_DIR,criarBackup,verificarBackup,restaurarBackup} = require('./backup-lib.cjs')
require('dotenv').config({path:path.join(ROOT,'.env'),quiet:true})

function ultimoBackup() {
  if (!fs.existsSync(BACKUP_DIR)) throw new Error('Nenhum backup local encontrado. Execute npm run backup:create.')
  const arquivos = fs.readdirSync(BACKUP_DIR).filter(nome=>/^controle-corte-.*\.dump$/.test(nome) && fs.existsSync(path.join(BACKUP_DIR,nome+'.json'))).sort().reverse()
  if (!arquivos.length) throw new Error('Nenhum backup local encontrado. Execute npm run backup:create.')
  return path.join(BACKUP_DIR,arquivos[0])
}

async function main() {
  const [comando,...args] = process.argv.slice(2)
  const opcao = nome => { const i=args.indexOf(nome); return i < 0 ? undefined : args[i+1] }
  const url = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL
  if (comando === 'create' || comando === 'daily') {
    const resultado = await criarBackup({url})
    console.log('Backup criado: '+resultado.arquivo)
    if (comando === 'daily') {
      await verificarBackup(resultado.arquivo)
      fs.appendFileSync(path.join(BACKUP_DIR,'rotina.log'),`${new Date().toISOString()} Backup criado e recuperação conferida: ${path.basename(resultado.arquivo)}\n`)
      console.log('Recuperação conferida em PostgreSQL isolado; contagens correspondem ao snapshot do backup.')
    }
    return
  }
  if (comando === 'verify') {
    const resultado = await verificarBackup(opcao('--file') || ultimoBackup())
    console.log('Recuperação conferida: '+resultado.arquivo)
    return
  }
  if (comando === 'restore') {
    const resultado = await restaurarBackup({arquivo:opcao('--file') || ultimoBackup(),urlDestino:process.env.RESTORE_DATABASE_URL,
      urlEmUso:process.env.DATABASE_URL,confirmacao:opcao('--confirm')})
    console.log('Backup restaurado no banco separado. Confira os dados antes de usar esse destino na aplicação: '+resultado.arquivo)
    return
  }
  if (comando === 'status') {
    const arquivo = ultimoBackup(), dados = JSON.parse(fs.readFileSync(arquivo+'.json','utf8'))
    const data = valor => valor ? new Date(valor).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'ainda não conferida'
    console.log(`Última cópia: ${arquivo}\nCriada em Brasília: ${data(dados.criadoEm)}\nRecuperação conferida em Brasília: ${data(dados.verificadoEm)}`)
    return
  }
  console.log('Comandos: backup:create, backup:verify [-- --file caminho.dump], backup:status, backup:daily e backup:restore -- --file caminho.dump --confirm RESTAURAR-BANCO-VAZIO.\nA recuperação exige RESTORE_DATABASE_URL e bloqueia o banco de origem/em uso e destinos com objetos no schema public.')
}

main().catch(erro=>{
  console.error('Backup: '+erro.message)
  if (process.argv[2] === 'daily') {
    fs.mkdirSync(BACKUP_DIR,{recursive:true})
    fs.appendFileSync(path.join(BACKUP_DIR,'rotina.log'),`${new Date().toISOString()} FALHA: ${erro.message.replaceAll('\n',' ')}\n`)
  }
  process.exitCode = 1
})

const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {conexao,esconder,garantirDestinoSeguro,hashArquivo,validarBackup,restaurarBackup} = require('../scripts/backup-lib.cjs')

test('recuperação bloqueia a origem inclusive por aliases de conexão Supabase', () => {
  const direta = conexao('postgresql://postgres:exemplo@db.abcdefgh.supabase.co:5432/postgres')
  const pooler = conexao('postgresql://postgres.abcdefgh:outro@aws-0-sa.pooler.supabase.com:5432/postgres')
  assert.equal(direta.fingerprint,pooler.fingerprint)
  assert.throws(()=>garantirDestinoSeguro(pooler,{origem:direta.fingerprint}),/origem/)
})

test('recuperação bloqueia o banco em uso, mesmo se o backup veio de outra origem', () => {
  const url = 'postgresql://usuario:exemplo@localhost:5432/atual'
  const destino = conexao('postgresql://outro:exemplo@127.0.0.1:5432/atual')
  assert.throws(()=>garantirDestinoSeguro(destino,{origem:'outra'},url),/em uso/)
  assert.doesNotThrow(()=>garantirDestinoSeguro(conexao('postgresql://usuario:exemplo@localhost:5432/recuperacao'),{origem:'outra'},url))
})

test('erros removem senhas e URLs antes de gravar logs ou mostrar mensagens', () => {
  const config = conexao('postgresql://usuario:p%40ss%26teste@exemplo.com/banco')
  const erro = esconder('erro p@ss&teste p%40ss%26teste postgresql://usuario:p%40ss%26teste@exemplo.com/banco',config)
  assert.doesNotMatch(erro,/p@ss|p%40ss|postgresql:\/\//)
})

test('manifesto detecta alteração ou corrupção do arquivo antes de restaurar', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(),'corte-backup-'))
  const arquivo = path.join(pasta,'teste.dump')
  try {
    fs.writeFileSync(arquivo,'PGDMP arquivo de teste')
    const manifesto = {versao:1,escopo:'public',arquivo:'teste.dump',postgresMajor:17,tabelas:{cortes:'1'},origem:'origem',sha256:await hashArquivo(arquivo)}
    fs.writeFileSync(arquivo+'.json',JSON.stringify(manifesto))
    assert.equal((await validarBackup(arquivo)).manifesto.postgresMajor,17)
    await assert.rejects(restaurarBackup({arquivo,urlDestino:'postgresql://teste:exemplo@127.0.0.1:1/vazio'}),/confirm/)
    fs.appendFileSync(arquivo,'corrompido')
    await assert.rejects(validarBackup(arquivo),/integridade/)
  } finally {
    for (const nome of [arquivo,arquivo+'.json']) if (fs.existsSync(nome)) fs.unlinkSync(nome)
    fs.rmdirSync(pasta)
  }
})

test('manifesto inválido não escolhe uma imagem ou escopo arbitrários para restaurar', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(),'corte-backup-'))
  const arquivo = path.join(pasta,'teste.dump')
  try {
    fs.writeFileSync(arquivo,'PGDMP teste')
    fs.writeFileSync(arquivo+'.json',JSON.stringify({versao:1,escopo:'outro',arquivo:'teste.dump',postgresMajor:'17;comando',tabelas:{}}))
    await assert.rejects(validarBackup(arquivo),/inválido/)
  } finally {
    for (const nome of [arquivo,arquivo+'.json']) if (fs.existsSync(nome)) fs.unlinkSync(nome)
    fs.rmdirSync(pasta)
  }
})

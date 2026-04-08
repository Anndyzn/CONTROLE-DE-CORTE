import sqlite3 from "sqlite3"

console.log("Banco iniciado")

const db = new sqlite3.Database("database.db")

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS cortes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER,
      produto TEXT,
      mesa TEXT,
      itens_finalizados INTEGER DEFAULT 0
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS producao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      numero_corte INTEGER,
      turno TEXT,
      operador TEXT,
      folha_inicio INTEGER,
      folha_parou INTEGER,
      status TEXT
    )
  `)
})


db.run(`
  CREATE TABLE IF NOT EXISTS itens_corte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_corte INTEGER,
    modelo TEXT,
    cor TEXT,
    tecido TEXT,
    metragem_usada REAL,
    sobra_metros REAL,
    perda_metros REAL,
    quantidade_pecas INTEGER
  )
`)


export default db

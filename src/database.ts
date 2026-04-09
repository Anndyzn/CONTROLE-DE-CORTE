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

  db.run(`ALTER TABLE producao ADD COLUMN hora_inicio TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Erro ao adicionar coluna hora_inicio:", err.message)
    }
  })

  db.run(`ALTER TABLE producao ADD COLUMN hora_fim TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Erro ao adicionar coluna hora_fim:", err.message)
    }
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
})

export default db

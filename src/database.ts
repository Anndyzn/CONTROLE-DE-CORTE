import sqlite3 from "sqlite3"

console.log("Banco iniciado")

const db = new sqlite3.Database("database.db")

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS cortes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER,
      produto TEXT,
      mesa TEXT
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

export default db

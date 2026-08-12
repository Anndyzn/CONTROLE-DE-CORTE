import "dotenv/config"
import { Pool } from "pg"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada no .env")
}

const dbPg = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

dbPg.on("connect", () => {
  console.log("✅ Conectado ao Supabase PostgreSQL")
})

dbPg.on("error", (erro) => {
  console.error("❌ Erro inesperado no PostgreSQL:", erro)
})

export default dbPg
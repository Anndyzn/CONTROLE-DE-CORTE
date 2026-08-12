"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_1 = require("pg");
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada no .env");
}
const dbPg = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
dbPg.on("connect", () => {
    console.log("✅ Conectado ao Supabase PostgreSQL");
});
dbPg.on("error", (erro) => {
    console.error("❌ Erro inesperado no PostgreSQL:", erro);
});
exports.default = dbPg;

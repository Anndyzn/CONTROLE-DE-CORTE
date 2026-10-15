import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido } from "../utils/validacoes"

const router = Router()

router.get("/historico-admin", async (req, res) => {
  const numero = req.query.numero
  const antes = req.query.antes
  if (numero !== undefined && !numeroCorteValido(numero)) {
    return res.status(400).json({ erro: "Informe um número de corte válido." })
  }
  if (antes !== undefined && (typeof antes !== "string" || !/^[1-9]\d{0,18}$/.test(antes) || BigInt(antes) > 9223372036854775807n)) {
    return res.status(400).json({ erro: "Página de histórico inválida." })
  }
  try {
    const resultado = await dbPg.query(
      `SELECT * FROM historico_admin
       WHERE ($1::integer IS NULL OR numero_corte = $1)
         AND ($2::bigint IS NULL OR id < $2)
       ORDER BY id DESC LIMIT 51`,
      [numero === undefined ? null : Number(numero), antes ?? null]
    )
    res.json({ registros: resultado.rows.slice(0, 50), tem_mais: resultado.rows.length > 50 })
  } catch (erro) {
    console.error("Erro ao consultar histórico administrativo:", erro)
    res.status(500).json({ erro: "Não foi possível consultar o histórico administrativo." })
  }
})

export default router

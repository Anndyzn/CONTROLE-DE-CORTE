import { Router } from "express"
import dbPg from "../database-pg"

const router = Router()

router.post("/producao", async (req, res) => {
  const {
    data,
    numero_corte,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status,
    hora_inicio,
    hora_fim
  } = req.body

  try {
    const resultado = await dbPg.query(
      `
      INSERT INTO producao (
        data,
        numero_corte,
        turno,
        operador,
        folha_inicio,
        folha_parou,
        status,
        hora_inicio,
        hora_fim
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
      RETURNING *
      `,
      [
        data,
        numero_corte,
        turno,
        operador,
        folha_inicio,
        folha_parou,
        status,
        hora_inicio,
        hora_fim
      ]
    )

    res.status(201).json({
      mensagem: "Produção salva com sucesso",
      id: resultado.rows[0].id
    })
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao salvar produção"
    })
  }
})

router.get("/producao/:numero/ultima", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      WHERE numero_corte = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Nenhuma produção encontrada para este corte"
      })
    }

    res.json(resultado.rows[0])
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar última produção"
    })
  }
})

router.get("/producao/:numero", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      WHERE numero_corte = $1
      ORDER BY data ASC, hora_inicio ASC
      `,
      [numero]
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar histórico do corte"
    })
  }
})

router.get("/producao", async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      ORDER BY id DESC
      `
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar produção"
    })
  }
})

export default router
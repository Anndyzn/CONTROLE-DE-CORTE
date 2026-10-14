import { Router } from "express"
import dbPg from "../database-pg"
import { periodoResumo } from "../utils/periodo-resumo"

const router = Router()

router.get("/cortes-finalizados-recentes", async (req, res) => {
  const periodo = periodoResumo()

  try {
    const resultado = await dbPg.query(
      `
      SELECT c.numero, c.produto, c.mesa,
        TO_CHAR(p.data, 'YYYY-MM-DD') AS data_finalizacao
      FROM cortes c
      JOIN LATERAL (
        SELECT p2.id, p2.data, p2.status
        FROM producao p2
        WHERE p2.numero_corte = c.numero
        ORDER BY p2.id DESC
        LIMIT 1
      ) p ON TRUE
      WHERE p.status = 'FINALIZADO'
        AND p.data BETWEEN $1::date AND $2::date
      ORDER BY p.data DESC, p.id DESC
      `,
      [periodo.data_inicial, periodo.hoje]
    )

    res.json({ ...periodo, cortes: resultado.rows })
  } catch (erro) {
    console.error("Erro ao consultar cortes finalizados recentes:", erro)
    res.status(500).json({ erro: "Não foi possível carregar os cortes finalizados." })
  }
})

router.get("/consultar-cortes", async (req, res) => {

  const {
    numero,
    produto,
    data_inicial,
    data_final,
    status
  } = req.query

  try {

    let query = `
      SELECT
        c.numero,
        c.produto,
        c.mesa,
        p.data,
        p.status,
        p.folha_parou
      FROM cortes c

      LEFT JOIN LATERAL (
        SELECT
          p2.data,
          p2.status,
          p2.folha_parou
        FROM producao p2
        WHERE p2.numero_corte = c.numero
        ORDER BY p2.id DESC
        LIMIT 1
      ) p ON TRUE

      WHERE 1 = 1
    `

    const params: any[] = []
    let parametro = 1


    // NÚMERO DO CORTE
    if (numero) {
      query += ` AND c.numero = $${parametro}`
      params.push(numero)
      parametro++
    }


    // NOME / PRODUTO
    if (produto) {
      query += ` AND UPPER(c.produto) LIKE UPPER($${parametro})`
      params.push(`%${produto}%`)
      parametro++
    }


    // DATA INICIAL
    if (data_inicial) {
      query += ` AND p.data >= $${parametro}`
      params.push(data_inicial)
      parametro++
    }


    // DATA FINAL
    if (data_final) {
      query += ` AND p.data <= $${parametro}`
      params.push(data_final)
      parametro++
    }


    // STATUS
    if (status) {
      query += ` AND p.status = $${parametro}`
      params.push(status)
      parametro++
    }


    // MAIS RECENTE PRIMEIRO
    query += `
      ORDER BY c.numero DESC
    `


    const resultado = await dbPg.query(query, params)

    res.json(resultado.rows)

  } catch (erro) {

    console.error("Erro ao consultar cortes:", erro)

    res.status(500).json({
      erro: "Erro ao consultar cortes"
    })
  }
})

export default router

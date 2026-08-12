import { Router } from "express"
import dbPg from "../database-pg"

const router = Router()

router.post("/cortes", async (req, res) => {
  const { numero, produto, mesa } = req.body

  try {
    const resultado = await dbPg.query(
      `
      INSERT INTO cortes (
        numero,
        produto,
        mesa
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [numero, produto, mesa]
    )

    res.status(201).json({
      mensagem: "Corte cadastrado com sucesso",
      corte: resultado.rows[0]
    })
  } catch (erro: any) {
    console.error(erro)

    if (erro.code === "23505") {
      return res.status(400).json({
        erro: "Já existe um corte com esse número"
      })
    }

    res.status(500).json({
      erro: "Erro ao cadastrar corte"
    })
  }
})

router.get("/cortes/:numero/resumo", async (req, res) => {
  const { numero } = req.params

  try {
    const corteResultado = await dbPg.query(
      `
      SELECT *
      FROM cortes
      WHERE numero = $1
      `,
      [numero]
    )

    if (corteResultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Corte não encontrado"
      })
    }

    const ultimaProducaoResultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      WHERE numero_corte = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [numero]
    )

    res.json({
      corte: corteResultado.rows[0],
      ultima_producao: ultimaProducaoResultado.rows[0] || null
    })
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar resumo do corte"
    })
  }
})

router.get("/cortes/:numero/finalizacao-itens", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT itens_finalizados
      FROM cortes
      WHERE numero = $1
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Corte não encontrado"
      })
    }

    res.json(resultado.rows[0])
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar finalização dos itens"
    })
  }
})

router.get("/cortes/:numero", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM cortes
      WHERE numero = $1
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Corte não encontrado"
      })
    }

    res.json(resultado.rows[0])
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar corte"
    })
  }
})

router.get("/cortes", async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM cortes
      ORDER BY numero DESC
      `
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar cortes"
    })
  }
})

router.get("/cortes-em-andamento", async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `
      SELECT
        c.numero,
        c.produto,
        c.mesa,
        COALESCE(p.folha_parou, 0) AS folha_parou,
        COALESCE(p.status, 'EM PRODUÇÃO') AS status
      FROM cortes c

      LEFT JOIN LATERAL (
        SELECT
          p2.folha_parou,
          p2.status
        FROM producao p2
        WHERE p2.numero_corte = c.numero
        ORDER BY p2.id DESC
        LIMIT 1
      ) p ON TRUE

      WHERE
        p.status != 'FINALIZADO'
        OR p.status IS NULL

      ORDER BY c.numero DESC
      `
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar cortes em andamento"
    })
  }
})

router.post("/cortes/:numero/finalizar-itens", async (req, res) => {
  const { numero } = req.params

  try {
    const contagem = await dbPg.query(
      `
      SELECT COUNT(*)::int AS total
      FROM itens_corte
      WHERE numero_corte = $1
      `,
      [numero]
    )

    const total = contagem.rows[0].total

    if (total === 0) {
      return res.status(400).json({
        erro: "Adicione pelo menos um PI antes de registrar os itens do corte."
      })
    }

    const resultado = await dbPg.query(
      `
      UPDATE cortes
      SET itens_finalizados = 1
      WHERE numero = $1
      RETURNING *
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Corte não encontrado"
      })
    }

    res.json({
      mensagem: "Itens do corte registrados com sucesso"
    })
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao finalizar itens do corte"
    })
  }
})

router.post("/cortes/:numero/reabrir-itens", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      UPDATE cortes
      SET itens_finalizados = 0
      WHERE numero = $1
      RETURNING *
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Corte não encontrado"
      })
    }

    res.json({
      mensagem: "Itens do corte reabertos com sucesso"
    })
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao reabrir itens do corte"
    })
  }
})

export default router
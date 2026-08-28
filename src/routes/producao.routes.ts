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

// ========================================
// EDITAR LANÇAMENTO DE PRODUÇÃO
// ========================================

router.put("/producao/:id", async (req, res) => {
  const { id } = req.params

  const {
    data,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status,
    hora_inicio,
    hora_fim
  } = req.body


  if (
    !data ||
    !turno ||
    !operador ||
    folha_inicio === undefined ||
    folha_parou === undefined ||
    !status
  ) {
    return res.status(400).json({
      erro: "Preencha todos os campos obrigatórios"
    })
  }


  try {
    const resultado = await dbPg.query(
      `
      UPDATE producao
      SET
        data = $1,
        turno = $2,
        operador = $3,
        folha_inicio = $4,
        folha_parou = $5,
        status = $6,
        hora_inicio = $7,
        hora_fim = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        data,
        turno,
        operador,
        folha_inicio,
        folha_parou,
        status,
        hora_inicio || null,
        hora_fim || null,
        id
      ]
    )


    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Lançamento de produção não encontrado"
      })
    }


    res.json({
      mensagem:
        "Lançamento atualizado com sucesso",

      producao:
        resultado.rows[0]
    })

  } catch (erro) {
    console.error(
      "Erro ao atualizar produção:",
      erro
    )

    res.status(500).json({
      erro:
        "Erro ao atualizar lançamento de produção"
    })
  }
})

// ========================================
// EXCLUIR LANÇAMENTO DE PRODUÇÃO
// ========================================

router.delete(
  "/producao/:id",
  async (req, res) => {

    const { id } =
      req.params

    try {

      const resultado =
        await dbPg.query(
          `
          DELETE FROM producao
          WHERE id = $1
          RETURNING *
          `,
          [id]
        )


      // ========================================
      // PRODUÇÃO NÃO ENCONTRADA
      // ========================================

      if (
        resultado.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            erro:
              "Lançamento de produção não encontrado"
          })
      }


      // ========================================
      // SUCESSO
      // ========================================

      res.json({
        mensagem:
          "Lançamento excluído com sucesso",

        producao:
          resultado.rows[0]
      })

    } catch (erro) {

      console.error(
        "Erro ao excluir produção:",
        erro
      )


      res
        .status(500)
        .json({
          erro:
            "Erro ao excluir lançamento de produção"
        })
    }
  }
)

export default router
import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido, validarProducao } from "../utils/validacoes"
import { ErroRegra, executarNoCorte } from "../services/corte-bloqueado"
import { executarAlteracaoProducao } from "../services/alteracao-producao"
import { ErroMesaOcupada } from "../services/mesa-disponivel"

const router = Router()

router.post("/producao", async (req, res) => {
  const erroValidacao = validarProducao(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })
  if (!numeroCorteValido(req.body.numero_corte)) {
    return res.status(400).json({ erro: "Informe um número de corte válido." })
  }

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
    const resultado = await executarNoCorte(Number(numero_corte), async (client, corte) => {
      const ultima = await client.query(
        "SELECT status FROM producao WHERE numero_corte = $1 ORDER BY id DESC LIMIT 1",
        [Number(numero_corte)]
      )

      if (ultima.rows[0]?.status === "FINALIZADO" || Number(corte.itens_finalizados) === 1) {
        throw new ErroRegra(409, "Este corte já está finalizado. Novos lançamentos de produção estão bloqueados.")
      }

      return client.query(
        `
        INSERT INTO producao (
          data, numero_corte, turno, operador, folha_inicio,
          folha_parou, status, hora_inicio, hora_fim
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data, Number(numero_corte), turno, operador,
          Number(folha_inicio), Number(folha_parou), status,
          hora_inicio || null, hora_fim || null
        ]
      )
    })

    res.status(201).json({
      mensagem: "Produção salva com sucesso",
      id: resultado.rows[0].id
    })
  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
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
  const erroValidacao = validarProducao(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })

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


  try {
    const resultado = await executarAlteracaoProducao(id, status, req.body, client => client.query(
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
        Number(folha_inicio),
        Number(folha_parou),
        status,
        hora_inicio || null,
        hora_fim || null,
        id
      ]
    ))


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
    if (erro instanceof ErroMesaOcupada) {
      return res.status(409).json({ erro: erro.message, codigo: "MESA_OCUPADA", mesa: erro.mesa, cortes: erro.cortes })
    }
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
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
        await executarAlteracaoProducao(id, null, req.body, client => client.query(
          `
          DELETE FROM producao
          WHERE id = $1
          RETURNING *
          `,
          [id]
        ))


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
      if (erro instanceof ErroMesaOcupada) {
        return res.status(409).json({ erro: erro.message, codigo: "MESA_OCUPADA", mesa: erro.mesa, cortes: erro.cortes })
      }
      if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })

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

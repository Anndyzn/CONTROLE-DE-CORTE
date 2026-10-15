import { Router } from "express"
import dbPg from "../database-pg"
import { executarAlteracaoItem } from "../services/alteracao-item"
import { numeroCorteValido, validarItem } from "../utils/validacoes"
import { ErroRegra, executarNoCorte } from "../services/corte-bloqueado"

const router = Router()

// ========================================
// CADASTRAR ITEM DO CORTE
// ========================================
router.post("/itens-corte", async (req, res) => {
  const erroValidacao = validarItem(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })
  if (!numeroCorteValido(req.body.numero_corte)) {
    return res.status(400).json({ erro: "Informe um número de corte válido." })
  }

  const {
    numero_corte,
    modelo,
    cor,
    tecido,
    metragem_usada,
    sobra_metros,
    perda_metros,
    metros_faltantes,
    quantidade_pecas
  } = req.body

  try {
    const resultado = await executarNoCorte(Number(numero_corte), async (client, corte) => {
      if (Number(corte.itens_finalizados) === 1) {
        throw new ErroRegra(409, "Os PIs deste corte já foram confirmados. Reabra os itens pelo Admin antes de adicionar outro PI.")
      }

      return client.query(
        `
        INSERT INTO itens_corte (
          numero_corte, modelo, cor, tecido, metragem_usada,
          sobra_metros, perda_metros, metros_faltantes, quantidade_pecas
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          Number(numero_corte), modelo, cor, tecido,
          Number(metragem_usada), Number(sobra_metros ?? 0),
          Number(perda_metros ?? 0), Number(metros_faltantes ?? 0),
          Number(quantidade_pecas)
        ]
      )
    })

    res.status(201).json({
      mensagem: "Item do corte salvo com sucesso",
      item: resultado.rows[0]
    })

  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao cadastrar item:", erro)

    res.status(500).json({
      erro: "Erro ao cadastrar item do corte"
    })
  }
})


// ========================================
// LISTAR ITENS DE UM CORTE
// ========================================
router.get("/itens-corte/:numero", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM itens_corte
      WHERE numero_corte = $1
      ORDER BY id ASC
      `,
      [numero]
    )

    res.json(resultado.rows)

  } catch (erro) {
    console.error("Erro ao buscar itens:", erro)

    res.status(500).json({
      erro: "Erro ao buscar itens do corte"
    })
  }
})


// ========================================
// EDITAR ITEM
// ========================================
router.put("/itens-corte/:id", async (req, res) => {
  const erroValidacao = validarItem(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })

  const { id } = req.params

  const {
    modelo,
    cor,
    tecido,
    metragem_usada,
    sobra_metros,
    perda_metros,
    metros_faltantes,
    quantidade_pecas
  } = req.body

  try {
    const resultado = await executarAlteracaoItem(id, false, req.body, client => client.query(
      `
      UPDATE itens_corte
      SET
        modelo = $1,
        cor = $2,
        tecido = $3,
        metragem_usada = $4,
        sobra_metros = $5,
        perda_metros = $6,
        metros_faltantes = $7,
        quantidade_pecas = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        modelo,
        cor,
        tecido,
        Number(metragem_usada),
        Number(sobra_metros ?? 0),
        Number(perda_metros ?? 0),
        Number(metros_faltantes ?? 0),
        Number(quantidade_pecas),
        id
      ]
    ))

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Item não encontrado"
      })
    }

    res.json({
      mensagem: "Item atualizado com sucesso",
      item: resultado.rows[0]
    })

  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao atualizar item:", erro)

    res.status(500).json({
      erro: "Erro ao atualizar item"
    })
  }
})


// ========================================
// EXCLUIR ITEM
// ========================================
router.delete("/itens-corte/:id", async (req, res) => {
  const { id } = req.params

  try {
    const resultado = await executarAlteracaoItem(id, true, req.body, client => client.query(
      `
      DELETE FROM itens_corte
      WHERE id = $1
      RETURNING *
      `,
      [id]
    ))

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Item não encontrado"
      })
    }

    res.json({
      mensagem: "Item excluído com sucesso"
    })

  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao excluir item:", erro)

    res.status(500).json({
      erro: "Erro ao excluir item"
    })
  }
})

export default router

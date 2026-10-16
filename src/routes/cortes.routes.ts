import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido } from "../utils/validacoes"
import { ErroRegra, executarNoCorte } from "../services/corte-bloqueado"
import { cadastrarCorteNaMesa, ErroMesaOcupada, MESAS, normalizarMesa } from "../services/mesa-disponivel"
import { registrarAlteracaoAdmin, validarJustificativa } from "../services/historico-admin"

const router = Router()

router.put("/cortes/:numero/produto", async (req, res) => {
  const { numero } = req.params
  const { produto, produto_anterior } = req.body ?? {}
  if (!numeroCorteValido(numero)) return res.status(400).json({ erro: "Informe um número de corte válido." })
  if (typeof produto !== "string" || !produto.trim() || produto.trim().length > 200) {
    return res.status(400).json({ erro: "Informe o nome do produto (1 a 200 caracteres)." })
  }
  if (typeof produto_anterior !== "string") {
    return res.status(400).json({ erro: "Busque o corte novamente antes de corrigir o produto." })
  }

  try {
    const justificativa = validarJustificativa(req.body)
    const corte = await executarNoCorte(Number(numero), async client => {
      const anterior = (await client.query("SELECT * FROM cortes WHERE numero = $1", [numero])).rows[0]
      if (anterior.produto !== produto_anterior) {
        throw new ErroRegra(409, "O produto deste corte foi alterado. Busque o corte novamente antes de corrigir.")
      }
      const nome = produto.trim().toUpperCase()
      if (nome === anterior.produto) return anterior
      const resultado = await client.query(
        "UPDATE cortes SET produto = $1 WHERE numero = $2 RETURNING *", [nome, numero]
      )
      await registrarAlteracaoAdmin(client, {
        ...justificativa, numero: Number(numero), acao: "EDICAO_PRODUTO",
        antes: anterior, depois: resultado.rows[0]
      })
      return resultado.rows[0]
    })
    res.json({ mensagem: "Nome do produto atualizado com sucesso.", corte })
  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao corrigir produto:", erro)
    res.status(500).json({ erro: "Não foi possível corrigir o nome do produto." })
  }
})

router.post("/cortes", async (req, res) => {
  const { numero, produto, mesa } = req.body ?? {}

  if (!numeroCorteValido(numero) || typeof produto !== "string" || !produto.trim()) {
    return res.status(400).json({ erro: "Informe um número de corte positivo, produto e mesa." })
  }

  const mesaNormalizada = normalizarMesa(mesa)
  if (!MESAS.includes(mesaNormalizada)) {
    return res.status(400).json({ erro: "Selecione uma mesa válida: MESA 1, MESA 2 ou MESA 3." })
  }

  try {
    const corte = await cadastrarCorteNaMesa(Number(numero), produto.trim(), mesaNormalizada)

    res.status(201).json({
      mensagem: "Corte cadastrado com sucesso",
      corte
    })
  } catch (erro: any) {
    if (erro instanceof ErroMesaOcupada) {
      return res.status(409).json({
        erro: erro.message, codigo: "MESA_OCUPADA", mesa: erro.mesa, cortes: erro.cortes
      })
    }

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

router.get("/cortes/proximo-numero", async (req, res) => {
  try {
    const resultado = await dbPg.query(`
      SELECT COALESCE(MAX(numero), 0) + 1 AS proximo_numero
      FROM cortes
    `)

    res.json({
      proximo_numero: resultado.rows[0].proximo_numero
    })
  } catch (erro) {
    console.error("Erro ao buscar próximo número:", erro)

    res.status(500).json({
      erro: "Erro ao buscar próximo número de corte"
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

  if (!numeroCorteValido(numero)) return res.status(400).json({ erro: "Informe um número de corte válido." })

  try {
    await executarNoCorte(Number(numero), async (client) => {
      const contagem = await client.query(
        "SELECT COUNT(*)::int AS total FROM itens_corte WHERE numero_corte = $1",
        [numero]
      )

      if (contagem.rows[0].total === 0) {
        throw new ErroRegra(400, "Adicione pelo menos um PI antes de registrar os itens do corte.")
      }

      await client.query(
        "UPDATE cortes SET itens_finalizados = 1 WHERE numero = $1",
        [numero]
      )
    })

    res.json({
      mensagem: "Itens do corte registrados com sucesso"
    })
  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao finalizar itens do corte"
    })
  }
})

router.post("/cortes/:numero/reabrir-itens", async (req, res) => {
  const { numero } = req.params
  if (!numeroCorteValido(numero)) return res.status(400).json({ erro: "Informe um número de corte válido." })

  try {
    const justificativa = validarJustificativa(req.body)
    await executarNoCorte(Number(numero), async (client, corte) => {
      if (Number(corte.itens_finalizados) === 0) return
      const anterior = await client.query("SELECT * FROM cortes WHERE numero = $1", [numero])
      const resultado = await client.query("UPDATE cortes SET itens_finalizados = 0 WHERE numero = $1 RETURNING *", [numero])
      await registrarAlteracaoAdmin(client, {
        ...justificativa, numero: Number(numero), acao: "REABERTURA_PIS",
        antes: anterior.rows[0], depois: resultado.rows[0]
      })
    })

    res.json({
      mensagem: "Itens do corte reabertos com sucesso"
    })
  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao reabrir itens do corte"
    })
  }
})

// ========================================
// EXCLUIR CORTE COMPLETO
// ========================================

router.delete(
  "/cortes/:numero",
  async (req, res) => {

    const { numero } = req.params
    if (!numeroCorteValido(numero)) return res.status(400).json({ erro: "Informe um número de corte válido." })

    const client =
      await dbPg.connect()

    try {

      await client.query("BEGIN")
      const justificativa = validarJustificativa(req.body)


      // ========================================
      // CONFIRMAR SE O CORTE EXISTE
      // ========================================

      const corte =
        await client.query(
          `
          SELECT *
          FROM cortes
          WHERE numero = $1
          FOR UPDATE
          `,
          [numero]
        )


      if (corte.rows.length === 0) {

        await client.query(
          "ROLLBACK"
        )

        return res
          .status(404)
          .json({
            erro:
              "Corte não encontrado"
          })
      }


      // ========================================
      // EXCLUIR PIs
      // ========================================

      const itens =
        await client.query(
          `
          DELETE FROM itens_corte
          WHERE numero_corte = $1
          RETURNING *
          `,
          [numero]
        )


      // ========================================
      // EXCLUIR PRODUÇÕES
      // ========================================

      const producoes =
        await client.query(
          `
          DELETE FROM producao
          WHERE numero_corte = $1
          RETURNING *
          `,
          [numero]
        )


      // ========================================
      // EXCLUIR CORTE
      // ========================================

      await client.query(
        `
        DELETE FROM cortes
        WHERE numero = $1
        `,
        [numero]
      )

      await registrarAlteracaoAdmin(client, {
        ...justificativa, numero: Number(numero), acao: "EXCLUSAO_CORTE",
        antes: { corte: corte.rows[0], producao: producoes.rows, itens: itens.rows }, depois: null
      })

      await client.query(
        "COMMIT"
      )


      res.json({
        mensagem:
          `Corte ${numero} excluído com sucesso`,

        itens_excluidos:
          itens.rowCount,

        producoes_excluidas:
          producoes.rowCount
      })


    } catch (erro) {

      await client.query(
        "ROLLBACK"
      )

      if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })

      console.error(
        "Erro ao excluir corte:",
        erro
      )


      res.status(500).json({
        erro:
          "Erro ao excluir corte"
      })


    } finally {

      client.release()

    }
  }
)

export default router

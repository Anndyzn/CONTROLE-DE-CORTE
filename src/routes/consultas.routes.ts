import { Router } from "express"
import dbPg from "../database-pg"
import { periodoResumo } from "../utils/periodo-resumo"
import { ErroRegra } from "../services/corte-bloqueado"
import { montarConsultaCortes } from "../services/consulta-cortes"
import { gerarRelatorioExcel } from "../services/relatorio-excel"

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

  try {
    const { query, params } = montarConsultaCortes(req.query)
    const resultado = await dbPg.query(query, params)

    res.json(resultado.rows)

  } catch (erro) {
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao consultar cortes:", erro)

    res.status(500).json({
      erro: "Erro ao consultar cortes"
    })
  }
})

router.get("/consultar-cortes/exportar", async (req, res) => {
  let client
  let transacao = false
  try {
    const { query, params, filtros } = montarConsultaCortes(req.query)
    client = await dbPg.connect()
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    transacao = true
    const cortes = (await client.query(query, params)).rows
    if (!cortes.length) throw new ErroRegra(404, "Nenhum corte encontrado para exportar com estes filtros.")
    const numeros = cortes.map(corte => corte.numero)
    const producao = (await client.query(
      "SELECT * FROM producao WHERE numero_corte = ANY($1::int[]) ORDER BY numero_corte DESC, id ASC", [numeros]
    )).rows
    const itens = (await client.query(
      "SELECT * FROM itens_corte WHERE numero_corte = ANY($1::int[]) ORDER BY numero_corte DESC, id ASC", [numeros]
    )).rows
    await client.query("COMMIT")
    transacao = false
    client.release()
    client = undefined
    const agora = new Date()
    const arquivo = await gerarRelatorioExcel({ cortes, producao, itens }, filtros, agora)
    const data = agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
    res.setHeader("Cache-Control", "no-store")
    res.attachment(`relatorio-cortes-${data}.xlsx`)
    res.send(arquivo)
  } catch (erro) {
    if (transacao && client) await client.query("ROLLBACK")
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error("Erro ao exportar relatório:", erro)
    res.status(500).json({ erro: "Não foi possível gerar o Excel. Tente novamente." })
  } finally {
    client?.release()
  }
})

export default router

import { Router, Response } from "express"
import { ErroRegra } from "../services/corte-bloqueado"
import { cadastrarTecido, listarTecidos, alterarSituacaoTecido, sugerirTecidos, excluirTecido, resolverTecidosEmLote } from "../services/tecidos-defeitos"
import { conectarTecidosRealtime, notificarTecidosAlterados } from "../services/tecidos-realtime"

const router = Router()
router.get("/tecidos-defeitos/atualizacoes", conectarTecidosRealtime)
function falha(res: Response, erro: unknown) {
  if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
  console.error("Falha em tecidos com defeito:", erro)
  return res.status(500).json({ erro: "Não foi possível concluir. Tente novamente; seus dados foram preservados na tela." })
}
router.get("/tecidos-defeitos/sugestoes", async (_req, res) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json({ tecidos: await sugerirTecidos() }) }
  catch (e) { falha(res, e) }
})
router.get("/tecidos-defeitos", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store")
    res.json(await listarTecidos(req.query.status ?? "PENDENTE", req.query.busca ?? "", Number(req.query.pagina ?? 1), req.query.imprimir === "1"))
  } catch (e) { falha(res, e) }
})
router.post("/tecidos-defeitos", async (req, res) => {
  try {
    const item = await cadastrarTecido(req.body)
    notificarTecidosAlterados()
    res.status(201).json({ item })
  }
  catch (e) { falha(res, e) }
})
router.post("/tecidos-defeitos/resolver-lote", async (req, res) => {
  try {
    const resultado = await resolverTecidosEmLote(req.body)
    notificarTecidosAlterados()
    res.json(resultado)
  } catch (e) { falha(res, e) }
})
router.put("/tecidos-defeitos/:id/situacao", async (req, res) => {
  try {
    const item = await alterarSituacaoTecido(Number(req.params.id), req.body)
    notificarTecidosAlterados()
    res.json({ item })
  }
  catch (e) { falha(res, e) }
})
router.delete("/tecidos-defeitos/:id", async (req, res) => {
  try {
    const resultado = await excluirTecido(Number(req.params.id), req.body)
    notificarTecidosAlterados()
    res.json(resultado)
  } catch (e) { falha(res, e) }
})
export default router

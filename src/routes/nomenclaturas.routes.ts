import { Router } from "express"
import dbPg from "../database-pg"
import { ErroRegra } from "../services/corte-bloqueado"
import { aplicarPadronizacao, categoriasNomes, previaPadronizacao, tipoNome } from "../services/padronizacao-nomes"
const router = Router()
function erroResposta(res: import("express").Response, erro: unknown) {
  if (erro instanceof ErroRegra) return res.status(erro.status).json({erro: erro.message})
  console.error("Falha na padronização de nomes:", erro)
  res.status(500).json({erro: "Não foi possível concluir a operação. Atualize a prévia e tente novamente."})
}
router.get("/admin/nomenclaturas", async (req, res) => {
  try {
    const tipo = tipoNome(req.query.tipo)
    const busca = req.query.busca ?? ""
    if (typeof busca !== "string" || busca.length > 200) throw new ErroRegra(400, "Filtro de nome inválido.")
    const config = categoriasNomes[tipo]
    const resultado = await dbPg.query(`SELECT ${config.campo} AS nome, COUNT(*)::integer AS registros,
      COUNT(DISTINCT ${tipo === "cortes" ? "numero" : "numero_corte"})::integer AS cortes
      FROM ${config.tabela}
      WHERE TRANSLATE(UPPER(${config.campo}), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') LIKE $1
      GROUP BY ${config.campo} ORDER BY ${config.campo} LIMIT 1001`,
      [`%${busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}%`])
    res.json({nomes: resultado.rows.slice(0,1000), tem_mais: resultado.rows.length > 1000})
  } catch (erro) { erroResposta(res, erro) }
})
router.post("/admin/nomenclaturas/previa", async (req, res) => {
  try { res.json(await previaPadronizacao(req.body)) } catch (erro) { erroResposta(res, erro) }
})
router.post("/admin/nomenclaturas/aplicar", async (req, res) => {
  try { res.json(await aplicarPadronizacao(req.body)) } catch (erro) { erroResposta(res, erro) }
})
export default router

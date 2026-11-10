import { Router } from "express"
import db from "../database-pg"
import { ErroRegra } from "../services/corte-bloqueado"
import { normalizarNome } from "../services/sankhya-preparacao"
import { validarOpcoesNome } from "../services/sankhya-nomes"
const router = Router()
function responder(res: import("express").Response, erro: unknown) {
  if (erro instanceof ErroRegra) return res.status(erro.status).json({erro: erro.message})
  console.error("Falha nas opções Sankhya:", erro)
  return res.status(500).json({erro: "Não foi possível carregar ou salvar as opções. Tente novamente."})
}
router.get("/sankhya/nomenclaturas", async (req,res) => {
  try {
    const busca = req.query.busca ?? "", nome = req.query.nome
    if (typeof busca !== "string" || busca.length > 200 || (nome !== undefined && (typeof nome !== "string" || nome.length > 200))) throw new ErroRegra(400, "Filtro inválido.")
    const resultado = await db.query(`WITH nomes AS (
      SELECT UPPER(REGEXP_REPLACE(TRIM(produto), '\\s+', ' ', 'g')) AS nome, COUNT(*)::integer AS cortes
      FROM cortes WHERE TRIM(produto) <> '' GROUP BY 1
    ) SELECT n.nome, n.cortes, COALESCE(v.opcoes, '[]'::jsonb) AS opcoes, COALESCE(v.versao, 0) AS versao
      FROM nomes n LEFT JOIN sankhya_nomes v ON v.nome = n.nome
      WHERE ($2::text IS NULL OR n.nome = $2) AND TRANSLATE(n.nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') LIKE $1
      ORDER BY n.nome LIMIT 1001`, [`%${busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}%`, nome === undefined ? null : normalizarNome(nome as string)])
    res.json({nomes: resultado.rows.slice(0,1000), tem_mais: resultado.rows.length > 1000})
  } catch (erro) { responder(res,erro) }
})
router.put("/sankhya/nomenclaturas", async (req,res) => {
  try {
    const valor = validarOpcoesNome(req.body)
    const valores = [valor.nome, JSON.stringify(valor.opcoes)]
    const resultado = valor.versao === 0
      ? await db.query(`INSERT INTO sankhya_nomes (nome, opcoes) SELECT $1::text, $2::jsonb
        WHERE EXISTS (SELECT 1 FROM cortes WHERE UPPER(REGEXP_REPLACE(TRIM(produto), '\\s+', ' ', 'g')) = $1::text)
        ON CONFLICT DO NOTHING RETURNING versao`, valores)
      : await db.query(`UPDATE sankhya_nomes SET opcoes = $2::jsonb, versao = versao + 1, atualizado_em = NOW()
        WHERE nome = $1 AND versao = $3 RETURNING versao`, [...valores,valor.versao])
    if (!resultado.rows.length) throw new ErroRegra(409, "A nomenclatura não existe ou foi alterada em outra tela. Recarregue a lista.")
    res.json({versao: resultado.rows[0].versao, opcoes: valor.opcoes})
  } catch (erro) { responder(res,erro) }
})
export default router

import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido } from "../utils/validacoes"
import { ErroRegra } from "../services/corte-bloqueado"
import { carregarConferenciaSankhya, validarCorrespondencia } from "../services/sankhya-preparacao"
import { gerarGuiaSankhyaExcel } from "../services/sankhya-excel"

const router = Router()
function responderErro(res: import("express").Response, erro: unknown) {
  if (erro instanceof ErroRegra) return res.status(erro.status).json({erro: erro.message})
  console.error("Falha na preparação Sankhya:", erro)
  return res.status(500).json({erro: "Não foi possível consultar ou salvar a preparação. Tente novamente."})
}

// São candidatos à conferência, não uma lista de OPs ainda não lançadas no ERP.
router.get("/sankhya/cortes", async (_req, res) => {
  try {
    const resultado = await dbPg.query(`SELECT c.numero, c.produto FROM cortes c
      JOIN LATERAL (SELECT status FROM producao WHERE numero_corte = c.numero ORDER BY id DESC LIMIT 1) p ON TRUE
      WHERE c.itens_finalizados = 1 AND p.status = 'FINALIZADO'
        AND EXISTS (SELECT 1 FROM itens_corte i WHERE i.numero_corte = c.numero)
      ORDER BY c.numero DESC LIMIT 50`)
    res.json(resultado.rows)
  } catch (erro) { responderErro(res, erro) }
})

router.get("/sankhya/cortes/:numero/conferencia", async (req, res) => {
  if (!numeroCorteValido(req.params.numero)) return res.status(400).json({erro: "Informe um número de corte válido."})
  try {
    res.json(await carregarConferenciaSankhya(Number(req.params.numero)))
  } catch (erro) { responderErro(res, erro) }
})

router.get("/sankhya/cortes/:numero/excel", async (req, res) => {
  if (!numeroCorteValido(req.params.numero)) return res.status(400).json({erro: "Informe um número de corte válido."})
  try {
    const dados = await carregarConferenciaSankhya(Number(req.params.numero))
    const arquivo = await gerarGuiaSankhyaExcel(dados)
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="guia-sankhya-corte-${dados.corte.numero}.xlsx"`)
    res.setHeader("Cache-Control", "no-store")
    res.send(Buffer.from(arquivo))
  } catch (erro) { responderErro(res, erro) }
})

router.put("/sankhya/correspondencias", async (req, res) => {
  try {
    const regra = validarCorrespondencia(req.body)
    const valores = [regra.modelo, regra.tecido, regra.cor, JSON.stringify(regra.destinos)]
    const resultado = regra.versao === 0
      ? await dbPg.query(`INSERT INTO sankhya_correspondencias (modelo, tecido, cor, destinos)
          VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING RETURNING versao`, valores)
      : await dbPg.query(`UPDATE sankhya_correspondencias SET destinos = $4::jsonb, versao = versao + 1, atualizado_em = NOW()
          WHERE modelo = $1 AND tecido = $2 AND cor = $3 AND versao = $5 RETURNING versao`, [...valores, regra.versao])
    if (!resultado.rows.length) throw new ErroRegra(409, "Esta correspondência foi alterada em outra tela. Recarregue o corte antes de editar novamente.")
    res.json({mensagem: "Correspondência salva para os próximos cortes com este modelo, tecido e cor.", versao: resultado.rows[0].versao})
  } catch (erro) { responderErro(res, erro) }
})

export default router

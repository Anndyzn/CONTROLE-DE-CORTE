import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido } from "../utils/validacoes"

const router = Router()
const acoes = ["PADRONIZACAO_PRODUTO","PADRONIZACAO_MODELO","EDICAO_PRODUTO","EDICAO_PRODUCAO","REABERTURA_PRODUCAO","EXCLUSAO_PRODUCAO","EDICAO_PI","EXCLUSAO_PI","REABERTURA_PIS","EXCLUSAO_CORTE"]
function dataValida(valor: unknown) {
  if(typeof valor!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000"))return false
  const d=new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===valor
}

router.get("/historico-admin", async (req, res) => {
  const numero = req.query.numero
  const antes = req.query.antes
  const acao = req.query.acao, busca = req.query.busca ?? "", inicio = req.query.inicio, fim = req.query.fim
  if (numero !== undefined && !numeroCorteValido(numero)) {
    return res.status(400).json({ erro: "Informe um número de corte válido." })
  }
  if (antes !== undefined && (typeof antes !== "string" || !/^[1-9]\d{0,18}$/.test(antes) || BigInt(antes) > 9223372036854775807n)) {
    return res.status(400).json({ erro: "Página de histórico inválida." })
  }
  if(acao!==undefined && (typeof acao!=="string" || ![...acoes,"NOMENCLATURAS"].includes(acao)))return res.status(400).json({erro:"Tipo de alteração inválido."})
  if(typeof busca!=="string" || busca.length>200)return res.status(400).json({erro:"Busca inválida (máximo 200 caracteres)."})
  if((inicio!==undefined&&!dataValida(inicio)) || (fim!==undefined&&!dataValida(fim)) || (inicio&&fim&&String(inicio)>String(fim)))return res.status(400).json({erro:"Informe um período válido."})
  const filtroAcoes = acao===undefined?null:acao==="NOMENCLATURAS"?["PADRONIZACAO_PRODUTO","PADRONIZACAO_MODELO","EDICAO_PRODUTO"]:[acao]
  const termo = busca.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\\%_]/g,"\\$&")
  try {
    const resultado = await dbPg.query(
      `SELECT *, criado_em::text AS instante_operacao FROM historico_admin
       WHERE ($1::integer IS NULL OR numero_corte = $1)
         AND ($2::bigint IS NULL OR id < $2)
         AND ($3::text[] IS NULL OR acao = ANY($3::text[]))
         AND ($4::text IS NULL OR TRANSLATE(UPPER(CONCAT_WS(' ', responsavel, motivo, antes::text, depois::text)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') LIKE $4)
         AND ($5::date IS NULL OR criado_em >= ($5::date::timestamp AT TIME ZONE 'America/Sao_Paulo'))
         AND ($6::date IS NULL OR criado_em < (($6::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
       ORDER BY id DESC LIMIT 51`,
      [numero === undefined ? null : Number(numero), antes ?? null, filtroAcoes, termo?`%${termo}%`:null, inicio??null, fim??null]
    )
    res.setHeader("Cache-Control","no-store")
    res.json({ registros: resultado.rows.slice(0, 50), tem_mais: resultado.rows.length > 50 })
  } catch (erro) {
    console.error("Erro ao consultar histórico administrativo:", erro)
    res.status(500).json({ erro: "Não foi possível consultar o histórico administrativo." })
  }
})

export default router
